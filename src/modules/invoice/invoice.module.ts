import { Module } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceController } from './invoice.controller';
import { InvoiceCronService } from './invoice.cron';
import { MeikoService } from '../meiko/meiko.service';
import { ExcludedService } from '../excluded/excluded.service';
import { ProductService } from '../product/product.service';

@Module({
  controllers: [InvoiceController],
  providers: [InvoiceService, InvoiceCronService, MeikoService, ExcludedService, ProductService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
