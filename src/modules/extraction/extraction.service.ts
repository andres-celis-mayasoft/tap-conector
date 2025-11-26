import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client-bd';
import { TapService } from '../tap/tap.service';
import { MeikoService } from '../meiko/meiko.service';
import { InvoiceService } from '../invoice/invoice.service';
import { DateUtils } from '../../utils/date';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OcrService } from '../ocr/ocr.service';
import { TAP_MEIKO_ID, TAP_PARAMS } from 'src/constants/business';
import { DocumentFactory } from '../validator/documents/base/document.factory';
import { InvoiceStatus } from '../meiko/enums/status.enum';
import { DateTime } from 'luxon';

/**
 * Extraction Service
 * Handles automated invoice extraction via cron job
 */
const PROCESABLES = [
  'Factura Coke',
  'Factura Postobon',
  'Factura Infocargue',
  'Factura Tiquete POS Postobon',
  'Femsa',
  'Factura Aje',
  'Factura Quala'
]
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly tapService: TapService,
    private readonly meikoService: MeikoService,
    private readonly invoiceService: InvoiceService,
    private readonly ocrService: OcrService,
  ) {}

  /**
   * Extraction cron job
   * Runs automatically based on configured schedule
   *
   * Current schedule: Every day at 2:00 AM
   * Modify the cron expression as needed
   */
  // @Cron(CronExpression.EVERY_DAY_AT_2AM, {
  //   name: 'extraction',
  // })

  // idea, que sea una función recursiva, si no encuentra datos, hace un await de 1 minuto
  async handleExtractionCron() {
    this.logger.log('🚀 Starting extraction cron job');

    try {
      // 1. Get current date
      const date = DateUtils.getDate();
      this.logger.log(`📅 Date: ${date}`);

      // 2. Get parameters (returns path)
      const parameters = await this.tapService.getParameters(
        TAP_MEIKO_ID,
        TAP_PARAMS.RUTA_LISTA_LOTES,
      );
      // const basePath = parameters.path || parameters.ruta || parameters;
      const basePath = parameters.path || parameters.ruta || parameters.replace('E','C');
      this.logger.log(`📂 Base path from parameters: ${basePath}`);

      // 3. Create folder with path + date
      const extractionPath = path.join(basePath, date);
      await fs.mkdir(extractionPath, { recursive: true });
      this.logger.log(`✅ Created extraction folder: ${extractionPath}`);

      // 4. Get max invoice ID (only process new invoices not yet in our DB)
      // const maxId = await this.invoiceService.getMaxId();
      const maxId = 4276793
      this.logger.log(`📊 Max invoice ID in our DB: ${maxId}`);

      // 5. Get new invoices from Meiko
      // const documents = await this.meikoService.getInvoices(maxId);
      const document = await this.meikoService.getInvoiceById(4276816);
      if(!document) {
        this.logger.log('ℹ️ No new invoices to process');
        return;
      }
      const documents = [document]
      this.logger.log(`📄 Found ${documents.length} new invoices to process`);

      if (documents.length === 0) {
        this.logger.log('ℹ️ No new invoices to process');
        return;
      }

      // 6. Create invoice records in our DB with initial PROCESSING status
      await this.invoiceService.createInvoices(
        documents.map((invoice) => ({
          status: 'PROCESSING',
          documentId: invoice.id,
          photoType: invoice.photoType,
          documentUrl: invoice.link,
        })),
      );
      this.logger.log(
        `✅ Created ${documents.length} invoice records with PROCESSING status`,
      );

      // 7. Process each invoice
      let processedCount = 0;
      let deliveredCount = 0;
      let validationRequiredCount = 0;
      let errorCount = 0;

      for (const invoice of documents) {
        try {
          this.logger.log(`\n🔄 Processing invoice ${invoice.id}...`);
          if(!PROCESABLES.some(item=> item === invoice.photoType)) {
            await this.invoiceService.updateDocument({
              id: invoice.id,
              status: 'IGNORED',
              validated: false,
              errors: 'TIPO DE DOCUMENTO NO PROCESABLE',
            });
            continue;
          }

          // 7.1. Download and validate image
          const { isValid: isDownloadable, path: imagePath } =
            await this.invoiceService.downloadAndValidate(
              invoice,
              extractionPath,
            );

          if (!isDownloadable) {
            this.logger.warn(
              `⚠️ Invoice ${invoice.id} - Image not downloadable or viewable`,
            );
            await this.meikoService.createStatus({
              digitalizationStatusId: InvoiceStatus.ERROR_DE_DESCARGA,
              invoiceId: invoice.id,
            })
            await this.invoiceService.updateDocument({
              id: invoice.id,
              path: imagePath,
              errors: 'NO DESCARGABLE O VISUALIZABLE',
              extracted: false,
              validated: false,
              status: 'DELIVERED',
            });
            errorCount++;
            continue;
          }


          // 7.2. Process with OCR
          this.logger.log(`🔍 Invoice ${invoice.id} - Processing with OCR...`);
          const ocrResult = await this.ocrService.processInvoice({
            filePath: imagePath,
            typeOfInvoice: invoice.photoType || '',
          });

          if (!ocrResult.success || !ocrResult.data) {
            this.logger.error(
              `❌ Invoice ${invoice.id} - OCR processing failed: ${ocrResult.error}`,
            );
            await this.invoiceService.updateDocument({
              id: invoice.id,
              path: imagePath,
              errors: `OCR_ERROR: ${ocrResult.error}`,
              extracted: false,
              validated: false,
              status: 'ERROR',
            });
            errorCount++;
            continue;
          }

          // 7.3. Create document and process (normalize, validate, infer)
          const photoTypeOcr =
            ocrResult.data.data?.photoTypeOcr || invoice.photoType;
          this.logger.log(
            `📋 Invoice ${invoice.id} - Document type: ${photoTypeOcr}`,
          );

          let document: any;
          try {
            document = DocumentFactory.create(
              photoTypeOcr,
              ocrResult.data.response,
              this.meikoService,
              this.invoiceService
            );
          } catch (error: any) {
            this.logger.error(
              `❌ Invoice ${invoice.id} - Unsupported document type: ${photoTypeOcr}`,
            );
            await this.invoiceService.updateDocument({
              id: invoice.id,
              path: imagePath,
              errors: `UNEXPECTED ERROR: ${photoTypeOcr}`,
              extracted: false,
              validated: false,
              status: 'ERROR',
            });
            errorCount++;
            continue;
          }

          await document.process();
          const { data: processedData, errors, isValid } = document.get();

          if(!isValid) {
            await this.meikoService.createStatus({
              digitalizationStatusId: InvoiceStatus.FECHA_NO_VALIDA,
              invoiceId: invoice.id,
            })
            await this.invoiceService.updateDocument({
              id: invoice.id,
              path: imagePath,
              errors: 'FECHA OBSOLETA',
              extracted: false,
              validated: false,
              status: 'DELIVERED',
            });
            continue;
          }

          // 7.4. Calculate overall confidence
          const confidence = this.calculateConfidence(processedData);
          this.logger.log(
            `📊 Invoice ${invoice.id} - Overall confidence: ${confidence.overall.toFixed(2)}%`,
          );
          this.logger.log(
            `   ├─ Header confidence: ${confidence.headerConfidence.toFixed(2)}%`,
          );
          this.logger.log(
            `   └─ Details confidence: ${confidence.detailsConfidence.toFixed(2)}%`,
          );

          const isFullConfidence = confidence.overall === 100;
          // 7.5. Save invoice with extracted fields
          await this.invoiceService.saveInvoiceWithFields(
            {
              id: invoice.id,
              extracted: true,
              validated: isFullConfidence,
              path: imagePath,
              photoTypeOCR: photoTypeOcr,
              status: 'PROCESSING', // Will update later based on confidence
            },
            processedData,
          );

          // 7.6. Decision logic based on confidence and validation
          const hasErrors = errors && Object.keys(errors).length > 0;

          if ( isFullConfidence && !hasErrors) {
            // Scenario 1: 100% confidence → Deliver to our Meiko tables automatically
            this.logger.log(
              `✅ Invoice ${invoice.id} - 100% confidence → Delivering to Meiko tables`,
            );

            try {
              // Extract header and details from processed data
              const headerFields = processedData.encabezado || [];
              const detailFields = processedData.detalles || [];

              // Create MeikoResult entry for each detail row
              for (let i = 0; i < detailFields.length; i++) {
                const detailsGroup = detailFields.filter((f: any) => f.row === detailFields[i].row);

                const numeroFactura = headerFields.find((f: any) => f.type === 'numero_factura')?.text;
                const fechaFactura = DateTime.fromFormat(headerFields.find((f: any) => f.type === 'fecha_factura')?.text, 'dd/MM/yyyy').toString();
                const razonSocial = headerFields.find((f: any) => f.type === 'razon_social')?.text;

                const codigoProducto = detailsGroup.find((f: any) => f.type === 'codigo_producto')?.text;
                const descripcion = detailsGroup.find((f: any) => f.type === 'item_descripcion_producto')?.text;
                const tipoEmbalaje = detailsGroup.find((f: any) => f.type === 'tipo_embalaje')?.text;
                const unidadEmbalaje = detailsGroup.find((f: any) => f.type === 'cantidad_embalaje')?.text;
                const packVendidos = detailsGroup.find((f: any) => f.type === 'pack_vendidos')?.text;
                const valorVenta = detailsGroup.find((f: any) => f.type === 'valor_venta_item')?.text;
                const unidadesVendidas = detailsGroup.find((f: any) => f.type === 'unidades_vendidas')?.text;
                const totalFactura = detailsGroup.find((f: any) => f.type === 'total_factura')?.text;
                const valorIbua = detailsGroup.find((f: any) => f.type === 'valor_ibua_y_otros')?.text;

                const confidence = (
                  (detailsGroup.reduce((sum: number, f: any) => sum + (f.confidence || 0), 0) / detailsGroup.length) * 100
                ).toFixed(2);

                await this.meikoService.createFields({
                  meikoDocument: { connect: { id: invoice.id } },
                  surveyRecordId: Number(invoice.surveyRecordId),
                  invoiceNumber: numeroFactura,
                  documentDate: fechaFactura ? fechaFactura : null,
                  businessName: razonSocial,
                  productCode: codigoProducto,
                  description: descripcion,
                  packagingType: tipoEmbalaje,
                  packagingUnit: unidadEmbalaje ? parseFloat(unidadEmbalaje) : null,
                  packsSold: packVendidos ? parseFloat(packVendidos) : null,
                  saleValue: valorVenta ? parseInt(valorVenta) : null,
                  unitsSold: unidadesVendidas ? parseFloat(unidadesVendidas) : null,
                  totalDocument: totalFactura ? parseFloat(totalFactura) : null,
                  rowNumber: detailFields[i].row || 0,
                  valueIbuaAndOthers: valorIbua ? parseInt(valorIbua) : null,
                  confidence: new Prisma.Decimal(confidence),
                });
              }

              await this.meikoService.createStatus({
                digitalizationStatusId: InvoiceStatus.PROCESADO,
                invoiceId: invoice.id,
              })
              // await this.invoiceService.deliverToMeikoTables(
              //   invoice.id,
              //   invoice,
              //   processedData,
              // );
              await this.invoiceService.updateDocument({
                id: invoice.id,
                status: 'DELIVERED',
                validated: true,
              });
              deliveredCount++;
              this.logger.log(
                `🚀 Invoice ${invoice.id} - Successfully delivered to Meiko tables`,
              );
            } catch (deliveryError: any) {
              this.logger.error(
                `❌ Invoice ${invoice.id} - Delivery to Meiko tables failed: ${deliveryError.message}`,
              );
              await this.invoiceService.updateDocument({
                id: invoice.id,
                status: 'PENDING_TO_SEND',
                errors: `DELIVERY_ERROR: ${deliveryError.message}`,
              });
              errorCount++;
            }
          } else {
            // Scenario 2: < 100% confidence → Requires manual validation
            this.logger.log(
              `⚠️ Invoice ${invoice.id} - Confidence < 100% or has errors → Requires manual validation`,
            );

            const errorMessages: string[] = [];
            if (!isFullConfidence) {
              errorMessages.push(
                `CONFIDENCE_LOW: ${confidence.overall.toFixed(2)}%`,
              );
            }
            if (hasErrors) {
              errorMessages.push(`VALIDATION_ERRORS: ${JSON.stringify(errors)}`);
            }


            await this.invoiceService.updateDocument({
              id: invoice.id,
              status: 'PENDING_VALIDATION',
              validated: false,
              errors: errorMessages.join(' | '),
            });
            validationRequiredCount++;
            this.logger.log(
              `📋 Invoice ${invoice.id} - Moved to manual validation queue`,
            );
          }

          processedCount++;
        } catch (error) {
          this.logger.error(
            `❌ Error processing invoice ${invoice.id}: ${error.message}`,
            error.stack,
          );
          await this.invoiceService.updateDocument({
            id: invoice.id,
            status: 'ERROR',
            errors: `PROCESSING_ERROR: ${error.message}`,
          });
          errorCount++;
        }
      }

      // 8. Summary log
      this.logger.log('\n📊 Extraction cron job completed');
      this.logger.log(`   ├─ Total invoices: ${documents.length}`);
      this.logger.log(`   ├─ Successfully processed: ${processedCount}`);
      this.logger.log(`   ├─ Delivered to Meiko: ${deliveredCount}`);
      this.logger.log(
        `   ├─ Pending manual validation: ${validationRequiredCount}`,
      );
      this.logger.log(`   └─ Errors: ${errorCount}`);
    } catch (error) {
      this.logger.error(
        `❌ Extraction cron job failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate overall confidence score from invoice data
   * @param data Processed invoice data with encabezado and detalles
   * @returns Confidence metrics
   */
  private calculateConfidence(data: any): {
    overall: number;
    headerConfidence: number;
    detailsConfidence: number;
  } {
    const encabezado = data.encabezado || [];
    const detalles = data.detalles || [];

    // Calculate header confidence (average of all header fields)
    const headerConfidence =
      encabezado.length > 0
        ? (encabezado.reduce(
            (sum: number, field: any) => sum + (field.confidence || 0),
            0,
          ) /
            encabezado.length) *
          100
        : 0;

    // Calculate details confidence (average of all detail fields)
    const detailsConfidence =
      detalles.length > 0
        ? (detalles.reduce(
            (sum: number, field: any) => sum + (field.confidence || 0),
            0,
          ) /
            detalles.length) *
          100
        : 0;

    // Overall confidence (weighted average: 40% header, 60% details)
    const overall =
      encabezado.length > 0 || detalles.length > 0
        ? headerConfidence * 0.4 + detailsConfidence * 0.6
        : 0;

    return {
      overall: Math.round(overall * 100) / 100,
      headerConfidence: Math.round(headerConfidence * 100) / 100,
      detailsConfidence: Math.round(detailsConfidence * 100) / 100,
    };
  }

  /**
   * Process a single invoice
   * Downloads, validates, and moves image to final path
   */
  private async processInvoice(invoice: any, extractionPath: string) {
    const invoiceId = invoice.id_factura;
    const imageUrl = invoice.stickerQR;

    this.logger.log(`🟡 Processing invoice ${invoiceId}`);

    if (!imageUrl) {
      throw new Error(`Invoice ${invoiceId} has no stickerQR URL`);
    }

    // Generate temp and final paths
    const tempFile = this.invoiceService.generateTempFilePath();
    const extension = '.jpg';
    const finalPath = this.invoiceService.generateFinalPath(
      extractionPath,
      `${invoiceId}${extension}`,
    );

    try {
      // Download image
      const imageData = await this.invoiceService.downloadImage(imageUrl);

      // Save to temp file
      await this.invoiceService.saveTempFile(tempFile, imageData);

      // Validate image
      await this.invoiceService.validateImage(tempFile);

      // Move to final path if valid
      await this.invoiceService.moveToFinalPath(tempFile, finalPath);

      this.logger.log(`✅ Invoice ${invoiceId} processed successfully`);
    } catch (error) {
      // Cleanup temp file on error
      await this.invoiceService.cleanupTempFile(tempFile);
      throw error;
    }
  }

  /**
   * Trigger extraction manually (for testing)
   * This can be called via an endpoint if needed
   */
  async triggerManualExtraction() {
    this.logger.log('🔧 Manual extraction triggered');
    await this.handleExtractionCron();
  }
}
