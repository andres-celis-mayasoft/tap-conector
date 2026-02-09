import { IsInt, IsOptional } from 'class-validator';
import { DocumentType } from './save-invoice.dto';

export class InvoiceToFillResponseDto {
  invoiceId: number;
  surveyId?: string;
  invoiceUrl: string;
  photoType: string;
  photoTypeOcr: string;
  path: string;
  status: string;
  errors?: string;
  assignedAt: Date;
  encabezado: Array<{
    id?: number;
    type: string;
    text: string;
    confidence: number;
  }>;
  detalles: Array<{
    id?: number;
    type: string;
    text: string;
    confidence: number;
    row: number;
  }>;
  documentType: DocumentType;
}

export class GetInvoiceToFillDto {
  @IsInt()
  userId: number;
}
