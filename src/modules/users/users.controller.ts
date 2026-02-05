import { Controller, Get, Logger, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvoiceService } from '../invoice/invoice.service';
import { UserStatsResponseDto } from './dto/user-stats.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Get current user statistics for a specific fortnight period
   * Returns count of processed documents and modified/created products
   * GET /users/me/stats?year=2026&month=2&fortnight=1
   *
   * @param userId - Current authenticated user
   * @param year - Year (e.g., 2026) - optional, defaults to current year
   * @param month - Month (1-12) - optional, defaults to current month
   * @param fortnight - Fortnight (1 or 2) - optional, defaults to current fortnight
   */
  @Get('me/stats')
  async getMyStats(
    @CurrentUser('id') userId: number,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('fortnight') fortnight?: string,
  ): Promise<UserStatsResponseDto> {
    this.logger.log(
      `📊 User ${userId} requesting statistics for year=${year}, month=${month}, fortnight=${fortnight}`,
    );

    try {
      const stats = await this.invoiceService.getUserStats(
        userId,
        year ? parseInt(year, 10) : undefined,
        month ? parseInt(month, 10) : undefined,
        fortnight ? (parseInt(fortnight, 10) as 1 | 2) : undefined,
      );

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
