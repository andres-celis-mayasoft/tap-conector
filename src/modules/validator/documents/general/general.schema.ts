import { OCR_Field } from '../common';
import {
  GeneralBodyFields,
  GeneralHeaderFields,
} from './general.fields';

type Encabezado = OCR_Field<GeneralHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<GeneralBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type GeneralInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  surveyRecordId: number;
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
