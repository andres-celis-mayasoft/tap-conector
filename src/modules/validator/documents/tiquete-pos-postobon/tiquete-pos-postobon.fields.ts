export enum TiquetePosPostobonHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
  RAZON_SOCIAL = 'razon_social',
  TOTAL_ARTICULOS = 'total_articulos',
}

export enum TiquetePosPostobonBodyFields {
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  PACKS_VENDIDOS = 'packs_vendidos',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  VALOR_VENTA_ITEM_TOTAL_NC = 'valor_venta_item_total_nc',
  VALOR_SUBTOTAL_ITEM = 'valor_subtotal_item',
  VALOR_DESCUENTO = 'valor_descuento',
}

export const POS_POSTOBON_THRESOLDS = {
  [TiquetePosPostobonHeaderFields.FECHA_FACTURA]: 0.83,
  [TiquetePosPostobonHeaderFields.NUMERO_FACTURA]: 0.63,
  [TiquetePosPostobonHeaderFields.VALOR_TOTAL_FACTURA]: 0.74,
  [TiquetePosPostobonHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.85,
  [TiquetePosPostobonHeaderFields.RAZON_SOCIAL]: 0.55,
  [TiquetePosPostobonHeaderFields.TOTAL_ARTICULOS]: 0.98,
  [TiquetePosPostobonBodyFields.TIPO_EMBALAJE]: 0.98,
  [TiquetePosPostobonBodyFields.UNIDADES_EMBALAJE]: 0.97,
  [TiquetePosPostobonBodyFields.PACKS_VENDIDOS]: 0.97,
  [TiquetePosPostobonBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.89,
  [TiquetePosPostobonBodyFields.VALOR_VENTA_ITEM_TOTAL_NC]: 0.82,
  [TiquetePosPostobonBodyFields.VALOR_SUBTOTAL_ITEM]: 0.83,
  [TiquetePosPostobonBodyFields.VALOR_DESCUENTO]: 0.86,
};
