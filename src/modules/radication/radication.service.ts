import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TapService } from '../tap/tap.service';
import { MeikoService } from '../meiko/meiko.service';
import { InvoiceService } from '../invoice/invoice.service';
import { DateUtils } from '../../utils/date';
import * as path from 'path';
import * as fs from 'fs/promises';
import { OcrService } from '../ocr/ocr.service';
import axios from 'axios';
import {
  RUTA_LISTA_LOTES,
  TAP_MEIKO_ID,
  TAP_PARAMS,
  TOKEN_FUNCTIONS_API,
  URl_FUNCTIONS_API,
} from 'src/constants/business';
import { ControlProcessService } from '../process-control/control-process.service';
import { Invoice } from '@prisma/client-bd';
import { TapApiClient } from '../tap/tap-api.client';
import { createReadStream } from 'fs';
import FormData = require('form-data');

/**
 * Extraction Service
 * Handles automated invoice extraction via cron job
 */
@Injectable()
export class RadicationService {
  private readonly logger = new Logger(RadicationService.name);

  constructor(
    private readonly tapService: TapService,
    private readonly invoiceService: InvoiceService,
    private readonly meikoService: MeikoService,
    private readonly controlProcess: ControlProcessService,
    private readonly tapApiClient: TapApiClient,
  ) {}

  // @Cron(CronExpression.EVERY_DAY_AT_2AM, {
  //   name: 'radication',
  // })
  async handleRadicationCron() {
    this.logger.log('🚀 Starting extraction cron job');

    try {
      // 1. Get current date
      const date = DateUtils.getDate();
      this.logger.log(`📅 Date: ${date}`);

      // 2. Get parameters (returns path)
      const parameters = await this.tapService.getParameters(
        TAP_MEIKO_ID,
        TAP_PARAMS.RUTA_LISTA_LOTES,
      );
      const basePath = parameters.path || parameters.ruta || parameters;
      this.logger.log(`📂 Base path from parameters: ${basePath}`);

      // 3. Create folder with path + date
      const extractionPath = path.join(basePath, date);
      await fs.mkdir(extractionPath, { recursive: true });
      this.logger.log(`✅ Created extraction folder: ${extractionPath}`);

      // 4. Get max invoice ID
      const maxIdResponse = await this.tapService.getMaxId();
      const maxId =
        maxIdResponse.maxId || maxIdResponse.max_id || Number(maxIdResponse) - 100;
      this.logger.log(`🔢 Max invoice ID: ${maxId}`);

      // 5. Get invoices from own database
      // const invoices = await this.invoiceService.getInvoices(maxId); //REVIEW HECTOR
      const invoices = await this.meikoService.getInvoices(maxId); //REVIEW HECTOR

      if (invoices.length === 0) {
        this.logger.log('ℹ️ No new invoices to extract');
        return;
      }

      // 6. Verify natch has no IN_CAPTURE or PARCIAL status
      // if (
      //   invoices.some((inv) => ['IN_CAPTURE', 'PARCIAL'].includes(inv.status))
      // ) {
      //   this.logger.warn(
      //     '⚠️ Some invoices have IN_CAPTURE or PARCIAL status. Aborting extraction.',
      //   );
      //   return;
      // }

      // 7. Send emails (Pending to implement)

      // 7. Send emails (Pending to implement)

      // 8. Process each invoice
      const validInvoices: any = [];
      const invalidInvoices: any = [];

      for (const invoice of invoices) {
        const { isValid, path } = await this.invoiceService.downloadAndValidate(
          invoice,
          extractionPath,
        );
        if (isValid) validInvoices.push(invoice);
        else invalidInvoices.push(invoice);
      }

      if (validInvoices.length == 0) {
        this.logger.log('ℹ️ No valid invoices to process');
        return;
      }

      // 9. Radicate

      const batchResponse = 'OK-19999'
      // const batchResponse: string = await this.radicateBatch({
      //   proyect_id: process.env.TAP_MEIKO_ID,
      //   nombre: date,
      //   facturas: validInvoices,
      //   errores: invalidInvoices,
      // });

      if (!batchResponse) {
        this.logger.log('ℹ️ Error radicating batch');
        return;
      }

      const batchId = Number(batchResponse.split('-')[1]);
      this.logger.log(`✅ Batch radicated with ID: ${batchId}`);

      for (const invoice of validInvoices) {
        const processedInvoice = await this.invoiceService.getInvoice(
          invoice.id,
        );
        if (processedInvoice)
          await this.uploadImageInvoice([processedInvoice], batchId);

        //   if (!processedInvoice || !processedInvoice.extracted) continue;

        //   const controlProcess = await this.controlProcess.getByInvoiceAndBatch(
        //     invoice.id,
        //     batchId,
        //   );

        //   if (!controlProcess || !controlProcess.expedienteId) continue;

        //   const { expedienteId: docketId } = controlProcess;

        //   await this.controlProcess.saveProcessedInvoice(
        //     invoice,
        //     processedInvoice.mayaInvoiceJson,
        //     batchId,
        //     docketId.toString(),
        //   );
      }
    } catch (error) {
      this.logger.error(
        `❌ Extraction cron job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  async radicateBatch(JSON: any) {
    try {
      const URL = await this.tapService.getParameters(
        TAP_MEIKO_ID,
        TAP_PARAMS.URL_FUNCTIONS_API + 'PostMeikoRadicarLote',
      );
      const TOKEN = await this.tapService.getParameters(
        TAP_MEIKO_ID,
        TAP_PARAMS.TOKE_FUNCTIONS_API,
      );

      const response = await axios.post(
        URL,
        {
          ambiente: TOKEN,
          json: JSON,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + TOKEN,
          },
        },
      );
      this.logger.log(
        `Radication successfull, response: ${JSON.stringify(response.data)}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Radication failed: ${error.message}`);
      throw error;
    }
  }

  async uploadImageInvoice(
    invoices: Invoice[],
    batchId: number,
  ): Promise<boolean> {
    const URL = await this.tapService.getParameters(
      TAP_MEIKO_ID,
      TAP_PARAMS.URL_API_BLOB,
    );
    const ambienteBlob = 'tappers/prod/';
    const apiUrl = `${URL}api/Blob/uploadFile`;

    try {
      for (const invoice of invoices) {
        const folderName = 'pr' + TAP_MEIKO_ID + '-l' + batchId;
        const filePath = invoice.path;

        if (!filePath) {
          this.logger.warn(
            `⚠️ Invoice ${invoice.id} has no file path, skipping upload`,
          );
          continue;
        }

        // Check if file exists
        try {
          await fs.access(filePath);
        } catch (error) {
          this.logger.error(`❌ Archivo no encontrado: ${filePath}`);
          continue;
        }

        // Get filename from path
        const fileName = path.basename(filePath);

        // Prepare multipart form data
        const formData = new FormData();
        formData.append('carpeta', ambienteBlob + folderName);
        formData.append('fileName', fileName);
        formData.append('archivo', createReadStream(filePath));

        // Upload file using axios (not tapApiClient since we need form-data headers)
        const response = await axios.post(apiUrl, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });

        if (response.status >= 200 && response.status < 300) {
          this.logger.log(`✅ Archivo subido exitosamente: ${fileName}`);
        } else {
          this.logger.warn(
            `⚠️ Fallo en la subida de archivo: ${fileName} - Código ${response.status}`,
          );
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error(
        `❌ Excepción en uploadImageInvoice: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  async triggerManualRadication() {
    this.logger.log('🔧 Manual radication triggered');
    await this.handleRadicationCron();
  }
}
