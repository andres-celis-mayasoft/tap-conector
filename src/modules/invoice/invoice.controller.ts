import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  Param,
  Query,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { InvoiceService } from './invoice.service';
import {
  GetInvoiceToFillDto,
  InvoiceToFillResponseDto,
} from './dto/invoice-to-fill.dto';
import { SaveInvoiceDto, InvoiceStatus, DocumentType } from './dto/save-invoice.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { StickerService } from '../sticker/sticker.service';

@Controller('invoice')
export class InvoiceController {
  private readonly logger = new Logger(InvoiceController.name);

  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly stickerService: StickerService,
  ) {}

  @Get('invoice-to-fill')
  async getInvoiceToFill(
    @CurrentUser('id') userId: number,
  ): Promise<InvoiceToFillResponseDto> {
    this.logger.log(`User ${userId} requesting invoice to fill`);

    try {
      // 1. First try to assign a sticker
      const sticker = await this.stickerService.assignNextToUser(userId);

      if (sticker) {
        this.logger.log(`Assigned sticker ${sticker.externalId} to user ${userId}`);
        return {
          invoiceId: sticker.externalId,
          surveyId: sticker.submissionId,
          invoiceUrl: sticker.photoLink || '',
          photoType: 'STICKER',
          photoTypeOcr: 'STICKER',
          path: '',
          status: sticker.status,
          errors: sticker.errors || undefined,
          assignedAt: sticker.assignedAt || new Date(),
          encabezado: [
            {
              type: 'sticker_value',
              text: '',
              confidence: 0,
            },
          ],
          detalles: [],
          documentType: DocumentType.STICKER
        };
      }

      // 2. If no stickers available, try to assign an invoice
      const invoice = await this.invoiceService.assignInvoiceToUser(userId);

      if (!invoice) {
        this.logger.warn(`No invoices available for user ${userId}`);
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
        surveyId: invoice.surveyId || undefined,
        invoiceUrl: invoice.documentUrl || '',
        photoType: invoice.photoType || '',
        photoTypeOcr: invoice.photoTypeOCR || '',
        path: invoice.path || '',
        status: invoice.status,
        errors: invoice.errors || undefined,
        assignedAt: invoice.assignedAt || new Date(),
        encabezado: invoiceWithFields.encabezado,
        detalles: invoiceWithFields.detalles,
        documentType: DocumentType.INVOICE
      };

      this.logger.log(
        `Assigned invoice ${invoice.documentId} to user ${userId}`,
      );

      return response;
    } catch (error) {
      this.logger.error(
        `Error getting invoice to fill for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Serve invoice image file
   * GET /invoice/image/:filename
   * Returns the image file from the uploads directory
   */
  @Get('image/:filename')
  async getInvoiceImage(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      this.logger.log(`Serving image: ${filename}`);

      // Security: Validate filename to prevent path traversal attacks
      if (
        filename.includes('..') ||
        filename.includes('/') ||
        filename.includes('\\')
      ) {
        this.logger.warn(`Invalid filename attempted: ${filename}`);
        throw new BadRequestException('Invalid filename');
      }

      // Get the image file
      const imageBuffer = await this.invoiceService.getInvoiceImage(filename);

      // Set appropriate headers
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

      // Send the image
      res.send(imageBuffer);
    } catch (error) {
      this.logger.error(
        `Error serving image ${filename}: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new NotFoundException(`Image ${filename} not found`);
    }
  }

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
      this.logger.error(`Error testing invoice: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Public()
  @Get('report')
  async report(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    try {
      const status = await this.invoiceService.reportByStatus();
      const users = await this.invoiceService.reportDeliveredByUser();
      const active = await this.invoiceService.getActiveUsers();
      const missing = await this.invoiceService.getMissing(startDate, endDate);

      return { users, status, active, missing };
    } catch (error) {
      this.logger.error(
        `Error generating report: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Save document data from manual validation
   * Handles both invoices and stickers based on documentType
   * Handles all status types: COMPLETED, OUTDATED, NOT_FOR_STUDY, ILLEGIBLE, OMIT
   */
  @Post('save-invoice')
  async saveInvoice(
    @CurrentUser('id') userId: number,
    @Body() saveInvoiceDto: SaveInvoiceDto,
  ) {
    const { invoiceId, tipoFactura, status, documentType } = saveInvoiceDto;
    const effectiveStatus = status || InvoiceStatus.COMPLETED;
    const isSticker = documentType === DocumentType.STICKER || tipoFactura === 'Sticker';

    this.logger.log(
      `User ${userId} saving ${isSticker ? 'sticker' : 'invoice'} ${invoiceId} with status ${effectiveStatus}`,
    );

    try {
      // Route to sticker service if documentType is STICKER
      if (isSticker) {
        await this.stickerService.saveCorrectedSticker({
          userId,
          stickerId: invoiceId,
          fields: saveInvoiceDto.encabezado,
        });

        this.logger.log(`Sticker ${invoiceId} saved successfully`);
        return { success: true, documentType: 'STICKER' };
      }

      // Handle Invoice based on status
      switch (effectiveStatus) {
        case InvoiceStatus.COMPLETED:
          await this.invoiceService.saveCorrectedInvoice({
            ...saveInvoiceDto,
            userId,
          });
          break;

        case InvoiceStatus.OUTDATED:
          await this.invoiceService.markAsOutdated(invoiceId);
          break;

        case InvoiceStatus.NOT_FOR_STUDY:
          await this.invoiceService.markAsNotApplyStudy(invoiceId);
          break;

        case InvoiceStatus.ILLEGIBLE:
          await this.invoiceService.markAsIllegible(invoiceId);
          break;

        case InvoiceStatus.OMIT:
          await this.invoiceService.omitDocument(invoiceId);
          break;

        default:
          throw new BadRequestException(`Invalid status: ${effectiveStatus}`);
      }

      this.logger.log(
        `Invoice ${invoiceId} processed with status ${effectiveStatus}`,
      );
      return { success: true, documentType: 'INVOICE' };
    } catch (error) {
      this.logger.error(
        `Error saving ${isSticker ? 'sticker' : 'invoice'} ${invoiceId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Manually trigger sending pending documents to Meiko
   * POST /invoice/send-pending
   */
  @Post('send-pending')
  async sendPendingDocuments() {
    this.logger.log('Manually triggering send pending documents');

    try {
      const sentCount = await this.invoiceService.sendPendingDocuments();

      this.logger.log(
        `Successfully sent ${sentCount} pending documents to Meiko`,
      );

      return {
        success: true,
        message: `Successfully sent ${sentCount} pending documents to Meiko`,
        count: sentCount,
      };
    } catch (error) {
      this.logger.error(
        `Error sending pending documents: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
