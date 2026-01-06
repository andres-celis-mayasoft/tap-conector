import { Fields } from "../../enums/fields";

export enum EntregaCokeHeaderFields {
  FECHA_FACTURA = Fields.FECHA_FACTURA,
  NUMERO_FACTURA = Fields.NUMERO_FACTURA,
  RAZON_SOCIAL = Fields.RAZON_SOCIAL,
  VALOR_TOTAL_FACTURA = Fields.VALOR_TOTAL_FACTURA,
}

export enum EntregaCokeBodyFields {
  CODIGO_PRODUCTO = Fields.CODIGO_PRODUCTO,
  ITEM_DESCRIPCION_PRODUCTO = Fields.ITEM_DESCRIPCION_PRODUCTO,
  TIPO_EMBALAJE = Fields.TIPO_EMBALAJE,
  UNIDADES_VENDIDAS = Fields.UNIDADES_VENDIDAS,
  VALOR_VENTA_ITEM = Fields.VALOR_VENTA_ITEM,
  VALOR_IBUA_Y_OTROS = Fields.VALOR_IBUA_Y_OTROS,
  UNIDADES_EMBALAJE = Fields.UNIDADES_EMBALAJE,
  VALOR_UNITARIO_ITEM = Fields.VALOR_UNITARIO_ITEM,
}

export const ENTREGA_COKE_THRESOLDS = {
  [EntregaCokeHeaderFields.FECHA_FACTURA]: 0.96,
  [EntregaCokeHeaderFields.NUMERO_FACTURA]: 0.94,
  [EntregaCokeHeaderFields.RAZON_SOCIAL]: 0.99,
  [EntregaCokeHeaderFields.VALOR_TOTAL_FACTURA]: 0.93,
  [EntregaCokeBodyFields.CODIGO_PRODUCTO]: 0.46,
  [EntregaCokeBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.8,
  [EntregaCokeBodyFields.TIPO_EMBALAJE]: 0.44,
  [EntregaCokeBodyFields.UNIDADES_VENDIDAS]: 0.41,
  [EntregaCokeBodyFields.VALOR_VENTA_ITEM]: 0.87,
  [EntregaCokeBodyFields.VALOR_IBUA_Y_OTROS]: 0.43,
  [EntregaCokeBodyFields.UNIDADES_EMBALAJE]: 0.45,
};
