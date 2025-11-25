import { Injectable, Logger } from "@nestjs/common";
// import { PrismaTapService } from "../../database/services/prisma-tap.service";
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
    // private readonly prismaTapService: PrismaTapService,
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
      // const result = await this.prismaTapService.controlProceso.findFirst({
      //   where: {
      //     idFactura: invoiceId,
      //     loteId: batchId,
      //   },
      // });

      // if (result) {
      //   this.logger.log(
      //     `Found control_proceso record with id=${result.id} for invoiceId=${invoiceId} and batchId=${batchId}`
      //   );
      // } else {
      //   this.logger.debug(
      //     `No control_proceso record found for invoiceId=${invoiceId} and batchId=${batchId}`
      //   );
      // }

      // return result;
    } catch (error) {
      this.logger.error(
        `Error fetching control_proceso for invoiceId=${invoiceId} and batchId=${batchId}`,
        error.stack
      );
      throw error;
    }
  }


}