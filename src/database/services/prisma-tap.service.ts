import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client-tap';

/**
 * Prisma Service for TAP Database
 * Manages connection to the TAP SQL Server database
 */
@Injectable()
export class PrismaTapService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaTapService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to TAP Database');
    } catch (error) {
      this.logger.error('Failed to connect to TAP Database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from TAP Database');
    } catch (error) {
      this.logger.error('Error disconnecting from TAP Database', error);
    }
  }

  /**
   * Health check for TAP connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1 as result`;
      return true;
    } catch (error) {
      this.logger.error('TAP health check failed', error);
      return false;
    }
  }
}
