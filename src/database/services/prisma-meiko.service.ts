import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { join } from 'path';
import { PrismaClient } from 'prisma/generated/client-meiko'; // <-- IMPORTA TIPOS


@Injectable()
export class PrismaMeikoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaMeikoService.name);
  private prisma: PrismaClient;

  constructor() {
    // Import the Prisma Client at runtime using dynamic require with absolute path
    try {
      const clientPath = join(process.cwd(), 'prisma/generated/client-meiko');
      const { PrismaClient } = require(clientPath);
      this.prisma = new PrismaClient({
        log: ['error', 'warn'],
        errorFormat: 'pretty',
      });
    } catch (error) {
      this.logger.error('Failed to load Meiko Prisma Client', error);
      throw error;
    }
  }

  // Expose PrismaClient methods
  get $connect() {
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    return this.prisma.$disconnect.bind(this.prisma);
  }

  get $queryRaw() {
    return this.prisma.$queryRaw;
  }

  get $queryRawUnsafe() {
    return this.prisma.$queryRawUnsafe.bind(this.prisma);
  }

  // Expose models
  get invoice() {
    return this.prisma.invoice;
  }

  get result() {
    return this.prisma.result;
  }

  get estadoDigitalizacionFactura() {
    return this.prisma.estadoDigitalizacionFactura;
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
