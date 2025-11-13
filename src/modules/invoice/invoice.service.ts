import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import sharp from 'sharp'; // 🧠 Used to validate image integrity
import { PrismaService } from 'src/database/services/prisma.service';
import { Prisma } from '@prisma/client-bd';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  updateInvoice(
    invoice: Prisma.InvoiceUpdateInput & { id: number },
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.invoice.updateMany({
      where: { id: invoice.id },
      data: invoice,
    });
  }


  getInvoice(id: number) {
    return this.prisma.invoice.findUnique({
      where: { id },
    });
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
      `${invoice.id_factura}${extension}`,
    );

    try {
      this.logger.log(`🟡 Processing invoice ID ${invoice.id_factura}`);

      const data = await this.downloadImage(invoice.link);

      await this.saveTempFile(tempFile, data);

      await this.validateImage(tempFile);

      await this.moveToFinalPath(tempFile, finalPath);

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
      timeout: 10000,
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

  async cleanupTempFile(tempFile: string): Promise<void> {
    try {
      await fs.unlink(tempFile);
    } catch {}
  }

  async handleDownloadError(id: string, error: any): Promise<void> {
    this.logger.warn(`⚠️ Error with invoice ${id}: ${error.message}`);
    // optional: send email, log to DB, etc.
  }
}
