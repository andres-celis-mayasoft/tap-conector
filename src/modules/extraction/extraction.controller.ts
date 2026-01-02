import { Controller, Post, HttpCode, HttpStatus, Body } from '@nestjs/common';
import { ExtractionService } from './extraction.service';

@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

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
