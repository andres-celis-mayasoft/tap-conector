import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosRequestConfig } from 'axios';
import FormData from 'form-data';
import * as fs from 'fs';

export interface InvoiceOcrRequest {
  filePath: string;
  typeOfInvoice: string;
}

export interface OcrResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * OCR Service
 * Handles communication with external OCR service for invoice processing
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly ocrApiUrl: string | undefined;
  private readonly ocrApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.ocrApiUrl = this.configService.get<string>('OCR_API_URL');
    this.ocrApiKey = this.configService.get<string>('OCR_API_KEY');

    if (!this.ocrApiUrl) {
      this.logger.warn('OCR_API_URL is not configured');
    }

    if (!this.ocrApiKey) {
      this.logger.warn('OCR_API_KEY is not configured');
    }
  }

  /**
   * Send invoice to OCR service for processing
   * @param request Invoice OCR request containing file path and type
   * @returns OCR response with extracted data
   */
  async processInvoice(request: InvoiceOcrRequest): Promise<OcrResponse> {
    if (!this.ocrApiUrl) {
      throw new HttpException(
        'OCR_API_URL is not configured in environment variables.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!this.ocrApiKey) {
      throw new HttpException(
        'OCR_API_KEY is not configured in environment variables.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (!request.filePath) {
      throw new HttpException('File path is required', HttpStatus.BAD_REQUEST);
    }

    if (!request.typeOfInvoice) {
      throw new HttpException(
        'Type of invoice is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      this.logger.log(
        `Sending invoice to OCR service: ${request.filePath} (type: ${request.typeOfInvoice})`,
      );

      // Create form data
      const formData = new FormData();

      // Read file and add to form data
      const fileStream = fs.createReadStream(request.filePath);
      formData.append('invoice', fileStream);
      formData.append('type_of_invoice', request.typeOfInvoice);

      // Configure request with headers
      const config: AxiosRequestConfig = {
        headers: {
          ...formData.getHeaders(),
          'X-API-Key': this.ocrApiKey,
        },
        timeout: 300000,
      };

      // Send POST request
      const response = await axios.post(this.ocrApiUrl, formData, config);

      this.logger.log(`OCR processing successful for ${request.filePath}`);

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(
        `Error processing invoice with OCR: ${error.message}`,
        error.stack,
      );

      if (
        error.response.data.detail.includes("Tipo de factura 'Factura Otros Proveedores'")
      ) {
        this.logger.log('Tipo de factura no soportada, omitiendo error');
        return {
          success: true,
          data: {
            response: {
              tipoFacturaOcr: 'Factura Otros Proveedores',
            }
          },
        };
      }

      if (axios.isAxiosError(error)) {
        const statusCode =
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const errorMessage = error.response?.data?.message || error.message;

        throw new HttpException(
          `OCR service error: ${errorMessage}`,
          statusCode,
        );
      }

      throw new HttpException(
        `Failed to process invoice with OCR: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Send multiple invoices to OCR service
   * @param requests Array of invoice OCR requests
   * @returns Array of OCR responses
   */
  async processInvoices(requests: InvoiceOcrRequest[]): Promise<OcrResponse[]> {
    this.logger.log(`Processing ${requests.length} invoices with OCR`);

    const results: OcrResponse[] = [];

    for (const request of requests) {
      try {
        const result = await this.processInvoice(request);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Error processing invoice ${request.filePath}: ${error.message}`,
        );
        results.push({
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    this.logger.log(
      `OCR batch processing completed: ${successCount} successful, ${errorCount} errors`,
    );

    return results;
  }

  /**
   * Check if OCR service is configured
   */
  isConfigured(): boolean {
    return !!(this.ocrApiUrl && this.ocrApiKey);
  }

  /**
   * Get the configured OCR API URL
   */
  getApiUrl(): string | undefined {
    return this.ocrApiUrl;
  }
}
