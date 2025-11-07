import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OcrService } from './ocr.service';
import { OcrController } from './ocr.controller';

/**
 * OCR Module
 * Handles integration with external OCR service for invoice processing
 */
@Module({
  imports: [ConfigModule],
  controllers: [OcrController],
  providers: [OcrService],
  exports: [OcrService],
})
export class OcrModule {}
