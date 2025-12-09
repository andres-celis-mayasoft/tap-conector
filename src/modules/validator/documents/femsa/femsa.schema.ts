import { FemsaBodyFields, FemsaHeaderFields } from './femsa.fields';
import { OCR_Field } from '../common';

type Encabezado = OCR_Field<FemsaHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<FemsaBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type FemsaInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  surveyRecordId: number;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
