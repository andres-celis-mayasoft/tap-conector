import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceService } from './invoice.service';

@Injectable()
export class InvoiceCronService {
  private readonly logger = new Logger(InvoiceCronService.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  @Cron(CronExpression.EVERY_MINUTE)
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
}
