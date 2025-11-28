import { TiquetePosPostobonBodyFields, TiquetePosPostobonHeaderFields } from './tiquete-pos-postobon.fields';

export type TiquetePosPostobonInvoiceSchema = {
  encabezado: {
    type: TiquetePosPostobonHeaderFields;
    text?: string;
    confidence: number;
    error?: string;
  }[];
  detalles: {
    type: TiquetePosPostobonBodyFields;
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
