import { DateTime, DateTimeMaybeValid } from 'luxon';
import { CokeBodyFields, CokeHeaderFields } from './coke.fields';



export type CokeInvoiceSchema = {
  encabezado: {
    type: CokeHeaderFields;
    text?: string;
    confidence: number;
    error?: string;
  }[];
  detalles: {
    type: CokeBodyFields;
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
