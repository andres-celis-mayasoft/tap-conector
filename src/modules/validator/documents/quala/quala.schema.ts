import { QualaBodyFields, QualaHeaderFields } from './quala.fields';

export type QualaInvoiceSchema = {
  encabezado: {
    type: QualaHeaderFields;
    text?: string;
    confidence: number;
  }[];
  detalles: {
    type: QualaBodyFields;
    text?: string;
    confidence: number;
    row?: number;
  }[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
};
