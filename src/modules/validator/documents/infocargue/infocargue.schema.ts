import { OCR_Field } from '../common';
import {
  InfocargueBodyFields,
  InfocargueHeaderFields,
} from './infocargue.fields';

type Encabezado = OCR_Field<InfocargueHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<InfocargueBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type InfocargueInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  surveyRecordId: number;
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
};
