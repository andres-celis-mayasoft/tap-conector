import {
  IsInt,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum InvoiceStatus {
  COMPLETED = 'COMPLETED',
  OUTDATED = 'OUTDATED',
  NOT_FOR_STUDY = 'NOT_FOR_STUDY',
  ILLEGIBLE = 'ILLEGIBLE',
  OMIT = 'OMIT',
}

export enum DocumentType {
  INVOICE = 'INVOICE',
  STICKER = 'STICKER',
}

export class FieldUpdateDto {
  @IsOptional()
  @IsInt()
  id?: number;

  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  text: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsOptional()
  @IsInt()
  row?: number;
}

export class SaveInvoiceDto {
  @IsInt()
  invoiceId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldUpdateDto)
  encabezado: FieldUpdateDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldUpdateDto)
  detalles: FieldUpdateDto[];

  @IsString()
  tipoFactura: string;

  @IsOptional()
  @IsString()
  photoType?: string | null;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;
}

export class SaveInvoiceResponseDto {
  success: boolean;
  message?: string;
  invoiceId?: number;
}
