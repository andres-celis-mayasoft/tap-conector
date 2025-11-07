import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Get,
} from '@nestjs/common';
import { OcrService } from './ocr.service';
import type { InvoiceOcrRequest } from './ocr.service';

/**
 * OCR Controller
 * Provides API endpoints for OCR processing
 */
@Controller('ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * Process a single invoice with OCR
   * POST /ocr/process
   */
  @Post('process')
  @HttpCode(HttpStatus.OK)
  async processInvoice(@Body() request: InvoiceOcrRequest) {
    const result = await this.ocrService.processInvoice(request);
    return result;
  }

  /**
   * Process multiple invoices with OCR
   * POST /ocr/process-batch
   */
  @Post('process-batch')
  @HttpCode(HttpStatus.OK)
  async processInvoices(@Body() requests: InvoiceOcrRequest[]) {
    const results = await this.ocrService.processInvoices(requests);
    return {
      total: requests.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Check OCR service status
   * GET /ocr/status
   */
  @Get('status')
  async getStatus() {
    return {
      configured: this.ocrService.isConfigured(),
      apiUrl: this.ocrService.getApiUrl(),
    };
  }
}
