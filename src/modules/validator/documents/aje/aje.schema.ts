import { AjeBodyFields, AjeHeaderFields } from './aje.fields';

export type AjeInvoiceSchema = {
  encabezado: {
    type: AjeHeaderFields;
    text?: string;
    confidence: number;
  }[];
  detalles: {
    type: AjeBodyFields;
    text?: string;
    confidence: number;
    row?: number;
  }[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
};
