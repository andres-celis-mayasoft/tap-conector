import { Fields } from '../../enums/fields';

export enum EntregaPostobonHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
}

export enum EntregaPostobonBodyFields {
  ITEM_DESCRIPCION_PRODUCTO = Fields.ITEM_DESCRIPCION_PRODUCTO,
  UNIDADES_EMBALAJE = Fields.UNIDADES_EMBALAJE,
  PACKS_VENDIDOS = Fields.PACKS_VENDIDOS,
  VALOR_VENTA_ITEM = Fields.VALOR_VENTA_ITEM,
}

export const ENTREGA_POSTOBON_THRESHOLDS = {
  [EntregaPostobonHeaderFields.FECHA_FACTURA]: 0.9,
  [EntregaPostobonHeaderFields.VALOR_TOTAL_FACTURA]: 0.95,
  [EntregaPostobonHeaderFields.RAZON_SOCIAL]: 0.95,
  [EntregaPostobonBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.9,
  [EntregaPostobonBodyFields.VALOR_VENTA_ITEM]: 0.95,
  [EntregaPostobonBodyFields.PACKS_VENDIDOS]: 0.9,
  [EntregaPostobonBodyFields.UNIDADES_EMBALAJE]: 0.9,
};
