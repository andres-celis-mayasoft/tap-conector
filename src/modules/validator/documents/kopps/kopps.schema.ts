import { OCR_Field } from '../common';
import {
  KoppsBodyFields,
  KoppsHeaderFields,
} from './kopps.fields';

type Encabezado = OCR_Field<KoppsHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<KoppsBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type KoppsInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  surveyRecordId: number;
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
