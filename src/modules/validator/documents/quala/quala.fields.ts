import { Fields } from "../../enums/fields";

export enum QualaHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  NUMERO_FACTURA = Fields.NUMERO_FACTURA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
  TOTAL_FACTURA_SIN_IVA = Fields.TOTAL_FACTURA_SIN_IVA,
}

export enum QualaBodyFields {
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',

  // TO IGNORE
  VALOR_IVA = 'valor_iva',
  TOTAL_ICO = 'total_ico',
  PORCENTAJE_ICUI = 'porcentaje_icui',
  TOTAL_IBUA = 'total_ibua',
}

export const QUALA_THRESOLDS = {
  [QualaHeaderFields.FECHA_FACTURA]: 0.98,
  [QualaHeaderFields.NUMERO_FACTURA]: 0.91,
  [QualaHeaderFields.RAZON_SOCIAL]: 0.99,
  [QualaHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.77,
  [QualaHeaderFields.VALOR_TOTAL_FACTURA]: 0.96,
  [QualaBodyFields.CODIGO_PRODUCTO]: 0.90 ,
  [QualaBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.95,
  [QualaBodyFields.UNIDADES_VENDIDAS]: 0.94,
  [QualaBodyFields.TOTAL_IBUA]: 0.82,
  [QualaBodyFields.UNIDADES_EMBALAJE]: 0.90,
  [QualaBodyFields.VALOR_VENTA_ITEM]: 0.8,
  };