import { OCR_Field } from '../common';
import { DistribuidorGrpsHeaderFields, DistribuidorGrpsBodyFields } from './distribuidor-grps.fields';

type Encabezado = OCR_Field<DistribuidorGrpsHeaderFields> & {
  id?: number;
  error?: string;
  row: number;
};
type Detalles = OCR_Field<DistribuidorGrpsBodyFields> & {
  id?: number;
  error?: string;
  row: number;
};

export type DistribuidorGrpsInvoiceSchema = {
  encabezado: Encabezado[];
  detalles: Detalles[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId: number;
  surveyRecordId: number;
};
