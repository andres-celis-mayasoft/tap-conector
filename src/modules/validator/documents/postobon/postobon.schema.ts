import { OCR_Field } from '../common';
import { PostobonBodyFields, PostobonHeaderFields } from './postobon.fields';

type Encabezado = OCR_Field<PostobonHeaderFields> & {
  error?: string;
  row: number;
  id?: number;
};
type Detalles = OCR_Field<PostobonHeaderFields> & {
  error?: string;
  row: number;
  id?: number;
};

export type PostobonInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  surveyRecordId: number;
  id?: number;
  facturaId: number;
};
