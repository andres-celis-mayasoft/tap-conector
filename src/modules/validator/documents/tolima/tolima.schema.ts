import { DateTime, DateTimeMaybeValid } from 'luxon';
import { TolimaBodyFields, TolimaHeaderFields } from './tolima.fields';
import { OCR_Field } from '../common';

type Encabezado = OCR_Field<TolimaHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<TolimaBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type TolimaInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  surveyRecordId: number;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
