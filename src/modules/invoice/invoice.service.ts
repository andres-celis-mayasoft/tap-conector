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

  updateInvoice(
    invoice: Prisma.InvoiceUpdateInput & { id: number },
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.invoice.updateMany({
      where: { invoiceId: invoice.id },
      data: invoice,
    });
  }


  getInvoice(id: number) {
    return this.prisma.invoice.findUnique({
      where: { id },
    });
  }

  async getMaxId(): Promise<number> {
    try {
      const result = await this.prisma.invoice.findFirst({
        orderBy: {
          invoiceId: 'desc',
        },
        select: {
          invoiceId: true,
        },
      });

      return result?.invoiceId ?? 0;
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

      const invoices = await this.prisma.invoice.findMany({
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


  createInvoice(invoice: Prisma.InvoiceCreateInput) {
    return this.prisma.invoice.create({
      data: invoice,
    });
  }

  createInvoices(invoices: Prisma.InvoiceCreateInput[]) {
    return this.prisma.invoice.createMany({
      data: invoices,
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
      responseType: 'arraybuffer'
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

  async resizeImageWithDPI(inputPath: string, outputPath: string): Promise<void> {
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
    invoiceData: Prisma.InvoiceUpdateInput & { id: number },
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
      await this.updateInvoice({
        ...invoiceData,
        mayaInvoiceJson: JSON.stringify(mayaInvoiceJson),
        photoTypeOcr: mayaInvoiceJson.tipoFacturaOcr,
      });

      // Get invoice to obtain invoiceId for field relations
      const invoice = await this.getInvoice(invoiceData.id);
      if (!invoice) {
        throw new Error(`Invoice with id ${invoiceData.id} not found`);
      }

      // Prepare header fields (encabezado)
      const headerFields: Prisma.FieldCreateManyInput[] =
        mayaInvoiceJson.encabezado.map((field) => ({
          invoiceId: invoice.invoiceId,
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
          invoiceId: invoice.invoiceId,
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
}
