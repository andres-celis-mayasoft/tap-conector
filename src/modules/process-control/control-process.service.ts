import { Injectable, Logger } from "@nestjs/common";
import { PrismaTapService } from "../../database/services/prisma-tap.service";
import { PrismaService } from "../../database/services/prisma.service";
import { Invoice } from "@prisma/client-bd";
import { ExtractionField } from "@prisma/client-tap";
import { DateTime } from "luxon";

/**
 * ProcessControlService
 * Handles operations related to process control in the TAP database
 */
@Injectable()
export class ControlProcessService {
  private readonly logger = new Logger(ControlProcessService.name);

  constructor(
    private readonly prismaTapService: PrismaTapService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get process control record by invoice ID and batch ID
   * @param invoiceId Invoice ID
   * @param batchId Batch ID
   * @returns Process control record or null if not found
   */
  async getByInvoiceAndBatch(
    invoiceId: number | bigint,
    batchId: number | bigint
  ) {
    this.logger.debug(
      `Searching control_proceso in TapDB with invoiceId=${invoiceId} and batchId=${batchId}`
    );

    try {
      const result = await this.prismaTapService.controlProceso.findFirst({
        where: {
          idFactura: invoiceId,
          loteId: batchId,
        },
      });

      if (result) {
        this.logger.log(
          `Found control_proceso record with id=${result.id} for invoiceId=${invoiceId} and batchId=${batchId}`
        );
      } else {
        this.logger.debug(
          `No control_proceso record found for invoiceId=${invoiceId} and batchId=${batchId}`
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching control_proceso for invoiceId=${invoiceId} and batchId=${batchId}`,
        error.stack
      );
      throw error;
    }
  }


  async saveProcessedInvoice(invoice: Invoice, mayaInvoiceJson, batchId: number , docketId: string) {
    // Find or create batch record
    const { id } = await this.prisma.extractionBatch.upsert({
      where: { batchId: batchId.toString() },
      update: {},
      create: { batchId: batchId.toString() },
    })

    const currentDate = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss.SSS');

    const { id: invoiceId} = await this.prisma.extractionInvoice.create({
      data: {
        batchId: id ,
        invoiceId: invoice.id.toString(),
        docketId,
        extracted: true, //SI PASÓ POR OCR O NO
        validated: false, //SI PASÓ 100%
        errors : '' , //EN CASO DE NO SER 100% , POR QUÉ NO FUE 100%
        photoType: invoice.photoType,
        photoTypeOcr: mayaInvoiceJson.tipoFacturaOcr,
        date: currentDate
      }
    })


    const headerRows : ExtractionField[] = mayaInvoiceJson.encabezado.map((row)=> ({
      invoiceId,
      row: 1,
      type: 'ENCABEZADO',
      name: row.type.toUpperCase(),
      value: (row.text as string).toUpperCase(),
      extracted: 1, //REVISAR SI ES REALMENTE NECESARIO O NO YA QUE LA FACTURA APARENTEMENTE YA LO TIENE
      validated: 1, // SI ES IGUAL A 100 ES 1 SINO ES 0
      confidence: row.confidence,
      date: currentDate
    }))
    
    const bodyRows : ExtractionField[] = mayaInvoiceJson.detalles.map((row)=> ({
      invoiceId,
      confidence: row.confidence,
      value: (row.text as string).toUpperCase(),
      name: row.type.toUpperCase(),
      type: 'DETALLE',
      row: row.row,
      date: currentDate,
      extracted: 1, //REVISAR SI ES REALMENTE NECESARIO O NO YA QUE LA FACTURA APARENTEMENTE YA LO TIENE
      validated: 1, // SI ES IGUAL A 100 ES 1 SINO ES 0
    }))
 

    await this.prisma.extractionField.createMany({data: headerRows})
    await this.prisma.extractionField.createMany({data: bodyRows})




  }
}