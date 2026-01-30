import { Injectable, Logger } from '@nestjs/common';
import { MeikoService } from '../meiko/meiko.service';
import { InvoiceService } from '../invoice/invoice.service';
import { DateUtils } from '../../utils/date';
import * as path from 'path';
import { OcrService } from '../ocr/ocr.service';
import { DocumentFactory } from '../validator/documents/base/document.factory';
import { DeliveryStatus, InvoiceStatus } from '../meiko/enums/status.enum';
import { DateTime } from 'luxon';
import { Utils } from '../validator/documents/utils';
import pLimit from 'p-limit';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceUtils } from '../invoice/utils/Invoice.utils';
import { Prisma } from '@generated/client-meiko';
import { ExcludedService } from '../excluded/excluded.service';
import { ProductService } from '../product/product.service';

/**
 * Extraction Service
 * Handles automated invoice extraction via cron job
 */
const PROCESABLES = [
  'Factura Coke',
  'Factura Postobon',
  'Infocargue Postobon',
  'Factura Tiquete POS Postobon',
  'Factura Femsa',
  'Factura Aje',
  'Factura Quala',
  'Factura Otros Proveedores',
];
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly meikoService: MeikoService,
    private readonly invoiceService: InvoiceService,
    private readonly ocrService: OcrService,
    private readonly excludedService: ExcludedService,
    private readonly productService: ProductService,
  ) {}

  /**
   * Extraction cron job
   * Runs automatically based on configured schedule
   *
   * Current schedule: Every day at 2:00 AM
   * Modify the cron expression as needed
   */
  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'extraction',
  })

  // idea, que sea una función recursiva, si no encuentra datos, hace un await de 1 minuto
  async handleExtractionCron(ids?: number[]) {

    if(process.env.IS_PRODUCTION !== 'true') {
      this.logger.warn('⚠️ Extraction cron job skipped - Not in production environment');
      return;
    }
    this.logger.log('🚀 Starting extraction cron job');

    try {
      // 0. Check if there are documents already being processed
      const processingDocuments =
        await this.invoiceService.countByStatus('PROCESSING');

      if (processingDocuments > 0) {
        this.logger.warn(
          `⏸️ Found ${processingDocuments} document(s) already in PROCESSING status. Skipping this cron execution.`,
        );
        return;
      }

      this.logger.log(
        '✅ No documents in PROCESSING status. Proceeding with extraction.',
      );

      // 1. Get current date
      const date = DateUtils.getDate();
      this.logger.log(`📅 Date: ${date}`);

      // 2. Get parameters (returns path)
      const parameters = { path: '/app/uploads' };
      // const parameters = { path: '/opt/files' };
      // const basePath = parameters.path || parameters.ruta || parameters;
      const basePath = parameters.path;
      this.logger.log(`📂 Base path from parameters: ${basePath}`);

      // 3. Create folder with path + date
      const extractionPath = path.join(basePath, '');
      // await fs.mkdir(extractionPath, { recursive: true });
      this.logger.log(`✅ Created extraction folder: ${extractionPath}`);

      // 4. Get max invoice ID (only process new invoices not yet in our DB)
      const maxId = await this.invoiceService.getMaxId();
      // const maxId = 4276823;
      this.logger.log(`📊 Max invoice ID in our DB: ${maxId}`);

      // 5. Get new invoices from Meiko
      // let documents : any;

      const documents = ids
        ? await this.meikoService.getInvoices({ where: { id: { in: ids } } })
        : await this.meikoService.getInvoicesByMaxId(maxId);

      const documentsReprocess = await this.invoiceService.getDocuments({
        where: { status: 'REPROCESS' },
      });
      // const documents = await this.meikoService.getInvoicesTest(ids);
      // const document = await this.meikoService.getInvoiceById(4276816);
      // if (!document) {
      //   this.logger.log('ℹ️ No new invoices to process');
      //   return;
      // }
      // const documents = [document];
      this.logger.log(`📄 Found ${documents.length} new invoices to process`);

      if (documents.length === 0 && documentsReprocess.length === 0) {
        this.logger.log('ℹ️ No new invoices to process');
        return;
      }

      // 6. Create invoice records in our DB with initial PROCESSING status
      const docs = await this.invoiceService.createInvoices(
        documents.map((invoice) => ({
          status: 'PROCESSING',
          documentId: invoice.id,
          surveyId: invoice.surveyRecordId.toString(),
          photoType: invoice.photoType,
          documentUrl: invoice.link,
        })),
      );
      this.logger.log(
        `✅ Created ${documents.length} invoice records with PROCESSING status`,
      );

      // 7. Process each invoice with multi-threading support
      let processedCount = 0;
      let deliveredCount = 0;
      let validationRequiredCount = 0;
      let errorCount = 0;

      // Get thread count from environment variable, default to 4
      const THREAD_COUNT = parseInt(
        process.env.INVOICE_PROCESSING_THREADS || '4',
        10,
      );
      const limit = pLimit(THREAD_COUNT);

      this.logger.log(
        `⚙️ Processing invoices with ${THREAD_COUNT} concurrent threads`,
      );

      const processingTasks = docs.concat(documentsReprocess).map((doc) =>
        limit(async () => {
          try {
            this.logger.log(`\n🔄 Processing invoice ${doc.id}...`);
            const factura = await this.meikoService.getInvoiceById(
              doc.documentId,
            );

            // 7.1. Download and validate image
            const { isValid: isDownloadable, path: imagePath } =
              await this.invoiceService.downloadAndValidate(
                doc,
                extractionPath,
              );

            if (!isDownloadable) {
              this.logger.warn(
                `⚠️ Invoice ${doc.id} - Image not downloadable or viewable`,
              );
              await this.meikoService.createStatus({
                digitalizationStatusId: InvoiceStatus.ERROR_DE_DESCARGA,
                invoiceId: doc.documentId,
              });
              await this.invoiceService.updateDocument({
                id: doc.id,
                path: imagePath,
                errors: 'NO DESCARGABLE O VISUALIZABLE',
                deliveryStatus: DeliveryStatus.ERROR_DE_DESCARGA,
                extracted: false,
                validated: false,
                status: 'DELIVERED',
              });
              errorCount++;
              return;
            }

            // 7.2. Process with OCR
            this.logger.log(`🔍 Invoice ${doc.id} - Processing with OCR...`);
            const ocrResult = await this.ocrService.processInvoice({
              filePath: imagePath,
              typeOfInvoice: doc.photoType,
            });

            if (!ocrResult.success || !ocrResult.data) {
              this.logger.error(
                `❌ Invoice ${doc.id} - OCR processing failed: ${ocrResult.error}`,
              );
              await this.invoiceService.updateDocument({
                id: doc.id,
                path: imagePath,
                errors: `OCR_ERROR: ${ocrResult.error}`,
                extracted: false,
                validated: false,
                status: 'PENDING_VALIDATION',
              });
              errorCount++;
              return;
            }

            await this.invoiceService.updateDocument({
              id: doc.id,
              mayaDocumentJSON: JSON.stringify(ocrResult.data),
            });

            
            let finalType: string;
            const photoTypeOcr = ocrResult.data.response.tipoFacturaOcr;
            
            const photoType = doc.photoType;

            if(photoTypeOcr ==='NO PROCESABLE') {
              this.logger.warn(
                `⚠️ Invoice ${doc.id} - OCR result is NO PROCESABLE`,
              );
              await this.meikoService.createStatus({
                digitalizationStatusId: InvoiceStatus.NO_PROCESABLE,
                invoiceId: doc.documentId,
              });
              await this.invoiceService.updateDocument({
                id: doc.id,
                status: 'DELIVERED',
                deliveryStatus: DeliveryStatus.NO_PROCESABLE,
                extracted: false,
                validated: false,
              });
              return;
            }
            
            if (
              photoType === 'Factura Postobon' &&
              photoTypeOcr === 'Factura Tiquete POS Postobon'
            ) {
              finalType = photoTypeOcr;
            } else finalType = photoType;

            this.logger.log(
              `📋 Invoice ${doc.id} - Document type: ${photoTypeOcr}`,
            );

            // if (
            //   photoType === 'Factura Otros Proveedores' &&
            //   photoTypeOcr == 'Factura Otros Proveedores'
            // ) {
            //   finalType = 'Factura Otros Proveedores';
            //   await this.invoiceService.createFactura({
            //     data: {
            //       responseId: factura?.responseId,
            //       responseReceived: factura?.responseReceived,
            //       stickerQr: factura?.stickerQR,
            //       variableName: factura?.variableName,
            //       surveyRecordId: Number(doc.surveyId),
            //       digitalizationDate: new Date(),
            //       extractionDate: new Date(),
            //       photoType: doc.photoType,
            //       link: doc.documentUrl,
            //       id: doc.documentId,
            //     },
            //   });
            //   await this.invoiceService.updateDocument({
            //     id: doc.id,
            //     mayaDocumentJSON: JSON.stringify(ocrResult.data),
            //     status: 'FLUJO_TAP',
            //   });
            //   return;
            // }

            if (photoTypeOcr === 'Factura Tolima') finalType = 'Factura Tolima';
            if (photoTypeOcr === 'Factura Kopps') finalType = 'Factura Kopps';
            if (photoTypeOcr === 'Factura Otros Proveedores') finalType = 'Factura Otros Proveedores';
            
            const document = DocumentFactory.create(
              finalType,
              {
                ...ocrResult.data.response,
                surveyRecordId: doc.surveyId,
                facturaId: doc.documentId,
              },
              this.meikoService,
              this.invoiceService,
              this.excludedService,
              this.productService
            );

            await document.process();

            const {
              data: processedData,
              errors,
              isValid,
              result,
            } = document.get();


            if (processedData.detalles.length === 0) {
              await this.meikoService.createStatus({
                digitalizationStatusId: InvoiceStatus.NO_APLICA_PARA_EL_ESTUDIO,
                invoiceId: doc.documentId,
              });
              await this.invoiceService.updateDocument({
                id: doc.id,
                errors: 'TODOS LOS PRODUCTOS FUERON EXCLUIDOS',
                deliveryStatus: DeliveryStatus.NO_APLICA_PARA_EL_ESTUDIO,
                extracted: false,
                validated: false,
                mayaDocumentJSON: JSON.stringify(ocrResult.data),
                status: 'DELIVERED',
              });
              return;
            }

            // 7.4. Calculate overall confidence
            const confidence = this.calculateConfidence(processedData);
            this.logger.log(
              `📊 Invoice ${doc.id} - Overall confidence: ${confidence.overall.toFixed(2)}%`,
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
                id: doc.id,
                extracted: true,
                validated: isFullConfidence,
                path: imagePath,
                photoTypeOCR: photoTypeOcr,
                status: 'PROCESSING', // Will update later based on confidence
              },
              processedData,
              ocrResult.data,
            );

            // 7.6. Decision logic based on confidence and validation
            const hasErrors = errors && Object.keys(errors).length > 0;

            if (isFullConfidence && !hasErrors) {
              // Scenario 1: 100% confidence → Deliver to our Meiko tables automatically
              this.logger.log(
                `✅ Invoice ${doc.id} - 100% confidence → Delivering to Meiko tables`,
              );

              try {
                await this.meikoService.createManyFields(
                  result as Prisma.ResultCreateManyInput[],
                );

                await this.meikoService.createStatus({
                  digitalizationStatusId: InvoiceStatus.PROCESADO,
                  invoiceId: doc.documentId,
                });
                await this.invoiceService.updateDocument({
                  id: doc.id,
                  status: 'DELIVERED',
                  deliveryStatus: DeliveryStatus.PROCESADO,
                  validated: true,
                });
                deliveredCount++;
                this.logger.log(
                  `🚀 Invoice ${doc.id} - Successfully delivered to Meiko tables`,
                );
              } catch (deliveryError: any) {
                this.logger.error(
                  `❌ Invoice ${doc.id} - Delivery to Meiko tables failed: ${deliveryError.message}`,
                );
                await this.invoiceService.updateDocument({
                  id: doc.id,
                  status: 'PENDING_TO_SEND',
                  errors: `DELIVERY_ERROR: ${deliveryError.message}`,
                });
                errorCount++;
              }
            } else {
              // Scenario 2: < 100% confidence → Requires manual validation
              this.logger.log(
                `⚠️ Invoice ${doc.id} - Confidence < 100% or has errors → Requires manual validation`,
              );

              const errorMessages: string[] = [];
              if (!isFullConfidence) {
                errorMessages.push(
                  `CONFIDENCE_LOW: ${confidence.overall.toFixed(2)}%`,
                );
              }
              if (hasErrors) {
                errorMessages.push(
                  `VALIDATION_ERRORS: ${JSON.stringify(errors)}`,
                );
              }
              const allErrors = InvoiceUtils.getErrors(processedData);

              await this.invoiceService.updateDocument({
                id: doc.id,
                status: 'PENDING_VALIDATION',
                validated: false,
                errors: allErrors.join(' | '),
              });
              validationRequiredCount++;
              this.logger.log(
                `📋 Invoice ${doc.id} - Moved to manual validation queue`,
              );
            }

            processedCount++;
          } catch (error) {
            this.logger.error(
              `❌ Error processing invoice ${doc.id}: ${error.message}`,
              error.stack,
            );
            await this.invoiceService.updateDocument({
              id: doc.id,
              status: 'PENDING_VALIDATION',
              errors: `PROCESSING_ERROR: ${error.message}`,
            });
            errorCount++;
          }
        }),
      );

      // Wait for all processing tasks to complete
      await Promise.allSettled(processingTasks);

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

  async triggerManualExtraction(ids?: number[]) {
    this.logger.log('🔧 Manual extraction triggered');
    await this.handleExtractionCron(ids);
  }
}
