import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { join } from 'path';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private prisma: any;

  constructor() {
    // Import the Prisma Client at runtime using dynamic require with absolute path
    try {
      const clientPath = join(process.cwd(), 'prisma/generated/client');
      const { PrismaClient } = require(clientPath);
      this.prisma = new PrismaClient({
        log: ['error', 'warn'],
        errorFormat: 'pretty',
      });
    } catch (error) {
      this.logger.error('Failed to load Prisma Client', error);
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

  get $transaction() {
    return this.prisma.$transaction.bind(this.prisma);
  }

  // Expose models
  get user() {
    return this.prisma.user;
  }

  get document() {
    return this.prisma.document;
  }

  get field() {
    return this.prisma.field;
  }

  get excludedProducts() {
    return this.prisma.excludedProducts;
  }

  get meikoDocument() {
    return this.prisma.meikoDocument;
  }

  get meikoResult() {
    return this.prisma.meikoResult;
  }

  get estadoDigitalizacionFactura() {
    return this.prisma.estadoDigitalizacionFactura;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Successfully connected to Database');
    } catch (error) {
      this.logger.error('Failed to connect to Database', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Disconnected from Database');
    } catch (error) {
      this.logger.error('Error disconnecting from Database', error);
    }
  }

  /**
   * Clean database - useful for testing
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot clean database in production');
    }

    const models = Reflect.ownKeys(this.prisma).filter(
      (key) => key[0] !== '_' && typeof key === 'string',
    );

    return Promise.all(
      models.map((modelKey) => {
        const model = this.prisma[modelKey as keyof typeof this.prisma];
        if (model && typeof model === 'object' && 'deleteMany' in model) {
          return (model as any).deleteMany();
        }
      }),
    );
  }
}
