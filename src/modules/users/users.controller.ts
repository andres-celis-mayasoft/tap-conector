import { Controller, Get, Logger } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvoiceService } from '../invoice/invoice.service';
import { UserStatsResponseDto } from './dto/user-stats.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Get current user statistics for the current fortnight period
   * Returns count of processed documents and modified/created products
   * GET /users/me/stats
   */
  @Get('me/stats')
  async getMyStats(
    @CurrentUser('id') userId: number,
  ): Promise<UserStatsResponseDto> {
    this.logger.log(`📊 User ${userId} requesting statistics`);

    try {
      const stats = await this.invoiceService.getUserStats(userId);

      this.logger.log(`✅ Statistics retrieved for user ${userId}`);

      return stats;
    } catch (error) {
      this.logger.error(
        `❌ Error getting statistics for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
