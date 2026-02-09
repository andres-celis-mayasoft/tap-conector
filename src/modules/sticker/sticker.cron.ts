import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StickerService } from './sticker.service';

@Injectable()
export class StickerCron {
  private readonly logger = new Logger(StickerCron.name);
  private isProcessing = false;

  constructor(private readonly stickerService: StickerService) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async processPendingStickers() {
    if (this.isProcessing) {
      this.logger.warn('Previous sticker processing still running, skipping this cycle');
      return;
    }

    this.isProcessing = true;

    try {
      this.logger.log('Starting sticker processing cycle');
      await this.stickerService.processPending();
      this.logger.log('Completed sticker processing cycle');
    } catch (error) {
      this.logger.error(`Sticker processing cycle failed: ${error.message}`, error.stack);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Release stickers that have been assigned for more than 40 minutes without resolution.
   * Runs every minute to check for stale assignments.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseUnresolvedStickers() {
    try {
      const releasedCount = await this.stickerService.releaseUnresolvedStickers();

      if (releasedCount > 0) {
        this.logger.log(`Released ${releasedCount} stickers that exceeded 40 minutes without resolution`);
      }
    } catch (error) {
      this.logger.error(
        `Error in releaseUnresolvedStickers cron: ${error.message}`,
        error.stack,
      );
    }
  }
}
