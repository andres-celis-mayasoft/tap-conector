import { Controller, Get, Query, ParseIntPipe, Param } from '@nestjs/common';
import { MeikoService } from './meiko.service';

/**
 * Meiko Controller
 * Provides endpoints to interact with Meiko database
 */
@Controller('meiko')
export class MeikoController {
  constructor(private readonly meikoService: MeikoService) {}

  /**
   * Get invoices with id_factura greater than maxId
   * GET /meiko/invoices?maxId=100
   */
  @Get('invoices')
  async getInvoices(@Query('maxId', ParseIntPipe) maxId: number) {
    return this.meikoService.getInvoices(maxId);
  }

  /**
   * Get count of invoices with id_factura greater than maxId
   * GET /meiko/invoices/count?maxId=100
   */
  @Get('invoices/count')
  async getInvoicesCount(@Query('maxId', ParseIntPipe) maxId: number) {
    const count = await this.meikoService.getInvoicesCount(maxId);
    return {
      count,
      maxId,
    };
  }

  /**
   * Get a single invoice by ID
   * GET /meiko/invoices/:id
   */
  @Get('invoices/:id')
  async getInvoiceById(@Param('id', ParseIntPipe) id: number) {
    return this.meikoService.getInvoiceById(id);
  }

  /**
   * Get invoices by date range without digitization status
   * GET /meiko/invoices/by-date-range?startDate=2025-12-05&endDate=2025-12-10
   */
  @Get('invoices/by-date-range')
  async getInvoicesByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.meikoService.getInvoicesByDateRange(startDate, endDate);
  }
}
