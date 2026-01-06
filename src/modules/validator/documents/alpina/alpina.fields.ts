import { Fields } from '../../enums/fields';

export enum AlpinaHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  NUMERO_FACTURA = Fields.NUMERO_FACTURA,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
  TOTAL_FACTURA_SIN_IVA = Fields.TOTAL_FACTURA_SIN_IVA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
}

export enum AlpinaBodyFields {
  CODIGO_PRODUCTO = Fields.CODIGO_PRODUCTO,
  ITEM_DESCRIPCION_PRODUCTO = Fields.ITEM_DESCRIPCION_PRODUCTO,
  UNIDADES_VENDIDAS = Fields.UNIDADES_VENDIDAS,
  TIPO_EMBALAJE = Fields.TIPO_EMBALAJE,
  VALOR_VENTA_ITEM = Fields.VALOR_VENTA_ITEM,
}

export const ALPINA_THRESHOLDS = {
  [AlpinaHeaderFields.FECHA_FACTURA]: 0.9,
  [AlpinaHeaderFields.NUMERO_FACTURA]: 0.85,
  [AlpinaHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.95,
  [AlpinaHeaderFields.VALOR_TOTAL_FACTURA]: 0.95,
  [AlpinaHeaderFields.RAZON_SOCIAL]: 0.95,
  [AlpinaBodyFields.CODIGO_PRODUCTO]: 0.9,
  [AlpinaBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.9,
  [AlpinaBodyFields.TIPO_EMBALAJE]: 0.95,
  [AlpinaBodyFields.UNIDADES_VENDIDAS]: 0.9,
  [AlpinaBodyFields.VALOR_VENTA_ITEM]: 0.95,
};
