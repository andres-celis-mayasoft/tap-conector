import { QualaBodyFields, QualaHeaderFields } from './quala.fields';

export type QualaInvoiceSchema = {
  encabezado: {
    type: QualaHeaderFields;
    text?: string;
    confidence: number;
    error?: string;
  }[];
  detalles: {
    type: QualaBodyFields;
    text?: string;
    confidence: number;
    row?: number;
    error?: string;
  }[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
};
