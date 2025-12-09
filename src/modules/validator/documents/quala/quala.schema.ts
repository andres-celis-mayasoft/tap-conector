import { OCR_Field } from '../common';
import { QualaBodyFields, QualaHeaderFields } from './quala.fields';

type Encabezado = OCR_Field<QualaHeaderFields> & {
  error?: string;
  row: number;
  id?: number;
};
type Detalles = OCR_Field<QualaBodyFields> & {
  error?: string;
  row: number;
  id?: number;
};

export type QualaInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  surveyRecordId: number;
  id?: number;
  facturaId: number;
};
