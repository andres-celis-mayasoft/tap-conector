export enum InfocargueHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  RAZON_SOCIAL = 'razon_social',
}

export enum InfocargueBodyFields {
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  PACKS_CON_UNIDADES = 'packs_con_unidades',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
}

export const INFOCARGUE_THRESOLDS = {
  [InfocargueHeaderFields.FECHA_FACTURA]: 0.95,
  [InfocargueHeaderFields.VALOR_TOTAL_FACTURA]: 0.98,
  [InfocargueHeaderFields.RAZON_SOCIAL]: 0.99,
  [InfocargueBodyFields.ITEM_DESCRIPCION_PRODUCTO]: 0.96,
  [InfocargueBodyFields.PACKS_CON_UNIDADES]: 0.89,
  [InfocargueBodyFields.VALOR_VENTA_ITEM]: 0.98,
  [InfocargueBodyFields.UNIDADES_EMBALAJE]: 0.97,
};
