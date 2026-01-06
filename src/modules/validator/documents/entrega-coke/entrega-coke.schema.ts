import { EntregaCokeBodyFields, EntregaCokeHeaderFields } from './entrega-coke.fields';
import { OCR_Field } from '../common';

type Encabezado = OCR_Field<EntregaCokeHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<EntregaCokeBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type EntregaCokeInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  surveyRecordId: number;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
