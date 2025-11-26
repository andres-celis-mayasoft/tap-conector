import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@generated/client-meiko';

/**
 * Prisma Service for Meiko Database
 * Manages connection to the Meiko MySQL database
 */
@Injectable()
export class PrismaMeikoService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaMeikoService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to Meiko Database');
    } catch (error) {
      this.logger.error('Failed to connect to Meiko Database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from Meiko Database');
    } catch (error) {
      this.logger.error('Error disconnecting from Meiko Database', error);
    }
  }

  /**
   * Health check for Meiko connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Meiko health check failed', error);
      return false;
    }
  }
}
