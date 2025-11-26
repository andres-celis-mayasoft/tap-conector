import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ValidatorService } from './validator.service';
import { ValidateInvoiceDto } from './dto/validate-invoice.dto';

@Controller('validator')
export class ValidatorController {
  constructor(private readonly validatorService: ValidatorService) {}

   @Post('invoice')
   async validateInvoice(@Body() body: ValidateInvoiceDto) {
     return this.validatorService.validateInvoice(body);
   }

  @Get('test-invoice/:facturaId')
  async testInvoice(@Param('facturaId', ParseIntPipe) facturaId: number) {
    return this.validatorService.testInvoice(facturaId);
  }
}
