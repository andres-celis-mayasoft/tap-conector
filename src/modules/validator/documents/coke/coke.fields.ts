export enum CokeHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  RAZON_SOCIAL = 'razon_social',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
}

export enum CokeBodyFields {
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  VALOR_IBUA_Y_OTROS = 'valor_ibua_y_otros',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',
}

export const COKE_THRESOLDS = {
  [CokeHeaderFields.FECHA_FACTURA]: 0.96,
  [CokeHeaderFields.NUMERO_FACTURA]: 0.94,
  [CokeHeaderFields.RAZON_SOCIAL]: 0.99,
  [CokeHeaderFields.VALOR_TOTAL_FACTURA]: 0.93,
  [CokeBodyFields.CODIGO_PRODUCTO]: 0.46,
  [CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.8,
  [CokeBodyFields.TIPO_EMBALAJE]: 0.44,
  [CokeBodyFields.UNIDADES_VENDIDAS]: 0.41,
  [CokeBodyFields.VALOR_VENTA_ITEM]: 0.87,
  [CokeBodyFields.VALOR_IBUA_Y_OTROS]: 0.43,
  [CokeBodyFields.UNIDADES_EMBALAJE]: 0.45,
};
