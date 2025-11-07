import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ExtractionService } from './extraction.service';
import { ExtractionController } from './extraction.controller';
import { TapModule } from '../tap/tap.module';
import { MeikoModule } from '../meiko/meiko.module';
import { InvoiceModule } from '../invoice/invoice.module';

/**
 * Extraction Module
 * Handles automated invoice extraction via scheduled cron jobs
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TapModule,
    MeikoModule,
    InvoiceModule,
  ],
  controllers: [ExtractionController],
  providers: [ExtractionService],
  exports: [ExtractionService],
})
export class ExtractionModule {}
