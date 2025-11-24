import { Module } from '@nestjs/common';
import { ValidatorService } from './validator.service';
import { ValidatorController } from './validator.controller';
import { MeikoModule } from '../meiko/meiko.module';
import { TapModule } from '../tap/tap.module';
import { PrismaTapService } from 'src/database/services/prisma-tap.service';

@Module({
  imports: [MeikoModule,TapModule],
  controllers: [ValidatorController],
  providers: [ValidatorService, PrismaTapService],
  exports: [ValidatorService],
})
export class ValidatorModule {}
