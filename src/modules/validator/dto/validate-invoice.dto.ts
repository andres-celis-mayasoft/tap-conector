import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';
import { InvoiceEntry, ValidateInvoice } from '../interfaces/invoice.interface';

export class ValidateInvoiceDto implements ValidateInvoice {
  @IsArray()
  encabezado: InvoiceEntry[];

  @IsArray()
  detalles: InvoiceEntry[];

  @IsOptional()
  @IsString()
  tipoFacturaOcr?: string;

  @IsOptional()
  @IsString()
  urlFactura?: string;

  @IsOptional()
  @IsNumber()
  id?: number;

  @IsOptional()
  @IsNumber()
  facturaId?: number;
}
