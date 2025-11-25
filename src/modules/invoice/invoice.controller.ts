import { Controller, Get, Post, Body, Logger } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { GetInvoiceToFillDto, InvoiceToFillResponseDto } from './dto/invoice-to-fill.dto';
import { SaveInvoiceDto, SaveInvoiceResponseDto } from './dto/save-invoice.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(private readonly invoiceService: InvoiceService) {}

  /**
   * Get invoice to fill for manual validation
   * Assigns an invoice to the authenticated user or returns their currently assigned invoice
   *
   * @returns Invoice data with extracted fields
   */
  @Get('invoice-to-fill')
  async getInvoiceToFill(
    @CurrentUser('id') userId: number,
  ): Promise<InvoiceToFillResponseDto> {
    this.logger.log(`📋 User ${userId} requesting invoice to fill`);

    try {
      const invoice = await this.invoiceService.assignInvoiceToUser(userId);

      if (!invoice) {
        this.logger.warn(`⚠️ No invoices available for user ${userId}`);
        return  {
          invoiceId: 0,
        } as any;
      }

      // Parse the OCR data
      const ocrData = invoice.mayaInvoiceJson
        ? JSON.parse(invoice.mayaInvoiceJson)
        : { encabezado: [], detalles: [] };

      const response: InvoiceToFillResponseDto = {
        invoiceId: invoice.invoiceId,
        invoiceUrl: invoice.invoiceUrl || '',
        photoType: invoice.photoType || '',
        photoTypeOcr: invoice.photoTypeOcr || '',
        path: invoice.path || '',
        status: invoice.status,
        errors: invoice.errors || undefined,
        assignedAt: invoice.assignedAt || new Date(),
        encabezado: ocrData.encabezado || [],
        detalles: ocrData.detalles || [],
      };

      this.logger.log(
        `✅ Assigned invoice ${invoice.invoiceId} to user ${userId}`,
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
        `✅ Invoice ${saveInvoiceDto.invoiceId} saved successfully. Delivered: ${result.delivered}`,
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
}
