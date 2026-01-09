import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  // @Cron(CronExpression.EVERY_MINUTE)
  async releaseUnresolvedInvoices() {
    try {
      const releasedCount = await this.invoiceService.releaseUnresolvedInvoices();

      if (releasedCount > 0) {
        this.logger.log(`✅ Released ${releasedCount} invoices that exceeded 40 minutes without resolution`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error in releaseUnresolvedInvoices cron: ${error.message}`,
        error.stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async retryFailedInvoices() {
    try {
      const retriedCount = await this.invoiceService.retryFailedInvoices();
      if (retriedCount > 0) {
        this.logger.log(`✅ Retried ${retriedCount} failed invoices for processing`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error in retryFailedInvoices cron: ${error.message}`,
        error.stack,
      );

    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendPendingDocuments() {
    try {
      const sentCount = await this.invoiceService.sendPendingDocuments();

      if (sentCount > 0) {
        this.logger.log(`✅ Successfully sent ${sentCount} pending documents to Meiko`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Error in sendPendingDocuments cron: ${error.message}`,
        error.stack,
      );
    }
  }
}
