import { Module, Global } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { PrismaMeikoService } from './services/prisma-meiko.service';

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
  ],
  exports: [
    PrismaService,
    PrismaMeikoService,
  ],
})
export class DatabaseModule {}
