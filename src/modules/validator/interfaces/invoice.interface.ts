import { Fields } from "../enums/fields";

export type FieldType =
  | 'fecha_factura'
  | 'numero_factura'
  | 'razon_social'
  | 'total_factura_sin_iva'
  | 'valor_total_factura'
  | 'codigo_producto'
  | 'item_descripcion_producto'
  | 'tipo_embalaje'
  | 'unidades_vendidas'
  | 'valor_venta_item'
  | 'unidades_embalaje'
  | 'packs_vendidos'
  | 'valor_ibua_y_otros'
  | 'valor_venta_item_total_nc'
  | 'es_devolucion'
  | string; // para extensibilidad

export interface InvoiceEntry {
  type: Fields;
  text?: string;
  confidence: number; // 0.0 - 1.0 (como en tu ejemplo)
  row?: number; // para detalles
  // opcional: valores normalizados y cierre posteriores
  normalized?: string | number;
  finalConfidence?: number; // 0..100
}

export interface ValidateInvoice {
  encabezado: InvoiceEntry[];
  detalles: InvoiceEntry[];
  tipoFacturaOcr: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
}
export interface OC {
  encabezado: InvoiceEntry[];
  detalles: InvoiceEntry[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
}
