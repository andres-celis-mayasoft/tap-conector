import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TapController } from './tap.controller';
import { TapService } from './tap.service';

/**
 * TAP Module
 * Handles integration with TAP external service
 */
@Module({
  imports: [ConfigModule],
  controllers: [TapController],
  providers: [TapService],
  exports: [TapService],
})
export class TapModule {}
