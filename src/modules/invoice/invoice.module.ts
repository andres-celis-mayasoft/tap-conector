import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceCronService } from './invoice.cron';
import { MeikoService } from '../meiko/meiko.service';

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceCronService, MeikoService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
