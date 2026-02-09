import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp'; // 🧠 Used to validate image integrity
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma, Product } from '@generated/client';

import { IMAGE_DPI } from 'src/constants/business';
import { DeliveryStatus, InvoiceStatus } from '../meiko/enums/status.enum';
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
import { ExcludedService } from '../excluded/excluded.service';
import { ProductService } from '../product/product.service';
import { StringUtils } from 'src/utils/string.utils';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaMeikoService: PrismaMeikoService,
    private readonly meikoService: MeikoService,
    private readonly excludedService: ExcludedService,
    private readonly productService: ProductService,
  ) {}

  createFactura(doc: Prisma.MeikoDocumentCreateArgs) {
    return this.prisma.meikoDocument.create(doc);
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

  async getProductByFuzzyDescription(
    description: string,
  ): Promise<Product | null> {
    const threshold = 3;

    const products = await this.prisma.$queryRaw<Product[]>`
      SELECT * FROM "product"
      WHERE levenshtein("description", ${description}) <= ${threshold}
      ORDER BY levenshtein("description", ${description}) ASC
      LIMIT 1;
  `;

    return products[0] || null;
  }

  getProduct(data: Prisma.ProductWhereInput): Promise<Product | null> {
    return this.prisma.product.findFirst({
      where: data,
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
    const tempFile = this.generateTempFilePath();

    try {
      this.logger.log(`🟡 Processing invoice ID ${invoice.id}`);

      // Download image
      const data = await this.downloadImage(invoice.documentUrl);
      this.logger.log(`🟡 Downloaded image for invoice ${invoice.id}`);

      // Save to temporary file
      await this.saveTempFile(tempFile, data);
      this.logger.log(`🟡 Saved to temporary file`);

      // Validate image integrity
      await this.validateImage(tempFile);
      this.logger.log(`🟡 Validated image`);

      // Move to final path (this saves the image permanently)
      await this.moveToFinalPath(tempFile, finalPath);
      this.logger.log(`🟡 Moved to final path: ${finalPath}`);

      this.logger.log(
        `✅ Invoice ${invoice.id_factura} processed successfully`,
      );
      return { path: finalPath, isValid: true };
    } catch (error) {
      this.logger.error(
        `❌ Error processing invoice ${invoice.id_factura}: ${error.message}`,
      );
      // Cleanup temp file if it exists
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
          coords: field.coords ? JSON.stringify(field.coords) : null,
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
          coords: field.coords ? JSON.stringify(field.coords) : null,
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
          text: field.corrected_value || field.value || '',
          confidence: field.confidence ? Number(field.confidence) : 0,
          coords: field.coords ? JSON.parse(field.coords) : [],
        }));

      const detalles = fields
        .filter((field) => field.type === 'DETALLE')
        .map((field) => ({
          id: field.id,
          type: field.name,
          text: field.corrected_value || field.value || '',
          confidence: field.confidence ? Number(field.confidence) : 0,
          row: field.row || 0,
          coords: field.coords ? JSON.parse(field.coords) : [],
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
   * Get invoice with corrected fields from the Field table
   * Uses corrected_value instead of value when available
   * @param documentId - Document ID
   * @returns Invoice data with encabezado and detalles using corrected values
   */
  async getInvoiceWithCorrectedFields(documentId: number): Promise<{
    encabezado: Array<{ type: string; text: string; confidence: number }>;
    detalles: Array<{
      type: string;
      text: string;
      confidence: number;
      row: number;
    }>;
  }> {
    try {
      this.logger.log(`🔍 Getting corrected fields for document ${documentId}`);

      // Get all fields for this document
      const fields = await this.prisma.field.findMany({
        where: {
          documentId,
        },
        orderBy: [{ type: 'asc' }, { row: 'asc' }],
      });

      // Separate fields into encabezado and detalles, using corrected_value when available
      const encabezado = fields
        .filter((field) => field.type === 'ENCABEZADO')
        .map((field) => ({
          type: field.name,
          text: field.corrected_value || '',
          confidence: field.confidence ? Number(field.confidence) : 0,
        }));

      const detalles = fields
        .filter((field) => field.type === 'DETALLE')
        .map((field) => ({
          type: field.name,
          text: field.corrected_value || '',
          confidence: field.confidence ? Number(field.confidence) : 0,
          row: field.row || 0,
        }));

      this.logger.log(
        `✅ Retrieved ${encabezado.length} header fields and ${detalles.length} detail fields with corrected values`,
      );

      return {
        encabezado,
        detalles,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting corrected fields for document ${documentId}: ${error.message}`,
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
          deliveryStatus: DeliveryStatus.FECHA_NO_VALIDA,
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
          deliveryStatus: DeliveryStatus.NO_APLICA_PARA_EL_ESTUDIO,
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
          deliveryStatus: DeliveryStatus.NO_PROCESABLE,
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
    const { userId, invoiceId, encabezado, detalles } = saveInvoiceDto;

    try {
      this.logger.log(`Saving corrected invoice ${invoiceId} by user ${userId}`);

      const document = await this.prisma.document.findFirst({
        where: {
          documentId: invoiceId,
          assignedUserId: userId,
        },
      });

      if (!document) {
        throw new Error(`Invoice ${invoiceId} is not assigned to user ${userId}`);
      }

      if (!document.surveyId) {
        throw new Error(`Invoice ${invoiceId} has no surveyId`);
      }

      // Combine header and detail fields
      const fields = [...encabezado, ...detalles];
      const incomingIds = fields.filter((f) => f.id).map((f) => f.id);

      // Get existing fields
      const existingFields = await this.prisma.field.findMany({
        where: { documentId: document.documentId },
        select: { id: true, value: true },
      });

      const existingIds = existingFields.map((f) => f.id);
      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      // Delete removed fields
      if (idsToDelete.length > 0) {
        this.logger.log(
          `Deleting ${idsToDelete.length} fields no longer present, documentId = ${document.documentId}`,
        );
        await this.prisma.field.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      const existingFieldsMap = new Map(
        existingFields.map((f) => [f.id, f.value]),
      );

      // Identify completely new product rows (all fields in the row have no id)
      const rowFieldsMap = new Map<number, boolean[]>();
      for (const field of fields) {
        if (field.row) {
          const existing = rowFieldsMap.get(field.row) || [];
          existing.push(!field.id);
          rowFieldsMap.set(field.row, existing);
        }
      }
      const newProductRows = new Set<number>();
      for (const [row, isNewFlags] of rowFieldsMap) {
        if (isNewFlags.every((isNew) => isNew)) {
          newProductRows.add(row);
        }
      }

      // Process field updates and creations
      for (const field of fields) {
        if (field.id) {
          // Update existing field using its ID
          const currentValue = existingFieldsMap.get(field.id);
          const hasSignificantChange = StringUtils.hasSignificantChange(
            currentValue,
            field.text,
          );

          await this.prisma.field.update({
            where: { id: field.id },
            data: {
              corrected_value: hasSignificantChange ? field.text : currentValue,
              validated: true,
            },
          });
        } else {
          // Create new field (created in frontend)
          // If the row is completely new (all fields are new), mark as NEW_PRODUCT
          const isNewProduct = field.row && newProductRows.has(field.row);
          await this.prisma.field.create({
            data: {
              documentId: document.documentId,
              row: field.row || null,
              name: field.type,
              value: isNewProduct ? 'NEW_PRODUCT' : '',
              corrected_value: field.text,
              confidence: field.confidence || 1,
              type: field.row ? 'DETALLE' : 'ENCABEZADO',
              extracted: false,
              validated: true,
            },
          });
        }
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
        this.excludedService,
        this.productService,
      );

      try {
        await this.meikoService.createManyFields(result);
      } catch (error) {
        await this.updateDocument({
          id: document.id,
          status: 'PENDING_TO_SEND',
          completedAt: new Date(),
          deliveryStatus: DeliveryStatus.PROCESADO,
          errors: `Base de datos Meiko no disponible: ${error.message}`,
        });
        this.logger.error(
          `❌ Error delivering invoice ${saveInvoiceDto.invoiceId} to Meiko: ${error.message}`,
          error.stack,
        );
        return;
      }

      await this.meikoService.createStatus({
        digitalizationStatusId: InvoiceStatus.PROCESADO,
        invoiceId: document.documentId,
      });

      await this.updateDocument({
        id: document.id,
        status: 'DELIVERED',
        deliveryStatus: DeliveryStatus.PROCESADO,
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

      throw new InternalServerErrorException(
        'Error inesperado. Por favor, comuníquese con soporte.',
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

      if (photoTypeOcr === 'Factura Otros Proveedores')
        finalType = 'Factura Otros Proveedores';

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
        this.excludedService,
        this.productService,
      );
      await document.process();

      const { data, isValid } = document.get();

      const a = InvoiceUtils.getErrors(data);
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
  async retryFailedInvoices(): Promise<number> {
    try {
      this.logger.log('🔄 Checking for failed invoices to retry...');

      const result = await this.prisma.document.updateMany({
        where: {
          deliveryStatus: DeliveryStatus.ERROR_DE_DESCARGA,
        },
        data: {
          status: 'REPROCESS',
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `✅ Reset status to REPROCESS for ${result.count} documents with download errors`,
        );
      }

      return result.count;
    } catch (error) {
      this.logger.error(
        `❌ Error retrying failed invoices: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send pending documents to Meiko
   * Processes documents in PENDING_TO_SEND status and delivers them using corrected field values
   * @returns Number of documents successfully sent
   */
  async sendPendingDocuments(): Promise<number> {
    try {
      this.logger.log('📤 Checking for pending documents to send...');

      // Get all documents with PENDING_TO_SEND status
      const pendingDocuments = await this.prisma.document.findMany({
        where: {
          status: 'PENDING_TO_SEND',
        },
        orderBy: {
          id: 'asc',
        },
      });

      if (pendingDocuments.length === 0) {
        return 0;
      }

      this.logger.log(
        `📋 Found ${pendingDocuments.length} documents to send to Meiko`,
      );

      let successCount = 0;

      for (const document of pendingDocuments) {
        try {
          this.logger.log(
            `📤 Processing document ${document.documentId} (${document.photoType})`,
          );

          if (!document.surveyId) {
            throw new Error(`Document ${document.documentId} has no surveyId`);
          }

          // Get corrected fields from Field table
          const { encabezado, detalles } =
            await this.getInvoiceWithCorrectedFields(document.documentId);

          // Build invoice data using DocumentFactory
          const result = DocumentFactory.format(
            document.photoType || 'Not supported',
            {
              detalles: detalles as any,
              encabezado: encabezado as any,
              facturaId: document.documentId,
              surveyRecordId: Number(document.surveyId),
            } as ProcessedDataSchema,
            this.meikoService,
            this,
            this.excludedService,
            this.productService,
          );

          // Send to Meiko
          await this.meikoService.createManyFields(result);

          // Update status in Meiko
          await this.meikoService.createStatus({
            digitalizationStatusId: InvoiceStatus.PROCESADO,
            invoiceId: document.documentId,
          });

          // Update document status to DELIVERED
          await this.updateDocument({
            id: document.id,
            status: 'DELIVERED',
            deliveryStatus: DeliveryStatus.PROCESADO,
          });

          this.logger.log(
            `✅ Document ${document.documentId} delivered successfully`,
          );
          successCount++;
        } catch (error) {
          this.logger.error(
            `❌ Error sending document ${document.documentId}: ${error.message}`,
            error.stack,
          );

          // Update document with error status
          await this.updateDocument({
            id: document.id,
            status: 'ISSUE',
            errors: `DELIVERY_ERROR: ${error.message}`,
          });
        }
      }

      this.logger.log(
        `✅ Successfully sent ${successCount}/${pendingDocuments.length} documents to Meiko`,
      );

      return successCount;
    } catch (error) {
      this.logger.error(
        `❌ Error in sendPendingDocuments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get invoice image file as buffer
   * Reads the image file from the storage directory and returns it as a buffer
   * @param filename - Name of the image file (e.g., "76826.jpg")
   * @returns Image file as Buffer
   */
  async getInvoiceImage(filename: string): Promise<Buffer> {
    try {
      const targetDir = process.env.INVOICE_IMAGES_DIR || './invoices';
      const filePath = path.join(targetDir, filename);

      this.logger.log(`📷 Reading image file: ${filePath}`);

      // Check if file exists and read it
      const imageBuffer = await fs.readFile(filePath);

      this.logger.log(`✅ Image file read successfully: ${filename}`);

      return imageBuffer;
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`⚠️ Image file not found: ${filename}`);
        throw new Error(`Image file not found: ${filename}`);
      }

      this.logger.error(
        `❌ Error reading image file ${filename}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete old invoice images that are older than 3 days
   * This helps manage storage space by removing outdated files
   * @param targetDir - Directory where invoice images are stored
   * @returns Number of files deleted
   */
  /**
   * Get user statistics for the current fortnight period
   * Returns count of processed documents and modified/created products
   * @param userId - User ID to get statistics for
   * @returns Statistics object with documents and products counts
   */
  async getUserStats(
    userId: number,
    year?: number,
    month?: number,
    fortnight?: 1 | 2,
  ): Promise<{
    userId: number;
    periodStart: Date;
    periodEnd: Date;
    documentsProcessed: number;
    productsModified: number;
  }> {
    try {
      this.logger.log(
        `📊 Getting stats for user ${userId}, year=${year}, month=${month}, fortnight=${fortnight}`,
      );

      // Calculate fortnight period based on params or current date
      const now = DateTime.now();
      let periodStart: DateTime;
      let periodEnd: DateTime;

      if (year && month && fortnight) {
        // Use provided params
        const baseDate = DateTime.fromObject({ year, month, day: 1 });
        if (fortnight === 1) {
          periodStart = baseDate.startOf('month');
          periodEnd = baseDate.set({ day: 15 }).endOf('day');
        } else {
          periodStart = baseDate.set({ day: 16 }).startOf('day');
          periodEnd = baseDate.endOf('month');
        }
      } else {
        // Use current date (default behavior)
        const day = now.day;
        if (day <= 15) {
          periodStart = now.startOf('month');
          periodEnd = now.set({ day: 15 }).endOf('day');
        } else {
          periodStart = now.set({ day: 16 }).startOf('day');
          periodEnd = now.endOf('month');
        }
      }

      const startDate = periodStart.toJSDate();
      const endDate = periodEnd.toJSDate();

      // Count documents processed by user in this period
      const documentsProcessed = await this.prisma.document.count({
        where: {
          assignedUserId: userId,
          deliveryStatus: 'PROCESADO',
          completedAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      // Check if this is January 2026 (special case)
      const isJanuary2026 =
        periodStart.year === 2026 && periodStart.month === 1;

      let productsModified: number;

      if (isJanuary2026) {
        // Special case for January 2026: sum of corrected products + new products
        productsModified = await this.getJanuary2026Products(
          userId,
          startDate,
          endDate,
        );
      } else {
        // General case: count distinct products modified by user
        const productsResult = await this.prisma.$queryRaw<
          [{ total_products: bigint }]
        >`
          SELECT COUNT(DISTINCT (f.document_id, f.row)) AS total_products
          FROM "document" d
          JOIN "field" f ON d.document_id = f.document_id
          WHERE d.assigned_user_id = ${userId}
            AND d.completed_at >= ${startDate}
            AND d.completed_at <= ${endDate}
            AND f.corrected_value IS DISTINCT FROM f.value
            AND f.row IS NOT NULL
            AND d.delivery_status = 'PROCESADO'
        `;
        productsModified = Number(productsResult[0]?.total_products ?? 0);
      }

      this.logger.log(
        `✅ Stats for user ${userId}: ${documentsProcessed} documents, ${productsModified} products modified`,
      );

      return {
        userId,
        periodStart: startDate,
        periodEnd: endDate,
        documentsProcessed,
        productsModified,
      };
    } catch (error) {
      this.logger.error(
        `❌ Error getting stats for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Special calculation for January 2026 fortnights
   * Returns the sum of corrected products + new products
   */
  private async getJanuary2026Products(
    userId: number,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    // Query 1: Count corrected products (corrected_value <> value)
    const correctedResult = await this.prisma.$queryRaw<
      [{ corrected_products: bigint }]
    >`
      SELECT COUNT(DISTINCT ("row", f.document_id)) AS corrected_products
      FROM public.field f
      JOIN "document" d ON f.document_id = d.document_id AND d.delivery_status = 'PROCESADO'
      WHERE f.created_at >= ${startDate}
        AND f.created_at < ${endDate}
        AND d.assigned_user_id = ${userId}
        AND "row" IS NOT NULL
        AND d.assigned_user_id IS NOT NULL
        AND corrected_value <> value
    `;

    // Query 2: Count new products (rows created after header)
    const newProductsResult = await this.prisma.$queryRaw<
      [{ new_products: bigint }]
    >`
      WITH header AS (
        SELECT
          field.document_id,
          MAX(field.created_at) AS header_created_at
        FROM public.field
        JOIN public.document ON public.document.document_id = public.field.document_id
        WHERE type = 'ENCABEZADO'
          AND assigned_user_id = ${userId}
        GROUP BY field.document_id
      ),
      product_rows AS (
        SELECT
          f.document_id,
          f."row",
          MIN(f.created_at) AS row_created_at
        FROM field f
        WHERE f."row" IS NOT NULL
          AND f.created_at >= ${startDate}
          AND f.created_at < ${endDate}
        GROUP BY f.document_id, f."row"
      ),
      new_product_rows AS (
        SELECT DISTINCT
          r.document_id,
          r."row"
        FROM product_rows r
        JOIN header h ON h.document_id = r.document_id
        WHERE r.row_created_at > h.header_created_at
          AND r.row_created_at >= ${startDate}
          AND r.row_created_at < ${endDate}
      )
      SELECT COUNT(*) AS new_products
      FROM new_product_rows
    `;

    const correctedProducts = Number(
      correctedResult[0]?.corrected_products ?? 0,
    );
    const newProducts = Number(newProductsResult[0]?.new_products ?? 0);

    this.logger.log(
      `📊 January 2026 special case - Corrected: ${correctedProducts}, New: ${newProducts}`,
    );

    return correctedProducts + newProducts;
  }

  async deleteOldImages(targetDir: string): Promise<number> {
    try {
      this.logger.log('🗑️ Checking for old images to delete...');

      // Check if directory exists
      try {
        await fs.access(targetDir);
      } catch {
        this.logger.warn(`⚠️ Directory ${targetDir} does not exist`);
        return 0;
      }

      // Calculate the threshold date (3 days ago)
      const threeDaysAgo = DateTime.now().minus({ days: 3 }).toJSDate();
      this.logger.log(
        `🕐 Deleting images older than ${threeDaysAgo.toISOString()}`,
      );

      // Read all files in the directory
      const files = await fs.readdir(targetDir);

      if (files.length === 0) {
        this.logger.log('ℹ️ No files found in directory');
        return 0;
      }

      let deletedCount = 0;

      // Check each file's age and delete if older than 3 days
      for (const file of files) {
        try {
          const filePath = path.join(targetDir, file);
          const stats = await fs.stat(filePath);

          // Check if it's a file (not a directory)
          if (!stats.isFile()) {
            continue;
          }

          // Check if file is older than 3 days
          if (stats.mtime < threeDaysAgo) {
            await fs.unlink(filePath);
            deletedCount++;
            this.logger.log(`🗑️ Deleted old image: ${file}`);
          }
        } catch (error) {
          this.logger.error(`❌ Error deleting file ${file}: ${error.message}`);
          // Continue with next file even if one fails
        }
      }

      if (deletedCount > 0) {
        this.logger.log(
          `✅ Successfully deleted ${deletedCount} old images from ${targetDir}`,
        );
      } else {
        this.logger.log('ℹ️ No old images found to delete');
      }

      return deletedCount;
    } catch (error) {
      this.logger.error(
        `❌ Error in deleteOldImages: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
