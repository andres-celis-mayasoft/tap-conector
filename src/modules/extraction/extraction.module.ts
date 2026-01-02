import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ExtractionService } from './extraction.service';
import { ExtractionController } from './extraction.controller';
import { MeikoModule } from '../meiko/meiko.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { OcrModule } from '../ocr/ocr.module';
import { ExcludedModule } from '../excluded/excluded.module';
import { ExcludedService } from '../excluded/excluded.service';
import { ProductModule } from '../product/product.module';
import { ProductService } from '../product/product.service';

/**
 * Extraction Module
 * Handles automated invoice extraction via scheduled cron jobs
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    MeikoModule,
    InvoiceModule,
    OcrModule,
    ExcludedModule,
    ProductModule
  ],
  controllers: [ExtractionController],
  providers: [ExtractionService,ExcludedService, ProductService],
  exports: [ExtractionService],
})
export class ExtractionModule {}
