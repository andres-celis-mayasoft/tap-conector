import { Body, Controller, Post } from '@nestjs/common';
import { ValidatorService } from './validator.service';
import { ValidateInvoiceDto } from './dto/validate-invoice.dto';

@Controller('validator')
export class ValidatorController {
  constructor(private readonly validatorService: ValidatorService) {}

  @Post('invoice')
  async validateInvoice(@Body() body: ValidateInvoiceDto) {
    return this.validatorService.validateInvoice(body);
  }
}
