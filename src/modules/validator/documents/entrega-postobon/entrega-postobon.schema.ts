import { OCR_Field } from '../common';
import { EntregaPostobonHeaderFields, EntregaPostobonBodyFields } from './entrega-postobon.fields';

type Encabezado = OCR_Field<EntregaPostobonHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<EntregaPostobonBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type EntregaPostobonInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
  surveyRecordId: number;
};
