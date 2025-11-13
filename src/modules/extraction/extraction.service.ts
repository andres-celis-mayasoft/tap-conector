import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TapService } from '../tap/tap.service';
import { MeikoService } from '../meiko/meiko.service';
import { InvoiceService } from '../invoice/invoice.service';
import { DateUtils } from '../../utils/date';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Prisma as PrismaMeiko } from '@prisma/client-meiko';
import { OcrService } from '../ocr/ocr.service';
import { TAP_MEIKO_ID } from 'src/constants/business';

/**
 * Extraction Service
 * Handles automated invoice extraction via cron job
 */
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
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    name: 'extraction',
  })
  async handleExtractionCron() {
    this.logger.log('🚀 Starting extraction cron job');

    try {
      // 1. Get current date
      const date = DateUtils.getDate();
      this.logger.log(`📅 Date: ${date}`);

      // 2. Get parameters (returns path)
      const parameters = await this.tapService.getParameters(TAP_MEIKO_ID, 'RUTA_LISTA_LOTES');
      const basePath = parameters.path || parameters.ruta || parameters;
      this.logger.log(`📂 Base path from parameters: ${basePath}`);

      // 3. Create folder with path + date
      const extractionPath = path.join(basePath, date);
      await fs.mkdir(extractionPath, { recursive: true });
      this.logger.log(`✅ Created extraction folder: ${extractionPath}`);

      // 4. Get max invoice ID
      const maxIdResponse = await this.tapService.getMaxId();
      const maxId =
        maxIdResponse.maxId || maxIdResponse.max_id || maxIdResponse;
      this.logger.log(`🔢 Max invoice ID: ${maxId}`);

      // 5. Get invoices
      const invoices = await this.meikoService.getInvoices(maxId);
      this.logger.log(`📄 Found ${invoices.length} invoices to process`);

      if (invoices.length === 0) {
        this.logger.log('ℹ️ No invoices to process');
        return;
      }

      await this.invoiceService.createInvoices(
        invoices.map((invoice) => ({
          status: 'PROCESSING',
          invoiceId: invoice.id,
        })),
      );

      for (const invoice of invoices) {
        try {
          const { isValid, path } =
            await this.invoiceService.downloadAndValidate(
              invoice,
              extractionPath,
            );
          if (!isValid) {
            await this.invoiceService.updateInvoice({
              id: invoice.id,
              status: 'PENDING_TO_SEND',
            });
            continue;
          }
          const { success, data, error } = await this.ocrService.processInvoice(
            {
              filePath: path,
              typeOfInvoice: invoice.photoType || '',
            },
          );

          // inferir values
          // ----------

          // ----------
          const isPartial = false;

          if (!isPartial) {
            await this.invoiceService.updateInvoice({
              id: invoice.id,
              mayaInvoiceJson: JSON.stringify(data),
              status: 'PENDING_TO_SEND',
            });
            continue;
          }
          if (isPartial) {
            await this.invoiceService.updateInvoice({
              id: invoice.id,
              mayaInvoiceJson: JSON.stringify(data),
              status: 'PENDING_VALIDATION',
            });
          }
        } catch (error) {
          this.logger.error(
            `❌ Error processing invoice ${invoice.id}: ${error.message}`,
            error.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `❌ Extraction cron job failed: ${error.message}`,
        error.stack,
      );
    }
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
