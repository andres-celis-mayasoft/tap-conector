import { Module } from '@nestjs/common';
import { ValidatorService } from './validator.service';
import { ValidatorController } from './validator.controller';
import { MeikoModule } from '../meiko/meiko.module';
import { TapModule } from '../tap/tap.module';
import { InvoiceModule } from '../invoice/invoice.module';

@Module({
  imports: [MeikoModule,TapModule, InvoiceModule],
  controllers: [ValidatorController],
  providers: [ValidatorService],
  exports: [ValidatorService],
})
export class ValidatorModule {}
