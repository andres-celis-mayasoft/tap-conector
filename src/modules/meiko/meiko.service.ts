import { Injectable, Logger } from '@nestjs/common';
import { PrismaMeikoService } from '../../database/services/prisma-meiko.service';
import { Prisma } from '@prisma/client-meiko';

/**
 * Meiko Service
 * Handles business logic for Meiko database operations
 */
@Injectable()
export class MeikoService {
  private readonly logger = new Logger(MeikoService.name);

  constructor(private readonly prismaMeiko: PrismaMeikoService) {}

  /**
   * Get invoices with id_factura greater than maxId
   * and with non-null idRegistroEncuesta, responseId, and stickerQR
   * Limited to 30 invoices
   *
   * @param maxId Minimum invoice ID (exclusive)
   * @returns Array of invoices matching the criteria
   */
  async getInvoices(maxId: number) {
    try {
      this.logger.log(`Fetching invoices with id_factura > ${maxId}`);

      const invoices = await this.prismaMeiko.invoice.findMany({
        where: {
          id: {
            gt: maxId,
          },
          // surveyRecordId: {
          //   not: null,
          // },
          responseId: {
            not: null,
          },
          stickerQR: {
            not: null,
          },
        },
        orderBy: {
          id: 'asc',
        },
        take: 30,
      });

      this.logger.log(`Found ${invoices.length} invoices matching criteria`);

      return invoices;
    } catch (error) {
      this.logger.error(
        `Error fetching invoices from Meiko database: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Find digitization results by product description
   * Uses fuzzy matching to find products that match the given description
   *
   * @param tipoFoto Photo type to filter by
   * @param description Product description to search for
   * @returns Digitization result or null if not found
   */
  async findByDescription(razonSocial: string, description: string) {
    try {
      this.logger.log(
        `Searching digitization result by description: "${description}" for razon social: "${razonSocial}"`,
      );

      return this.prismaMeiko.result.findFirst({
        where: {
          description,
          businessName: razonSocial
        },
        orderBy: {
          id: 'desc'
        }
      })

    } catch (error) {
      this.logger.error(
        `Error finding digitization result by description: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async find(args: Prisma.ResultFindFirstArgs) {
    return this.prismaMeiko.result.findFirst(args)
  }

  /**
   * Get total count of invoices with id_factura greater than maxId
   * and with non-null idRegistroEncuesta, responseId, and stickerQR
   *
   * @param maxId Minimum invoice ID (exclusive)
   * @returns Count of invoices matching the criteria
   */
  async getInvoicesCount(maxId: number) {
    try {
      this.logger.log(`Counting invoices with id_factura > ${maxId}`);

      const count = await this.prismaMeiko.invoice.count({
        where: {
          id: {
            gt: maxId,
          },
          // surveyRecordId: {
          //   not: null,
          // },
          responseId: {
            not: null,
          },
          stickerQR: {
            not: null,
          },
        },
      });

      this.logger.log(`Found ${count} total invoices matching criteria`);

      return count;
    } catch (error) {
      this.logger.error(
        `Error counting invoices from Meiko database: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get a single invoice by ID
   *
   * @param id Invoice ID
   * @returns Invoice or null if not found
   */
  async getInvoiceById(id: number) {
    try {
      this.logger.log(`Fetching invoice with id_factura = ${id}`);

      const invoice = await this.prismaMeiko.invoice.findUnique({
        where: {
          id,
        },
      });

      if (!invoice) {
        this.logger.warn(`Invoice with id_factura = ${id} not found`);
      }

      return invoice;
    } catch (error) {
      this.logger.error(
        `Error fetching invoice by ID from Meiko database: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
