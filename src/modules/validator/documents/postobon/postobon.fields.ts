import { Fields } from "../../enums/fields";

export enum PostobonHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  NUMERO_FACTURA = Fields.NUMERO_FACTURA,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
  TOTAL_FACTURA_SIN_IVA = Fields.TOTAL_FACTURA_SIN_IVA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
}

export enum PostobonBodyFields {
  
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  PACKS_VENDIDOS = 'packs_vendidos',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',
  VALOR_TOTAL_UNITARIO_ITEM = 'valor_total_unitario_item',
  VALOR_DESCUENTO_ITEM = 'valor_descuento_item',
  APLICA_IVA_ITEM = 'aplica_iva_item',
}


export const POSTOBON_THRESOLDS = {
  [PostobonHeaderFields.NUMERO_FACTURA]: 0.92,
  [PostobonHeaderFields.FECHA_FACTURA]: 0.96,
  [PostobonHeaderFields.RAZON_SOCIAL]: 0.99,
  [PostobonHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.97,
  [PostobonHeaderFields.VALOR_TOTAL_FACTURA]: 0.93,
  [PostobonBodyFields.CODIGO_PRODUCTO]: 0.96,
  [PostobonBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.90,
  [PostobonBodyFields.TIPO_EMBALAJE]: 0.99,
  [PostobonBodyFields.PACKS_VENDIDOS]: 0.99,
  [PostobonBodyFields.VALOR_VENTA_ITEM]: 0.94,
  [PostobonBodyFields.UNIDADES_EMBALAJE]: 0.95,
  };
