import { Module } from '@nestjs/common';
import { MeikoController } from './meiko.controller';
import { MeikoService } from './meiko.service';

/**
 * Meiko Module
 * Handles operations related to Meiko database
 */
@Module({
  controllers: [MeikoController],
  providers: [MeikoService],
  exports: [MeikoService],
})
export class MeikoModule {}
