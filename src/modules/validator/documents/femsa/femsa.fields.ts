export enum FemsaHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  RAZON_SOCIAL = 'razon_social',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
  IVA_TARIFA_GENERAL = 'iva_tarifa_general',
  IBUA = 'ibua',
}

export enum FemsaBodyFields {
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  VALOR_IBUA_Y_OTROS = 'valor_ibua_y_otros',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  CANTIDAD = 'cantidad',
  VALOR_DESCUENTO = 'valor_descuento',
}

export const FEMSA_THRESOLDS = {
  [FemsaHeaderFields.FECHA_FACTURA]: 0.95,
  [FemsaHeaderFields.NUMERO_FACTURA]: 0.97,
  [FemsaHeaderFields.VALOR_TOTAL_FACTURA]: 0.88,
  [FemsaHeaderFields.RAZON_SOCIAL]: 0.99,
  [FemsaHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.88,
  [FemsaBodyFields.CODIGO_PRODUCTO]: 0.95,
  [FemsaBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.92,
  [FemsaBodyFields.UNIDADES_VENDIDAS]: 0.83,
  [FemsaBodyFields.UNIDADES_EMBALAJE]: 0.85,
  [FemsaBodyFields.TIPO_EMBALAJE]: 0.88,
  [FemsaBodyFields.VALOR_UNITARIO_ITEM]: 0.93,
  [FemsaBodyFields.VALOR_VENTA_ITEM]: 0.9,
  [FemsaBodyFields.VALOR_IBUA_Y_OTROS]: 0.89,
};
