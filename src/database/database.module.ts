import { Module, Global } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { PrismaMeikoService } from './services/prisma-meiko.service';
import { PrismaDigMatchService } from './services/prisma-digmatch.service';

/**
 * Database Module
 * Provides access to multiple database connections
 * This module is global, so services are available throughout the application
 */
@Global()
@Module({
  controllers: [],
  providers: [
    PrismaService,
    PrismaMeikoService,
    PrismaDigMatchService,
  ],
  exports: [
    PrismaService,
    PrismaMeikoService,
    PrismaDigMatchService,
  ],
})
export class DatabaseModule {}
