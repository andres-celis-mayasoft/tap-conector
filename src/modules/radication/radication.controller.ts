import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { RadicationService } from './radication.service';

/**
 * Extraction Controller
 * Provides API endpoints for manual extraction triggering
 */
@Controller('radication')
export class RadicationController {
  constructor(private readonly radicationService: RadicationService) {}

  /**
   * Manually trigger the extraction process
   * POST /extraction/trigger
   */
  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  async triggerExtraction() {
    await this.radicationService.triggerManualRadication();
    return {
      message: 'Extraction process triggered successfully',
      timestamp: new Date().toISOString(),
    };
  }
}
