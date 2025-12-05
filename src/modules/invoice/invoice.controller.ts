import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  Param,
  Query,
} from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import {
  GetInvoiceToFillDto,
  InvoiceToFillResponseDto,
} from './dto/invoice-to-fill.dto';
import {
  SaveInvoiceDto,
  SaveInvoiceResponseDto,
  MarkInvoiceStatusDto,
  MarkInvoiceStatusResponseDto,
} from './dto/save-invoice.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('invoice-to-fill')
  async getInvoiceToFill(
    @CurrentUser('id') userId: number,
  ): Promise<InvoiceToFillResponseDto> {
    this.logger.log(`📋 User ${userId} requesting invoice to fill`);

    try {
      const invoice = await this.invoiceService.assignInvoiceToUser(userId);

      if (!invoice) {
        this.logger.warn(`⚠️ No invoices available for user ${userId}`);
        return {
          invoiceId: 0,
        } as any;
      }

      // Get OCR data from Fields table
      const invoiceWithFields = await this.invoiceService.getInvoiceWithFields(
        invoice.documentId,
      );

      const response: InvoiceToFillResponseDto = {
        invoiceId: invoice.documentId,
        invoiceUrl: invoice.documentUrl || '',
        photoType: invoice.photoType || '',
        photoTypeOcr: invoice.photoTypeOCR || '',
        path: invoice.path || '',
        status: invoice.status,
        errors: invoice.errors || undefined,
        assignedAt: invoice.assignedAt || new Date(),
        encabezado: invoiceWithFields.encabezado,
        detalles: invoiceWithFields.detalles,
      };

      this.logger.log(
        `✅ Assigned invoice ${invoice.documentId} to user ${userId}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `❌ Error getting invoice to fill for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Save corrected invoice data from manual validation
   * Updates the invoice fields with corrected values
   *
   * @param saveInvoiceDto - Invoice data with corrections
   * @returns Success response with delivery status
   */
  @Public()
  @Post('test-invoice')
  async testInvoice(
    @Query('tipoFoto') tipoFoto: string,
    @Body() testInvoice: { encabezado; detalles; tipoFacturaOcr },
  ) {
    try {
      const result = await this.invoiceService.testInvoice(
        tipoFoto,
        testInvoice,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error testing invoice  ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
  @Public()
  @Get('report')
  async report() {
    try {
      const delivered = await this.invoiceService.reportByStatus();
      const users = await this.invoiceService.reportDeliveredByUser();
      const active = await this.invoiceService.getActiveUsers();

      return { users, delivered , active };
    } catch (error) {
      this.logger.error(
        `❌ Error testing invoice  ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('save-invoice')
  async saveInvoice(
    @CurrentUser('id') userId: number,
    @Body() saveInvoiceDto: SaveInvoiceDto,
  ): Promise<SaveInvoiceResponseDto> {
    this.logger.log(
      `💾 User ${userId} saving invoice ${saveInvoiceDto.invoiceId}`,
    );

    try {
      const result = await this.invoiceService.saveCorrectedInvoice({
        ...saveInvoiceDto,
        userId,
      });

      this.logger.log(
        `✅ Invoice ${saveInvoiceDto.invoiceId} saved successfully. `,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error saving invoice ${saveInvoiceDto.invoiceId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark invoice as outdated
   * Inserts status record and updates document to DELIVERED
   *
   * @param markStatusDto - Contains invoice ID
   * @returns Success response
   */
  @Post('outdated')
  async markAsOutdated(
    @CurrentUser('id') userId: number,
    @Body() markStatusDto: MarkInvoiceStatusDto,
  ): Promise<MarkInvoiceStatusResponseDto> {
    this.logger.log(
      `🔄 User ${userId} marking invoice ${markStatusDto.invoiceId} as outdated`,
    );

    try {
      const result = await this.invoiceService.markAsOutdated(
        markStatusDto.invoiceId,
      );

      this.logger.log(
        `✅ Invoice ${markStatusDto.invoiceId} marked as outdated successfully`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error marking invoice ${markStatusDto.invoiceId} as outdated: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark invoice as illegible
   * Inserts status record and updates document to DELIVERED
   *
   * @param markStatusDto - Contains invoice ID
   * @returns Success response
   */
  @Post('illegible')
  async markAsIllegible(
    @CurrentUser('id') userId: number,
    @Body() markStatusDto: MarkInvoiceStatusDto,
  ): Promise<MarkInvoiceStatusResponseDto> {
    this.logger.log(
      `🔄 User ${userId} marking invoice ${markStatusDto.invoiceId} as illegible`,
    );

    try {
      const result = await this.invoiceService.markAsIllegible(
        markStatusDto.invoiceId,
      );

      this.logger.log(
        `✅ Invoice ${markStatusDto.invoiceId} marked as illegible successfully`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ Error marking invoice ${markStatusDto.invoiceId} as illegible: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
