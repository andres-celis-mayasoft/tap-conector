import { OCR_Field } from '../common';
import { AlpinaBodyFields, AlpinaHeaderFields } from './alpina.fields';

type Encabezado = OCR_Field<AlpinaHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<AlpinaBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type AlpinaInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
  surveyRecordId: number;
};
