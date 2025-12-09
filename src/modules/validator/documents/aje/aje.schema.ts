import { OCR_Field } from '../common';
import { AjeBodyFields, AjeHeaderFields } from './aje.fields';

type Encabezado = OCR_Field<AjeHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<AjeBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type AjeInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
  surveyRecordId: number;
};
