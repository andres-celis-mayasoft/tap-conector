import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp'; // 🧠 Used to validate image integrity
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma } from '@prisma/client-bd';
import { IMAGE_DPI } from 'src/constants/business';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  isExcluded(description: string) {
    return this.prisma.excludedProducts.findFirst({
      where: {
        description,
      },
    });
  }

  updateDocument(
    document: Prisma.DocumentUpdateInput & { id: number },
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.document.updateMany({
      where: { documentId: document.id },
      data: document,
    });
  }

  getDocument(id: number) {
    return this.prisma.document.findUnique({
      where: { id },
    });
  }

  async getMaxId(): Promise<number> {
    try {
      const result = await this.prisma.document.findFirst({
        orderBy: {
          documentId: 'desc',
        },
        select: {
          documentId: true,
        },
      });

      return result?.documentId ?? 0;
    } catch (error) {
      this.logger.error(
        `Error fetching max invoiceId: ${error.message}`,
        error.stack,
      );
      return 0;
    }
  }

  async getInvoices(maxId: number) {
    try {
      this.logger.log(`Fetching invoices with id_factura > ${maxId}`);

      const invoices = await this.prisma.document.findMany({
        where: {
          id: {
            gt: maxId,
          },
        },
        orderBy: {
          id: 'asc',
        },
        take: 30,
      });

      this.logger.log(`Found ${invoices.length} invoices matching criteria`);

      return invoices;
    } catch (error) {
      this.logger.error(
        `Error fetching invoices from Meiko database: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  createDocument(document: Prisma.DocumentCreateInput) {
    return this.prisma.document.create({
      data: document,
    });
  }

  createInvoices(documents: Prisma.DocumentCreateInput[]) {
    return this.prisma.document.createMany({
      data: documents,
      skipDuplicates: true,
    });
  }

  checkBatch() {
    this.prisma.$transaction(async (prisma) => {
      const result = await prisma.$queryRawUnsafe(`
      SELECT id
      FROM (
      SELECT id,
             status,
             LAG(status, 1) OVER (ORDER BY id) prev_status,
             ROW_NUMBER() OVER (ORDER BY id) - 
             ROW_NUMBER() OVER (PARTITION BY status ORDER BY id) grp
      FROM invoice
      ) t
      WHERE status = 'PENDING_TO_SEND'
      GROUP BY grp
      HAVING COUNT(*) >= 30
      `);
      this.logger.log(`Batch check result: ${JSON.stringify(result)}`);
      return result;
    });
  }

  async downloadAndValidate(
    invoice: any,
    targetDir: string,
  ): Promise<{ isValid: boolean; path: string }> {
    const extension = '.jpg';
    const tempFile = this.generateTempFilePath();
    const finalPath = this.generateFinalPath(
      targetDir,
      `${invoice.id}${extension}`,
    );

    try {
      this.logger.log(`🟡 Processing invoice ID ${invoice.id_factura}`);

      const data = await this.downloadImage(invoice.link);

      await this.saveTempFile(tempFile, data);

      await this.validateImage(tempFile);

      // Resize image with specified DPI
      await this.resizeImageWithDPI(tempFile, finalPath);

      // this.updateInvoiceMetadata(invoice, finalPath, extension);

      this.logger.log(
        `✅ Invoice ${invoice.id_factura} processed successfully`,
      );
      return { path: finalPath, isValid: true };
    } catch (error) {
      this.logger.error(
        `❌ Error processing invoice ${invoice.id_factura}: ${error.message}`,
      );
      await this.cleanupTempFile(tempFile);
      await this.handleDownloadError(invoice, error);
      return { path: finalPath, isValid: false };
    }
  }

  generateTempFilePath(): string {
    return path.join(process.env.TEMP || '/tmp', crypto.randomUUID() + '.tmp');
  }

  generateFinalPath(dir: string, fileName: string): string {
    return path.join(dir, fileName);
  }

  async downloadImage(url: string): Promise<Buffer> {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    });
    if (!response.data || response.data.length === 0) {
      throw new Error('Downloaded file is empty');
    }
    return response.data;
  }

  async saveTempFile(tempFile: string, data: Buffer): Promise<void> {
    await fs.writeFile(tempFile, data);
  }

  async validateImage(filePath: string): Promise<void> {
    try {
      await sharp(filePath).metadata();
    } catch {
      throw new Error('File is not a valid or readable image');
    }
  }

  async moveToFinalPath(tempFile: string, finalPath: string): Promise<void> {
    await fs.mkdir(path.dirname(finalPath), { recursive: true });
    await fs.rename(tempFile, finalPath);
  }

  async resizeImageWithDPI(
    inputPath: string,
    outputPath: string,
  ): Promise<void> {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      await sharp(inputPath)
        .jpeg({ quality: 85 })
        .withMetadata({ density: IMAGE_DPI })
        .toFile(outputPath);

      // Clean up temp file after processing
      await this.cleanupTempFile(inputPath);

      this.logger.log(`✅ Image resized with ${IMAGE_DPI} DPI`);
    } catch (error) {
      this.logger.error(`❌ Error resizing image: ${error.message}`);
      throw error;
    }
  }

  async cleanupTempFile(tempFile: string): Promise<void> {
    try {
      await fs.unlink(tempFile);
    } catch {}
  }

  async handleDownloadError(id: string, error: any): Promise<void> {
    this.logger.warn(`⚠️ Error with invoice ${id}: ${error.message}`);
    // optional: send email, log to DB, etc.
  }

  /**
   * Save invoice with all extracted fields from OCR data
   * @param invoiceData - Base invoice information (must include id which is the invoiceId)
   * @param mayaInvoiceJson - OCR extracted data with encabezado and detalles
   * @returns Updated invoice with created fields
   */
  async saveInvoiceWithFields(
    invoiceData: Prisma.DocumentUpdateInput & { id: number },
    mayaInvoiceJson: {
      encabezado: Array<{
        type: string;
        text: string;
        confidence: number;
      }>;
      detalles: Array<{
        type: string;
        text: string;
        confidence: number;
        row: number;
      }>;
      tipoFacturaOcr?: string;
    },
  ): Promise<void> {
    try {
      this.logger.log(`💾 Saving invoice ${invoiceData.id} with fields`);

      // Update invoice with OCR data
      await this.updateDocument({
        ...invoiceData,
        mayaDocumentJSON: JSON.stringify(mayaInvoiceJson),
        photoTypeOCR: mayaInvoiceJson.tipoFacturaOcr,
      });

      // Get invoice to obtain invoiceId for field relations
      const document = await this.getDocument(invoiceData.id);
      if (!document) {
        throw new Error(`Invoice with id ${invoiceData.id} not found`);
      }

      // Prepare header fields (encabezado)
      const headerFields: Prisma.FieldCreateManyInput[] =
        mayaInvoiceJson.encabezado.map((field) => ({
          documentId: document.documentId,
          name: field.type,
          value: field.text,
          confidence: field.confidence,
          type: 'ENCABEZADO',
          extracted: true,
          validated: field.confidence === 1,
        }));

      // Prepare detail fields (detalles)
      const detailFields: Prisma.FieldCreateManyInput[] =
        mayaInvoiceJson.detalles.map((field) => ({
          documentId: document.documentId,
          row: field.row,
          name: field.type,
          value: field.text,
          confidence: field.confidence,
          type: 'DETALLE',
          extracted: true,
          validated: field.confidence === 1,
        }));

      // Combine all fields
      const allFields = [...headerFields, ...detailFields];

      // Create all fields in a single transaction
      await this.prisma.field.createMany({
        data: allFields,
        skipDuplicates: true,
      });

      this.logger.log(
        `✅ Invoice ${invoiceData.id} saved with ${allFields.length} fields (${headerFields.length} header + ${detailFields.length} details)`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error saving invoice ${invoiceData.id} with fields: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Deliver validated invoice data to our Meiko mirror tables
   * @param invoiceId - Original Meiko invoice ID
   * @param meikoInvoiceData - Original Meiko invoice data
   * @param processedData - Validated invoice data with encabezado and detalles
   */
  async deliverToMeikoTables(
    invoiceId: number,
    meikoInvoiceData: any,
    processedData: any,
  ): Promise<void> {
    try {
      this.logger.log(`📦 Delivering invoice ${invoiceId} to Meiko tables...`);

      const encabezado = processedData.encabezado || [];
      const detalles = processedData.detalles || [];

      // Helper function to get field value by type
      const getFieldValue = (
        fields: any[],
        fieldType: string,
      ): string | null => {
        const field = fields.find((f) => f.type === fieldType);
        return field?.text || null;
      };

      // Helper function to parse decimal
      const parseDecimal = (value: string | null): number | null => {
        if (!value) return null;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
      };

      // Helper function to parse date
      const parseDate = (value: string | null): Date | null => {
        if (!value) return null;
        // Try multiple date formats
        const formats = ['dd/MM/yyyy', 'yyyy-MM-dd', 'MM/dd/yyyy'];
        for (const format of formats) {
          try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) return date;
          } catch {}
        }
        return null;
      };

      // Extract header fields
      const fechaFactura = getFieldValue(encabezado, 'fecha_factura');
      const numeroFactura = getFieldValue(encabezado, 'numero_factura');
      const razonSocial = getFieldValue(encabezado, 'razon_social');
      const valorTotalFactura = getFieldValue(
        encabezado,
        'valor_total_factura',
      );

      // Create MeikoInvoice record
      const meikoInvoice = await this.prisma.meikoDocument.create({
        data: {
          surveyRecordId: BigInt(meikoInvoiceData.surveyRecordId || 0),
          responseId: meikoInvoiceData.responseId
            ? BigInt(meikoInvoiceData.responseId)
            : null,
          stickerQr: meikoInvoiceData.stickerQR || null,
          responseReceived: meikoInvoiceData.responseReceived || null,
          variableName: meikoInvoiceData.variableName || null,
          photoType: meikoInvoiceData.photoType || null,
          link: meikoInvoiceData.link || null,
          flagDigitalization: 1, // Mark as digitalized
          digitalizationDate: new Date(),
          extractionDate: new Date(),
          deliveryStatus: 'DELIVERED',
        },
      });

      this.logger.log(
        `✅ Created MeikoInvoice record with id ${meikoInvoice.id}`,
      );

      // Group details by row
      const detailsByRow = detalles.reduce((acc: any, field: any) => {
        if (!acc[field.row]) {
          acc[field.row] = {};
        }
        acc[field.row][field.type] = field;
        return acc;
      }, {});

      // Create MeikoResult records for each detail row
      const meikoResults: any = [];
      for (const [rowNumber, rowFields] of Object.entries(detailsByRow)) {
        const fields = rowFields as any;

        const resultData = {
          meikoInvoiceId: meikoInvoice.id,
          surveyRecordId: Number(meikoInvoiceData.surveyRecordId || 0),
          invoiceNumber: numeroFactura,
          invoiceDate: parseDate(fechaFactura),
          businessName: razonSocial,
          productCode: fields.codigo_producto?.text || null,
          description: fields.item_descripcion_producto?.text || null,
          packagingType: fields.tipo_embalaje?.text || null,
          packagingUnit: parseDecimal(fields.unidades_embalaje?.text),
          packsSold: parseDecimal(fields.packs_vendidos?.text),
          saleValue: parseDecimal(fields.valor_venta_item?.text),
          unitsSold: parseDecimal(fields.unidades_vendidas?.text),
          totalInvoice: parseDecimal(valorTotalFactura),
          totalInvoiceWithoutVAT: parseDecimal(
            fields.total_factura_sin_iva?.text,
          ),
          rowNumber: Number(rowNumber),
          valueIbuaAndOthers: fields.valor_ibua_y_otros?.text
            ? parseInt(fields.valor_ibua_y_otros.text)
            : null,
          confidence: this.calculateRowConfidence(Object.values(fields)),
        };

        meikoResults.push(resultData);
      }

      // Create all results
      if (meikoResults.length > 0) {
        await this.prisma.meikoResult.createMany({
          data: meikoResults,
        });
        this.logger.log(
          `✅ Created ${meikoResults.length} MeikoResult records`,
        );
      }

      this.logger.log(
        `✅ Invoice ${invoiceId} successfully delivered to Meiko tables`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error delivering invoice ${invoiceId} to Meiko tables: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Calculate average confidence for a row of fields
   */
  private calculateRowConfidence(fields: any[]): number {
    if (!fields || fields.length === 0) return 0;
    const sum = fields.reduce(
      (acc, field) => acc + (field?.confidence || 0),
      0,
    );
    return sum / fields.length;
  }

  /**
   * Assign an invoice to a user for manual validation
   * If the user already has an assigned invoice, return that one
   * Otherwise, assign the next available invoice with status PENDING_VALIDATION
   *
   * @param userId - User ID to assign invoice to
   * @returns Assigned invoice or null if none available
   */
  async assignInvoiceToUser(userId: number): Promise<any> {
    try {
      this.logger.log(`🔍 Looking for invoice to assign to user ${userId}`);

      // Check if user already has an assigned invoice
      const existingAssignment = await this.prisma.document.findFirst({
        where: {
          assignedUserId: userId,
          status: { in: ['PENDING_VALIDATION', 'IN_CAPTURE'] },
          completedAt: null,
        },
        orderBy: {
          assignedAt: 'desc',
        },
      });

      if (existingAssignment) {
        this.logger.log(
          `♻️ User ${userId} already has assigned invoice ${existingAssignment.documentId}`,
        );
        return existingAssignment;
      }

      // Find next available invoice for validation
      const availableInvoice = await this.prisma.document.findFirst({
        where: {
          status: 'PENDING_VALIDATION',
          assignedUserId: null,
        },
        orderBy: {
          id: 'asc', // Oldest first
        },
      });

      if (!availableInvoice) {
        this.logger.log(`ℹ️ No invoices available for validation`);
        return null;
      }

      // Assign invoice to user and change status to IN_CAPTURE
      const assignedInvoice = await this.prisma.document.update({
        where: { id: availableInvoice.id },
        data: {
          assignedUserId: userId,
          assignedAt: new Date(),
          captureStartDate: new Date(),
          status: 'IN_CAPTURE',
        },
      });

      this.logger.log(
        `✅ Assigned invoice ${assignedInvoice.documentId} to user ${userId}`,
      );

      return assignedInvoice;
    } catch (error) {
      this.logger.error(
        `❌ Error assigning invoice to user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Save corrected invoice data from manual validation
   * Updates field values without overwriting the original OCR data
   *
   * @param saveInvoiceDto - Invoice data with corrections
   * @returns Result with delivery status
   */
  async saveCorrectedInvoice(saveInvoiceDto: any): Promise<any> {
    try {
      const { userId, invoiceId, encabezado, detalles } = saveInvoiceDto;

      this.logger.log(
        `💾 Saving corrected invoice ${invoiceId} by user ${userId}`,
      );

      // Verify the invoice is assigned to this user
      const document = await this.prisma.document.findFirst({
        where: {
          documentId: invoiceId,
          assignedUserId: userId,
        },
      });

      if (!document) {
        throw new Error(
          `Invoice ${invoiceId} is not assigned to user ${userId}`,
        );
      }

      // Update fields with corrected values
      // We'll add new records with the corrected values instead of overwriting
      const correctedHeaderFields = encabezado.map((field: any) => ({
        invoiceId: document.documentId,
        name: field.type,
        value: field.text,
        confidence: field.confidence,
        type: 'ENCABEZADO',
        extracted: false, // Mark as manually entered
        validated: true,
      }));

      const correctedDetailFields = detalles.map((field: any) => ({
        invoiceId: document.documentId,
        row: field.row,
        name: field.type,
        value: field.text,
        confidence: field.confidence,
        type: 'DETALLE',
        extracted: false, // Mark as manually entered
        validated: true,
      }));

      // Delete old fields and insert corrected ones in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Delete existing fields
        await tx.field.deleteMany({
          where: { documentId: document.documentId },
        });

        // Insert corrected fields
        await tx.field.createMany({
          data: [...correctedHeaderFields, ...correctedDetailFields],
        });
      });

      // Update invoice JSON with corrected data
      const correctedData = {
        encabezado: encabezado.map((f: any) => ({
          type: f.type,
          text: f.text,
          confidence: f.confidence,
        })),
        detalles: detalles.map((f: any) => ({
          type: f.type,
          text: f.text,
          confidence: f.confidence,
          row: f.row,
        })),
      };

      // Calculate confidence to determine if we should auto-deliver
      const headerConfidence =
        encabezado.length > 0
          ? (encabezado.reduce((sum: number, f: any) => sum + f.confidence, 0) /
              encabezado.length) *
            100
          : 0;

      const detailsConfidence =
        detalles.length > 0
          ? (detalles.reduce((sum: number, f: any) => sum + f.confidence, 0) /
              detalles.length) *
            100
          : 0;

      const overallConfidence =
        headerConfidence * 0.4 + detailsConfidence * 0.6;
      const isFullConfidence = Math.round(overallConfidence) === 100;

      let delivered = false;
      let newStatus = 'VALIDATED';

      // If 100% confidence, auto-deliver to Meiko tables
      if (isFullConfidence) {
        try {
          // Get original Meiko invoice data
          const meikoInvoice = await this.prisma.document.findUnique({
            where: { id: document.id },
          });

          if (meikoInvoice) {
            await this.deliverToMeikoTables(
              invoiceId,
              meikoInvoice,
              correctedData,
            );
            newStatus = 'DELIVERED';
            delivered = true;
            this.logger.log(
              `🚀 Invoice ${invoiceId} auto-delivered with 100% confidence`,
            );
          }
        } catch (deliveryError) {
          this.logger.error(
            `❌ Auto-delivery failed for invoice ${invoiceId}: ${deliveryError.message}`,
          );
          newStatus = 'PENDING_TO_SEND';
        }
      }

      // Update invoice status
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          mayaDocumentJSON: JSON.stringify(correctedData),
          validated: true,
          status: newStatus,
          completedAt: new Date(),
          captureEndDate: new Date(),
        },
      });

      this.logger.log(`✅ Invoice ${invoiceId} saved with status ${newStatus}`);

      return {
        success: true,
        message: delivered
          ? 'Invoice saved and delivered successfully'
          : 'Invoice saved successfully',
        invoiceId,
        delivered,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error saving corrected invoice: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
