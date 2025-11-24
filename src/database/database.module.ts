import { Module, Global } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { PrismaMeikoService } from './services/prisma-meiko.service';
// import { PrismaTapService } from './services/prisma-tap.service';
import { DatabaseHealthController } from './database-health.controller';

/**
 * Database Module
 * Provides access to all three database connections
 * This module is global, so services are available throughout the application
 */
@Global()
@Module({
  controllers: [
    // DatabaseHealthController
  ],
  providers: [
    PrismaService,
    PrismaMeikoService,
    // PrismaTapService,
  ],
  exports: [
    PrismaService,
    PrismaMeikoService,
    // PrismaTapService,
  ],
})
export class DatabaseModule {}
