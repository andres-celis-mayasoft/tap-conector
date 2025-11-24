import { InfocargueBodyFields, InfocargueHeaderFields } from './infocargue.fields';

export type InfocargueInvoiceSchema = {
  encabezado: {
    type: InfocargueHeaderFields;
    text?: string;
    confidence: number;
  }[];
  detalles: {
    type: InfocargueBodyFields;
    text?: string;
    confidence: number;
    row?: number;
  }[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
};
