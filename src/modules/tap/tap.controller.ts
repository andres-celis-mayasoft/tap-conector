import { Controller, Get, Query, ParseIntPipe, Optional } from '@nestjs/common';
import { TapService } from './tap.service';

/**
 * TAP Controller
 * Provides endpoints to interact with the TAP external service
 */
@Controller('tap')
export class TapController {
  constructor(private readonly tapService: TapService) {}

  /**
   * Get parameters from TAP service
   * GET /tap/parameters
   * GET /tap/parameters?projectId=123
   */
  @Get('parameters')
  async getParameters(
    @Query('projectId', new ParseIntPipe({ optional: false })) projectId: number,
  ) {
    return this.tapService.getParameters(projectId);
  }

  /**
   * Get max invoice ID from Meiko
   * GET /tap/max-id
   * GET /tap/max-id?projectId=123
   */
  @Get('max-id')
  async getMaxId(
    @Query('projectId', new ParseIntPipe({ optional: true })) projectId?: number,
  ) {
    return this.tapService.getMaxId(projectId);
  }

  /**
   * Get TAP service configuration
   * GET /tap/config
   */
  @Get('config')
  async getConfig() {
    return {
      projectId: this.tapService.getProjectId(),
      serviceUrl: this.tapService.getServiceUrl(),
      isConfigured: this.tapService.isConfigured(),
    };
  }
}
