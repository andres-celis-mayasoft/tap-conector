export enum PostobonTiqueteHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  RAZON_SOCIAL = 'razon_social',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
}

export enum PostobonTiqueteBodyFields {
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  PACKS_VENDIDOS = 'packs_vendidos',
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  VALOR_DESCUENTO_ITEM = 'valor_descuento_item',
  APLICA_IVA_ITEM = 'aplica_iva_item',
  ES_DEVOLUCION = 'es_devolucion',
}
