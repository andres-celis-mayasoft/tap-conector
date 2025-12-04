export enum AjeHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
  RAZON_SOCIAL = 'razon_social',
  TOTAL_UNIDADES = 'total_unidades',
  TOTAL_PACAS = 'total_pacas',
}

export enum AjeBodyFields {
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  PACKS_VENDIDOS = 'packs_vendidos',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  PRECIO_ANTES_IVA = 'precio_antes_iva',
  VALOR_DESCUENTO_ITEM = 'valor_descuento',
  VALOR_IVA = 'valor_iva',
}


export const AJE_THRESOLDS = {
[AjeHeaderFields.FECHA_FACTURA]: 0.94,
[AjeHeaderFields.NUMERO_FACTURA]: 0.86,
[AjeHeaderFields.TOTAL_FACTURA_SIN_IVA]: 0.95,
[AjeHeaderFields.VALOR_TOTAL_FACTURA]: 0.97,
[AjeHeaderFields.RAZON_SOCIAL]: 0.99,
[AjeBodyFields.CODIGO_PRODUCTO]: 0.93,
[AjeBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.94,
[AjeBodyFields.TIPO_EMBALAJE]: 0.96,
[AjeBodyFields.PACKS_VENDIDOS]: 0.87,
[AjeBodyFields.UNIDADES_VENDIDAS]: 0.92,
[AjeBodyFields.VALOR_VENTA_ITEM]: 0.96,
[AjeBodyFields.UNIDADES_EMBALAJE]: 0.97,
[AjeBodyFields.PRECIO_ANTES_IVA]: 0.95,
[AjeBodyFields.VALOR_DESCUENTO_ITEM]: 0.83,
[AjeBodyFields.VALOR_IVA]: 0.9,
  };