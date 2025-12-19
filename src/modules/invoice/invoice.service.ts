import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp'; // 🧠 Used to validate image integrity
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma } from '@generated/client';

import { IMAGE_DPI } from 'src/constants/business';
import { InvoiceStatus } from '../meiko/enums/status.enum';
import { DateTime } from 'luxon';
import { Utils } from '../validator/documents/utils';
import { MeikoService } from '../meiko/meiko.service';
import {
  DocumentFactory,
  ProcessedDataSchema,
  SupportedInvoiceType,
} from '../validator/documents/base/document.factory';
import { PrismaMeikoService } from 'src/database/services/prisma-meiko.service';
import { InvoiceUtils } from './utils/Invoice.utils';
import { Fields } from '../validator/enums/fields';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaMeikoService: PrismaMeikoService,
    private readonly meikoService: MeikoService,
  ) {}

  createFactura(doc : Prisma.MeikoDocumentCreateArgs){
    return this.prisma.meikoDocument.create(doc)
  }

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
    const { id, ...data } = document;
    return this.prisma.document.updateMany({
      where: { id },
      data: data,
    });
  }

  getDocument(id: number) {
    return this.prisma.document.findUnique({
      where: { id },
    });
  }

  getDocuments(args: Prisma.DocumentFindManyArgs) {
    return this.prisma.document.findMany(args);
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

  /**
   * Count documents by status
   * @param status - Document status to count
   * @returns Number of documents with the specified status
   */
  async countByStatus(status: string): Promise<number> {
    try {
      const count = await this.prisma.document.count({
        where: {
          status,
        },
      });

      return count;
    } catch (error) {
      this.logger.error(
        `Error counting documents by status ${status}: ${error.message}`,
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
    return this.prisma.document.createManyAndReturn({
      data: documents,
      skipDuplicates: true,
    });
  }

  async downloadAndValidate(
    invoice: any,
    targetDir: string,
  ): Promise<{ isValid: boolean; path: string }> {
    const extension = '.jpg';
    const finalPath = this.generateFinalPath(
      targetDir,
      `${invoice.id}${extension}`,
    );

    try {
      this.logger.log(`🟡 Processing invoice ID ${invoice.id}`);

      const data = await this.downloadImage(invoice.documentUrl);

      this.logger.log(`🟡 Downloaded `);
      await this.saveTempFile(finalPath, data);

      this.logger.log(`🟡 Saved `);
      await this.validateImage(finalPath);

      this.logger.log(`🟡 Validated `);
      // Resize image with specified DPI
      // await this.resizeImageWithDPI(tempFile, finalPath);

      // this.updateInvoiceMetadata(invoice, finalPath, extension);

      this.logger.log(
        `✅ Invoice ${invoice.id_factura} processed successfully`,
      );
      return { path: finalPath, isValid: true };
    } catch (error) {
      this.logger.error(
        `❌ Error processing invoice ${invoice.id_factura}: ${error.message}`,
      );
      // await this.cleanupTempFile(tempFile);
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
    mayaInvoiceJson: ProcessedDataSchema,
    mayaInvoiceJsonRaw: {
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
        mayaDocumentJSON: JSON.stringify(mayaInvoiceJsonRaw),
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
      const meikoInvoice = await this.prismaMeikoService.invoice.create({
        data: {
          surveyRecordId: BigInt(meikoInvoiceData.surveyRecordId || 0),
          responseId: meikoInvoiceData.responseId
            ? BigInt(meikoInvoiceData.responseId)
            : null,
          stickerQR: meikoInvoiceData.stickerQR || null,
          responseReceived: meikoInvoiceData.responseReceived || null,
          variableName: meikoInvoiceData.variableName || null,
          photoType: meikoInvoiceData.photoType || null,
          link: meikoInvoiceData.link || null,
          flagDigitalization: 1, // Mark as digitalized
          digitalizationDate: new Date(),
          extractionDate: new Date(),
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

        if (fields.total_factura_sin_iva?.text === '[ILEGIBLE]') {
          fields.total_factura_sin_iva.text = '-0.1';
        }
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
        await this.prismaMeikoService.result.createMany({
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
   * Get invoice with fields from the Field table
   * @param documentId - Document ID
   * @returns Invoice data with encabezado and detalles from Field table
   */
  async getInvoiceWithFields(documentId: number): Promise<{
    encabezado: Array<{ type: string; text: string; confidence: number }>;
    detalles: Array<{
      type: string;
      text: string;
      confidence: number;
      row: number;
    }>;
  }> {
    try {
      this.logger.log(`🔍 Getting fields for document ${documentId}`);

      // Get all fields for this document
      const fields = await this.prisma.field.findMany({
        where: {
          documentId,
        },
        orderBy: [{ type: 'asc' }, { row: 'asc' }],
      });

      // Separate fields into encabezado and detalles
      const encabezado = fields
        .filter((field) => field.type === 'ENCABEZADO')
        .map((field) => ({
          id: field.id,
          type: field.name,
          text: field.value || '',
          confidence: field.confidence ? Number(field.confidence) : 0,
        }));

      const detalles = fields
        .filter((field) => field.type === 'DETALLE')
        .map((field) => ({
          id: field.id,
          type: field.name,
          text: field.value || '',
          confidence: field.confidence ? Number(field.confidence) : 0,
          row: field.row || 0,
        }));

      this.logger.log(
        `✅ Retrieved ${encabezado.length} header fields and ${detalles.length} detail fields`,
      );

      return {
        encabezado,
        detalles,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting fields for document ${documentId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Assign an invoice to a user for manual validation
   * If the user already has an assigned invoice, return that one
   * Otherwise, assign the next available invoice with status PENDING_VALIDATION
   *
   * @param userId - User ID to assign invoice to
   * @returns Assigned invoice or null if none available
   */
  async assignInvoiceToUser(userId: number) {
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
          documentId: 'asc', // Oldest first
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
   * Mark invoice as outdated and update its status
   * Inserts record in EstadoDigitalizacionFactura and updates Document status to DELIVERED
   *
   * @param invoiceId - Invoice ID to mark as outdated
   * @returns Success response
   */
  async markAsOutdated(invoiceId: number): Promise<any> {
    try {
      this.logger.log(`🔄 Marking invoice ${invoiceId} as outdated`);

      // Find the document by documentId
      const document = await this.prisma.document.findUnique({
        where: { documentId: invoiceId },
      });

      if (!document) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      // Insert into EstadoDigitalizacionFactura (status 1 = outdated)
      await this.prismaMeikoService.estadoDigitalizacionFactura.upsert({
        where: {
          invoiceId,
        },
        update: {
          digitalizationStatusId: InvoiceStatus.FECHA_NO_VALIDA,
        },
        create: {
          invoiceId,
          digitalizationStatusId: InvoiceStatus.FECHA_NO_VALIDA, // Status for outdated
        },
      });

      // Update Document status to DELIVERED
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'DELIVERED',
          completedAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice ${invoiceId} marked as outdated`);

      return {
        success: true,
        message: 'Invoice marked as outdated successfully',
        invoiceId,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error marking invoice ${invoiceId} as outdated: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async markAsNotApplyStudy(invoiceId: number): Promise<any> {
    try {
      this.logger.log(`🔄 Marking invoice ${invoiceId} as not apply study`);

      // Find the document by documentId
      const document = await this.prisma.document.findUnique({
        where: { documentId: invoiceId },
      });

      if (!document) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      await this.prismaMeikoService.estadoDigitalizacionFactura.upsert({
        where: {
          invoiceId,
        },
        update: {
          digitalizationStatusId: InvoiceStatus.NO_APLICA_PARA_EL_ESTUDIO,
        },
        create: {
          invoiceId,
          digitalizationStatusId: InvoiceStatus.NO_APLICA_PARA_EL_ESTUDIO, // Status for outdated
        },
      });

      // Update Document status to DELIVERED
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'DELIVERED',
          completedAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice ${invoiceId} marked as outdated`);

      return {
        success: true,
        message: 'Invoice marked as outdated successfully',
        invoiceId,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error marking invoice ${invoiceId} as outdated: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async omitDocument(documentId: number) {
    try {
      this.logger.log(`🔄 Marking invoice ${documentId} as omitted`);

      const document = await this.prisma.document.findUnique({
        where: { documentId },
      });

      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }

      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'ISSUE',
          completedAt: new Date(),
        },
      });

      this.logger.log(`✅ Document ${documentId} marked as omitted`);

      return {
        success: true,
        message: 'Document omitted',
        invoiceId: documentId,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error omitting document ${documentId} Error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark invoice as illegible and update its status
   * Inserts record in EstadoDigitalizacionFactura and updates Document status to DELIVERED
   *
   * @param invoiceId - Invoice ID to mark as illegible
   * @returns Success response
   */
  async markAsIllegible(invoiceId: number): Promise<any> {
    try {
      this.logger.log(`🔄 Marking invoice ${invoiceId} as illegible`);

      // Find the document by documentId
      const document = await this.prisma.document.findUnique({
        where: { documentId: invoiceId },
      });

      if (!document) {
        throw new Error(`Invoice ${invoiceId} not found`);
      }

      await this.prismaMeikoService.estadoDigitalizacionFactura.upsert({
        where: {
          invoiceId,
        },
        update: {
          digitalizationStatusId: InvoiceStatus.NO_PROCESABLE,
        },
        create: {
          invoiceId,
          digitalizationStatusId: InvoiceStatus.NO_PROCESABLE, // Status for outdated
        },
      });

      // Update Document status to DELIVERED
      await this.prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'DELIVERED',
          completedAt: new Date(),
        },
      });

      this.logger.log(`✅ Invoice ${invoiceId} marked as illegible`);

      return {
        success: true,
        message: 'Invoice marked as illegible successfully',
        invoiceId,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error marking invoice ${invoiceId} as illegible: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateField(
    name: string,
    documentId: number,
    row: number | null,
    updates: Partial<Prisma.FieldUpdateInput>,
  ): Promise<void> {
    const field = await this.prisma.field.findFirst({
      where: { name, documentId, row },
    });

    if (!field)
      throw new Error(
        `Field ${name} not found for document ${documentId} and row ${row}`,
      );

    await this.prisma.field.update({
      where: { id: field.id },
      data: updates,
    });
  }

  async releaseUnresolvedInvoices(): Promise<number> {
    try {
      const fortyMinutesAgo = DateTime.now().minus({ minutes: 40 }).toJSDate();

      const unresolvedInvoices = await this.prisma.document.findMany({
        where: {
          status: 'IN_CAPTURE',
          assignedAt: {
            lt: fortyMinutesAgo,
          },
          completedAt: null,
        },
      });

      if (unresolvedInvoices.length === 0) {
        return 0;
      }

      this.logger.log(
        `🔓 Found ${unresolvedInvoices.length} invoices to release`,
      );

      // Release all unresolved invoices
      const result = await this.prisma.document.updateMany({
        where: {
          status: 'IN_CAPTURE',
          assignedAt: {
            lt: fortyMinutesAgo,
          },
          completedAt: null,
        },
        data: {
          status: 'PENDING_VALIDATION',
          assignedUserId: null,
          assignedAt: null,
          captureStartDate: null,
        },
      });

      this.logger.log(
        `✅ Released ${result.count} invoices that exceeded 40 minutes without resolution`,
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        `❌ Error releasing unresolved invoices: ${error.message}`,
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
  async saveCorrectedInvoice(saveInvoiceDto: {
    userId: number;
    invoiceId: number;
    encabezado: any;
    detalles: any;
    tipoFactura: string;
  }): Promise<any> {
    try {
      const { userId, invoiceId, encabezado, detalles } = saveInvoiceDto;

      this.logger.log(
        `💾 Saving corrected invoice ${invoiceId} by user ${userId}`,
      );
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

      if (!document?.surveyId) {
        throw new Error(`Invoice ${invoiceId} has no surveyId`);
      }

      const result = DocumentFactory.format(
        saveInvoiceDto.tipoFactura || 'Not supported',
        {
          detalles,
          encabezado,
          facturaId: invoiceId,
          surveyRecordId: Number(document.surveyId),
        },
        this.meikoService,
        this,
      );

      const headers = encabezado;

      await this.meikoService.createManyFields(result);

      const fields = [...headers, ...detalles];

      // Process field updates and creations
      for (const field of fields) {
        if (field.id) {
          // Update existing field using its ID
          await this.prisma.field.update({
            where: { id: field.id },
            data: {
              corrected_value: field.text,
              validated: true,
            },
          });
        } else {
          // Create new field (created in frontend)
          await this.prisma.field.create({
            data: {
              documentId: document.documentId,
              row: field.row || null,
              name: field.type,
              value: field.text,
              corrected_value: field.text,
              confidence: field.confidence || 1,
              type: field.row ? 'DETALLE' : 'ENCABEZADO',
              extracted: false,
              validated: true,
            },
          });
        }
      }

      await this.meikoService.createStatus({
        digitalizationStatusId: InvoiceStatus.PROCESADO,
        invoiceId: document.documentId,
      });

      await this.updateDocument({
        id: document.id,
        status: 'DELIVERED',
        validated: true,
        captureEndDate: new Date(),
        completedAt: new Date(),
      });
    } catch (deliveryError) {
      const { userId, invoiceId } = saveInvoiceDto;

      const document = await this.prisma.document.findFirst({
        where: {
          documentId: invoiceId,
          assignedUserId: userId,
        },
      });

      if (!document) return;

      await this.updateDocument({
        id: document.id,
        status: 'ISSUE',
        errors: `DELIVERY_ERROR: ${deliveryError.message}`,
        captureEndDate: new Date(),
        completedAt: new Date(),
      });

      this.logger.error(
        `❌ Error saving corrected invoice ${saveInvoiceDto.invoiceId}: ${deliveryError.message}`,
        deliveryError.stack,
      );
    }
  }

  async testInvoice(
    tipoFoto: any,
    testInvoice: { encabezado; detalles; tipoFacturaOcr },
  ) {
    try {
      let finalType: string;
      const photoTypeOcr = testInvoice.tipoFacturaOcr;

      const photoType = tipoFoto;

      if (
        photoType === 'Factura Postobon' &&
        photoTypeOcr === 'Factura Tiquete POS Postobon'
      ) {
        finalType = photoTypeOcr;
      } else finalType = photoType;

      const document = DocumentFactory.create(
        finalType,
        {
          encabezado: testInvoice.encabezado,
          detalles: testInvoice.detalles,
          surveyRecordId: 9999999,
          facturaId: 999999,
        },
        this.meikoService,
        this,
      );
      await document.process();

      const { data, isValid } = document.get();

      return InvoiceUtils.getErrors(data);
    } catch (error) {
      this.logger.error(
        `❌ Error testing invoice: ${error.message}`,
        error.stack,
      );
      return {
        error: error.message,
      };
    }
  }

  async reportDeliveredByUser() {
    try {
      this.logger.log('📊 Generating report: Delivered documents by user');

      const result = await this.prisma.document.groupBy({
        by: ['assignedUserId'],
        where: {
          status: 'DELIVERED',
          assignedUserId: {
            not: null,
          },
        },
        _count: {
          assignedUserId: true,
        },
      });

      // Get user names
      const reportWithUserNames = await Promise.all(
        result.map(async (item) => {
          if (!item.assignedUserId) {
            return {
              total: item._count.assignedUserId,
              name: 'Unknown',
            };
          }

          const user = await this.prisma.user.findUnique({
            where: { id: item.assignedUserId },
            select: { name: true },
          });

          return {
            total: item._count.assignedUserId,
            name: user?.name || 'Unknown',
          };
        }),
      );

      this.logger.log(
        `✅ Report generated: ${reportWithUserNames.length} users with delivered documents`,
      );

      return reportWithUserNames;
    } catch (error) {
      this.logger.error(
        `❌ Error generating delivered by user report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async reportByStatus() {
    try {
      this.logger.log('📊 Generating report: Documents by status');

      const result = await this.prisma.document.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      const report = result.reduce(
        (acc, row) => {
          acc[row.status] = row._count.status;
          return acc;
        },
        {} as Record<string, number>,
      );

      this.logger.log(`✅ Report generated successfully`);
      return report;

      return report;
    } catch (error) {
      this.logger.error(
        `❌ Error generating status report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getMissing(startDate: string, endDate: string) {
    try {
      const missing = await this.meikoService.getInvoicesByDateRange(
        startDate,
        endDate,
      );
      return missing;
    } catch (error) {
      this.logger.error(
        `❌ Error generating status report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getActiveUsers() {
    try {
      this.logger.log('📊 Getting active users with assigned documents');

      // Find all documents that are currently assigned (IN_CAPTURE or PENDING_VALIDATION with assigned user)
      const activeDocuments = await this.prisma.document.findMany({
        where: {
          assignedUserId: {
            not: null,
          },
          status: {
            in: ['IN_CAPTURE', 'PENDING_VALIDATION'],
          },
          completedAt: null,
        },
        select: {
          assignedUserId: true,
          assignedAt: true,
          status: true,
          documentId: true,
        },
        distinct: ['assignedUserId'],
      });

      // Get user details for each active user
      const activeUsers = await Promise.all(
        activeDocuments.map(async (doc) => {
          if (!doc.assignedUserId) return null;

          const user = await this.prisma.user.findUnique({
            where: { id: doc.assignedUserId },
            select: {
              id: true,
              name: true,
              email: true,
            },
          });

          if (!user) return null;

          // Count total documents assigned to this user
          const assignedCount = await this.prisma.document.count({
            where: {
              assignedUserId: doc.assignedUserId,
              status: {
                in: ['IN_CAPTURE', 'PENDING_VALIDATION'],
              },
              completedAt: null,
            },
          });

          return {
            userId: user.id,
            name: user.name,
            email: user.email,
            assignedDocumentsCount: assignedCount,
            lastAssignedAt: doc.assignedAt,
            currentStatus: doc.status,
          };
        }),
      );

      // Filter out nulls
      const filteredUsers = activeUsers.filter((user) => user !== null);

      this.logger.log(
        `✅ Found ${filteredUsers.length} active users with assigned documents`,
      );

      return filteredUsers;
    } catch (error) {
      this.logger.error(
        `❌ Error getting active users: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
