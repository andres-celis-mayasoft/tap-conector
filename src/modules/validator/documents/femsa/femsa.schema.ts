import { DateTime, DateTimeMaybeValid } from 'luxon';
import { FemsaBodyFields, FemsaHeaderFields } from './femsa.fields';

export type FemsaInvoiceSchema = {
  encabezado: {
    type: FemsaHeaderFields;
    text?: string;
    confidence: number;
    error?: string;
  }[];
  detalles: {
    type: FemsaBodyFields;
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
