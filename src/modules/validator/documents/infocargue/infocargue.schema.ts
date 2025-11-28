import {
  InfocargueBodyFields,
  InfocargueHeaderFields,
} from './infocargue.fields';

export type InfocargueInvoiceSchema = {
  encabezado: {
    type: InfocargueHeaderFields;
    text?: string;
    confidence: number;
    error?: string;
  }[];
  detalles: {
    type: InfocargueBodyFields;
    text?: string;
    confidence: number;
    row?: number;
    error?: string;
  }[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
};
