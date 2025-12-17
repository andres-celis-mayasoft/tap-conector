import { Controller, Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
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
  async triggerExtraction(@Body() request: { ids?: number[] }) {
    
    await this.extractionService.triggerManualExtraction(request.ids);
    return {
      message: 'Extraction process triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
