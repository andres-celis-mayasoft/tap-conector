import { Injectable, Logger } from '@nestjs/common';
import { PrismaMeikoService } from '../../database/services/prisma-meiko.service';
import { PrismaService } from '../../database/services/prisma.service';
import { Prisma } from '@generated/client';
import { Prisma as PrismaMeiko } from '@generated/client-meiko';

/**
 * Meiko Service
 * Handles business logic for Meiko database operations
 */
@Injectable()
export class MeikoService {
  private readonly logger = new Logger(MeikoService.name);

  constructor(
    private readonly prismaMeiko: PrismaMeikoService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get invoices with id_factura greater than maxId
   * and with non-null idRegistroEncuesta, responseId, and stickerQR
   * Limited to 30 invoices
   *
   * @param maxId Minimum invoice ID (exclusive)
   * @returns Array of invoices matching the criteria
   */
  async getInvoicesByMaxId(maxId: number) {
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
        take: 500,
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
  async getInvoicesTest(ids: number[]) {
    try {
      const invoices = await this.prismaMeiko.invoice.findMany({
        where: {
          id: {
            in: ids,
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
          businessName: razonSocial,
        },
        orderBy: {
          id: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(
        `Error finding digitization result by description: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async find(args: PrismaMeiko.ResultFindFirstArgs) {
    return this.prismaMeiko.result.findFirst(args);
  }

  /**
   * Create a MeikoResult entry in the main database
   *
   * @param data MeikoResult data to create
   * @returns Created MeikoResult record
   */
  async createFields(data: PrismaMeiko.ResultCreateInput) {
    try {
      this.logger.log(`Creating MeikoResult entry`);
      this.logger.log('Row :', data.rowNumber);
      this.logger.log('idFactura :', data.invoice.connect?.id);

      const result = await this.prismaMeiko.result.create({
        data,
      });

      this.logger.log(`MeikoResult created successfully with id: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error creating MeikoResult: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async createManyFields(data: PrismaMeiko.ResultCreateManyInput[]) {
    try {
      const result = await this.prismaMeiko.result.createMany({
        data,
      });

      this.logger.log(
        `MeikoResult created successfully : ${result.count} rows`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Error creating MeikoResult: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create an EstadoDigitalizacionFactura entry in the main database
   *
   * @param data EstadoDigitalizacionFactura data to create
   * @returns Created EstadoDigitalizacionFactura record
   */
  async createStatus(data: Prisma.EstadoDigitalizacionFacturaCreateInput) {
    try {
      this.logger.log(`Creating EstadoDigitalizacionFactura entry`);

      const estado = await this.prismaMeiko.estadoDigitalizacionFactura.upsert({
        where: {
          invoiceId: data.invoiceId,
        },
        create: {
          ...data,
        },
        update: {
          digitalizationStatusId: data.digitalizationStatusId,
        },
      });

      this.logger.log(
        `EstadoDigitalizacionFactura created/updated successfully with id: ${estado.id}`,
      );
      return estado;
    } catch (error) {
      this.logger.log('Issue creating');
    }
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
  async getInvoices(params: PrismaMeiko.InvoiceFindManyArgs) {
    try {
      const invoices = await this.prismaMeiko.invoice.findMany(params);
      return invoices;
    } catch (error) {
      this.logger.error(
        `Error fetching invoice by ID from Meiko database: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get invoices by date range without digitization status
   * Fetches invoices that:
   * - Have extraction date between startDate and endDate
   * - Do NOT have a digitization status (LEFT JOIN returns NULL)
   * - Have specific photo types (Factura Coke, Postobon, etc.)
   * - Limited to 50,000 results
   *
   * @param startDate Start date in format YYYY-MM-DD or YYYY/MM/DD
   * @param endDate End date in format YYYY-MM-DD or YYYY/MM/DD
   * @returns Array of invoices with id_factura, idRegistroEncuesta, nombre_variable
   */
  async getInvoicesByDateRange(startDate: string, endDate: string) {
    try {
      this.logger.log(
        `Counting invoices between ${startDate} and ${endDate} without digitization status`,
      );

      const result = await this.prismaMeiko.$queryRaw<
        Array<{
          'count(f.id_factura)': bigint;
        }>
      >`
        SELECT
          DATE(f.fechaExtraccion) AS dia,
          COUNT(*) AS total_facturas,
          COUNT(CASE WHEN ed.estado_digitalizacion = 'Procesado' THEN 1 END) AS procesado,
          COUNT(CASE WHEN ed.estado_digitalizacion = 'No Aplica para el estudio' THEN 1 END) AS no_aplica,
          COUNT(CASE WHEN ed.estado_digitalizacion = 'No Procesable' THEN 1 END) AS no_procesable,
          COUNT(CASE WHEN ed.estado_digitalizacion = 'Generacion Plantilla' THEN 1 END) AS generacion_plantilla,
          COUNT(CASE WHEN ed.estado_digitalizacion = 'Error de descarga' THEN 1 END) AS error_descarga,
          COUNT(CASE WHEN ed.estado_digitalizacion = 'Fecha no valida' THEN 1 END) AS fecha_no_valida,
          COUNT(CASE WHEN ed.estado_digitalizacion IS NULL THEN 1 END) AS pendientes
        FROM factura f
        LEFT JOIN estado_digitalizacion_factura edf 
               ON f.id_factura = edf.id_factura
        LEFT JOIN estado_digitalizacion ed 
               ON ed.id = edf.estado_digitalizacion_id
        WHERE f.fechaExtraccion >= ${startDate}
          AND f.fechaExtraccion <  ${endDate}
        GROUP BY DATE(f.fechaExtraccion)
        ORDER BY dia;
      `;
      return JSON.parse(
        JSON.stringify(result, (_, v) =>
          typeof v === 'bigint' ? v.toString() : v,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error counting invoices by date range: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
