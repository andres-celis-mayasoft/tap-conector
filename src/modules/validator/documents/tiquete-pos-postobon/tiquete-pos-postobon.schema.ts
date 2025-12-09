import { OCR_Field } from '../common';
import {
  TiquetePosPostobonBodyFields,
  TiquetePosPostobonHeaderFields,
} from './tiquete-pos-postobon.fields';
type Encabezado = OCR_Field<TiquetePosPostobonHeaderFields> & {
  error?: string;
  row: number;
  id?: number;
};
type Detalles = OCR_Field<TiquetePosPostobonBodyFields> & {
  error?: string;
  row: number;
  id?: number;
};

export type TiquetePosPostobonInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  surveyRecordId: number;
  facturaId: number;
};
