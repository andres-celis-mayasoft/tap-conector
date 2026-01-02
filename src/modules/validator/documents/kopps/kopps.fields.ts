import { Fields } from "../../enums/fields";

export enum KoppsHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  NUMERO_FACTURA = Fields.NUMERO_FACTURA,
  TOTAL_FACTURA_SIN_IVA = Fields.TOTAL_FACTURA_SIN_IVA,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
}

export enum KoppsBodyFields {
  CODIGO_PRODUCTO = Fields.CODIGO_PRODUCTO,
  VALOR_UNITARIO_ITEM = Fields.VALOR_UNITARIO_ITEM,
  ITEM_DESCRIPCION_PRODUCTO = Fields.ITEM_DESCRIPCION_PRODUCTO,
  UNIDADES_EMBALAJE = Fields.UNIDADES_EMBALAJE,
  PACKS_VENDIDOS = Fields.PACKS_VENDIDOS,
  TIPO_EMBALAJE = Fields.TIPO_EMBALAJE,
  PRECIO_BRUTO_ITEM = Fields.PRECIO_BRUTO_ITEM,
  VALOR_VENTA_ITEM = Fields.VALOR_VENTA_ITEM,
  TOTAL_ICO = Fields.TOTAL_ICO,
  VALOR_IVA = Fields.VALOR_IVA,
  DESCUENTO = Fields.DESCUENTO
}

export const KOPPS_THRESOLDS : Record<KoppsHeaderFields | KoppsBodyFields, number> = {
  
  [KoppsHeaderFields.FECHA_FACTURA]: 0.95,
  [KoppsHeaderFields.VALOR_TOTAL_FACTURA]: 0.93,
  [KoppsHeaderFields.RAZON_SOCIAL]: 0.99,
  [KoppsHeaderFields.NUMERO_FACTURA]: 0.89,
  [KoppsHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.93,

  [KoppsBodyFields.CODIGO_PRODUCTO]: 0.82,
  [KoppsBodyFields.VALOR_UNITARIO_ITEM]: 0.91,
  [KoppsBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.88,
  [KoppsBodyFields.PACKS_VENDIDOS]: 0.95,
  [KoppsBodyFields.TIPO_EMBALAJE]: 0.94,
  [KoppsBodyFields.PRECIO_BRUTO_ITEM]: 0.92,
  [KoppsBodyFields.VALOR_VENTA_ITEM]: 0.90,
  [KoppsBodyFields.UNIDADES_EMBALAJE]: 0.87,
  [KoppsBodyFields.VALOR_IVA]: 0.93,
  [KoppsBodyFields.TOTAL_ICO]: 0.89,
  [KoppsBodyFields.DESCUENTO]: 0.86,
};
