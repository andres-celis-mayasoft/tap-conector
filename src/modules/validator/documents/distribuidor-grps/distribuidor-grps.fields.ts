import { Fields } from '../../enums/fields';

export enum DistribuidorGrpsHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  NUMERO_FACTURA = Fields.NUMERO_FACTURA,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
  TOTAL_FACTURA_SIN_IVA = Fields.TOTAL_FACTURA_SIN_IVA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
}

export enum DistribuidorGrpsBodyFields {
  CODIGO_PRODUCTO = Fields.CODIGO_PRODUCTO,
  ITEM_DESCRIPCION_PRODUCTO = Fields.ITEM_DESCRIPCION_PRODUCTO,
  UNIDADES_VENDIDAS = Fields.UNIDADES_VENDIDAS,
  VALOR_VENTA_ITEM = Fields.VALOR_VENTA_ITEM,
}

export const DISTRIBUIDOR_GRPS_THRESHOLDS = {
  [DistribuidorGrpsHeaderFields.FECHA_FACTURA]: 0.9,
  [DistribuidorGrpsHeaderFields.NUMERO_FACTURA]: 0.85,
  [DistribuidorGrpsHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.95,
  [DistribuidorGrpsHeaderFields.VALOR_TOTAL_FACTURA]: 0.95,
  [DistribuidorGrpsHeaderFields.RAZON_SOCIAL]: 0.95,
  [DistribuidorGrpsBodyFields.CODIGO_PRODUCTO]: 0.9,
  [DistribuidorGrpsBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.9,
  [DistribuidorGrpsBodyFields.UNIDADES_VENDIDAS]: 0.9,
  [DistribuidorGrpsBodyFields.VALOR_VENTA_ITEM]: 0.95,
};
