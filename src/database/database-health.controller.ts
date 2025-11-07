import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { PrismaMeikoService } from './services/prisma-meiko.service';
import { PrismaTapService } from './services/prisma-tap.service';

/**
 * Database Health Controller
 * Provides endpoints to check the health of all database connections
 */
@Controller('health/database')
export class DatabaseHealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prismaMeiko: PrismaMeikoService,
    private readonly prismaTap: PrismaTapService,
  ) {}

  /**
   * Check health of all database connections
   * GET /health/database
   */
  @Get()
  async checkAllDatabases() {
    const [main, meiko, tap] = await Promise.allSettled([
      this.checkMainDatabase(),
      this.prismaMeiko.healthCheck(),
      this.prismaTap.healthCheck(),
    ]);

    return {
      status: this.determineOverallStatus(main, meiko, tap),
      timestamp: new Date().toISOString(),
      databases: {
        main: {
          status: main.status === 'fulfilled' && main.value ? 'healthy' : 'unhealthy',
          error: main.status === 'rejected' ? main.reason?.message : null,
        },
        meiko: {
          status: meiko.status === 'fulfilled' && meiko.value ? 'healthy' : 'unhealthy',
          error: meiko.status === 'rejected' ? meiko.reason?.message : null,
        },
        tap: {
          status: tap.status === 'fulfilled' && tap.value ? 'healthy' : 'unhealthy',
          error: tap.status === 'rejected' ? tap.reason?.message : null,
        },
      },
    };
  }

  /**
   * Check health of main database only
   * GET /health/database/main
   */
  @Get('main')
  async checkMain() {
    try {
      const isHealthy = await this.checkMainDatabase();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check health of Meiko database only
   * GET /health/database/meiko
   */
  @Get('meiko')
  async checkMeiko() {
    try {
      const isHealthy = await this.prismaMeiko.healthCheck();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Check health of TAP database only
   * GET /health/database/tap
   */
  @Get('tap')
  async checkTap() {
    try {
      const isHealthy = await this.prismaTap.healthCheck();
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Private method to check main database health
   */
  private async checkMainDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Determine overall health status based on individual database checks
   */
  private determineOverallStatus(
    main: PromiseSettledResult<boolean>,
    meiko: PromiseSettledResult<boolean>,
    tap: PromiseSettledResult<boolean>,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const results = [main, meiko, tap];
    const healthyCount = results.filter(
      (r) => r.status === 'fulfilled' && r.value === true,
    ).length;

    if (healthyCount === 3) return 'healthy';
    if (healthyCount === 0) return 'unhealthy';
    return 'degraded';
  }
}
