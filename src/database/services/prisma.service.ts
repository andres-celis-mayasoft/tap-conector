import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from 'prisma/generated/client'; // <-- IMPORTA TIPOS
import { join } from 'path';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private prisma: PrismaClient; // <-- TIPADO

  constructor() {
    try {
      const clientPath = join(process.cwd(), 'prisma/generated/client');
      // runtime import:
      const { PrismaClient: RuntimeClient } = require(clientPath);

      this.prisma = new RuntimeClient({
        log: ['error', 'warn'],
        errorFormat: 'pretty',
      });
    } catch (error) {
      this.logger.error('Failed to load Prisma Client', error);
      throw error;
    }
  }

  // Expose PrismaClient
  get client() {
    return this.prisma;
  }

  // Models are now correctly typed:
  get user() {
    return this.prisma.user;
  }

  get excluded() {
    return this.prisma.excluded;
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

  get product() {
    return this.prisma.product;
  }

  get meikoDocument() {
    return this.prisma.meikoDocument;
  }

  get meikoResult() {
    return this.prisma.meikoResult;
  }

  get sticker() {
    return this.prisma.sticker;
  }

  get stickerField() {
    return this.prisma.stickerField;
  }

  get $queryRaw() {
    return this.prisma.$queryRaw.bind(this.prisma);
  }

  get $queryRawUnsafe() {
    return this.prisma.$queryRawUnsafe.bind(this.prisma);
  }

  get estadoDigitalizacionFactura() {
    return this.prisma.estadoDigitalizacionFactura;
  }

  async onModuleInit() {
    await this.prisma.$connect();
    this.logger.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    this.logger.log('Disconnected from Database');
  }
}
