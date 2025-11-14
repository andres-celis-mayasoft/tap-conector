import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TapController } from './tap.controller';
import { TapService } from './tap.service';
import { TapApiClient } from './tap-api.client';

/**
 * TAP Module
 * Handles integration with TAP external service
 */
@Module({
  imports: [ConfigModule],
  controllers: [TapController],
  providers: [TapService, TapApiClient],
  exports: [TapService, TapApiClient],
})
export class TapModule {}
