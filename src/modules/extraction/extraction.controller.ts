import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ExtractionService } from './extraction.service';

/**
 * Extraction Controller
 * Provides API endpoints for manual extraction triggering
 */
@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  /**
   * Manually trigger the extraction process
   * POST /extraction/trigger
   */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerExtraction() {
    await this.extractionService.triggerManualExtraction();
    return {
      message: 'Extraction process triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
