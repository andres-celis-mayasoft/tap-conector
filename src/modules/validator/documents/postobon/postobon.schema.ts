import { PostobonBodyFields, PostobonHeaderFields } from './postobon.fields';

export type PostobonInvoiceSchema = {
  encabezado: {
    type: PostobonHeaderFields;
    text?: string;
    confidence: number;
    error?: string;
  }[];
  detalles: {
    type: PostobonBodyFields;
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
