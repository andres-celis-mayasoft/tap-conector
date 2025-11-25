import { IsInt, IsOptional } from 'class-validator';

export class InvoiceToFillResponseDto {
  invoiceId: number;
  invoiceUrl: string;
  photoType: string;
  photoTypeOcr: string;
  path: string;
  status: string;
  errors?: string;
  assignedAt: Date;
  encabezado: Array<{
    type: string;
    text: string;
    confidence: number;
  }>;
  detalles: Array<{
    type: string;
    text: string;
    confidence: number;
    row: number;
  }>;
}

export class GetInvoiceToFillDto {
  @IsInt()
  userId: number;
}
