import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TapModule } from '../tap/tap.module';
import { MeikoModule } from '../meiko/meiko.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { RadicationController } from './radication.controller';
import { RadicationService } from './radication.service';
import { OcrModule } from '../ocr/ocr.module';
import { ControlProcessModule } from '../process-control/control-process.module';

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
    OcrModule,
    ControlProcessModule
  ],
  controllers: [RadicationController],
  providers: [RadicationService],
  exports: [RadicationService],
})
export class RadicationModule {}
