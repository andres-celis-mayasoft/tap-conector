import { Module } from '@nestjs/common';
import { ValidatorService } from './validator.service';
import { ValidatorController } from './validator.controller';
import { MeikoModule } from '../meiko/meiko.module';

@Module({
  imports: [MeikoModule],
  controllers: [ValidatorController],
  providers: [ValidatorService],
  exports: [ValidatorService],
})
export class ValidatorModule {}
