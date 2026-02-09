import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { join } from 'path';
import { PrismaClient } from 'prisma/generated/client-digmatch';

@Injectable()
export class PrismaDigMatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaDigMatchService.name);
  private prisma: PrismaClient;

  constructor() {
    try {
      const clientPath = join(process.cwd(), 'prisma/generated/client-digmatch');
      const { PrismaClient } = require(clientPath);
      this.prisma = new PrismaClient({
        log: ['error', 'warn'],
        errorFormat: 'pretty',
      });
    } catch (error) {
      this.logger.error('Failed to load DigMatch Prisma Client', error);
      throw error;
    }
  }

  get $connect() {
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    return this.prisma.$disconnect.bind(this.prisma);
  }

  get $queryRaw() {
    return this.prisma.$queryRaw.bind(this.prisma);
  }

  get $queryRawUnsafe() {
    return this.prisma.$queryRawUnsafe.bind(this.prisma);
  }

  get sticker() {
    return this.prisma.sticker;
  }

  get stickerResult() {
    return this.prisma.stickerResult;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to DigMatch Database');
    } catch (error) {
      this.logger.error('Failed to connect to DigMatch Database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from DigMatch Database');
    } catch (error) {
      this.logger.error('Error disconnecting from DigMatch Database', error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('DigMatch health check failed', error);
      return false;
    }
  }
}
