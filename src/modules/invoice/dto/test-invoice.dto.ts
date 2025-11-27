import {
  IsInt,
  IsString,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FieldUpdateDto {
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
}

export class SaveInvoiceResponseDto {
  success: boolean;
  message: string;
  invoiceId: number;
  delivered: boolean; // If confidence reached 100%, it was auto-delivered
}

export class MarkInvoiceStatusDto {
  @IsInt()
  invoiceId: number;
}

export class MarkInvoiceStatusResponseDto {
  success: boolean;
  message: string;
  invoiceId: number;
}
