import { DateTime, DateTimeMaybeValid } from 'luxon';
import { CokeBodyFields, CokeHeaderFields } from './coke.fields';
import { OCR_Field } from '../common';

type Encabezado = OCR_Field<CokeHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<CokeBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type CokeInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  surveyRecordId: number;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
