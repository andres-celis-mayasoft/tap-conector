import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TapModule } from '../tap/tap.module';
import { MeikoModule } from '../meiko/meiko.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { ControlProcessService } from './control-process.service';

/**
 * ProcessControlModule
 * Handles process control operations with TAP database
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TapModule,
    MeikoModule,
    InvoiceModule,
  ],
  controllers: [],
  providers: [ControlProcessService],
  exports: [ControlProcessService],
})
export class ControlProcessModule {}
