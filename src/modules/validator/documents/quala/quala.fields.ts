export enum QualaHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  RAZON_SOCIAL = 'razon_social',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
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
  [QualaBodyFields.CODIGO_PRODUCTO]: 0.96,
  [QualaBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.95,
  [QualaBodyFields.UNIDADES_VENDIDAS]: 0.94,
  [QualaBodyFields.TOTAL_IBUA]: 0.82,
  [QualaBodyFields.UNIDADES_EMBALAJE]: 0.97,
  [QualaBodyFields.VALOR_VENTA_ITEM]: 0.8,
  };