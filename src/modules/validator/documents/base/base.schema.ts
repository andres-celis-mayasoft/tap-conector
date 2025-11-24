/**
 * Campos comunes de encabezado para todas las facturas
 */
export enum BaseHeaderFields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  RAZON_SOCIAL = 'razon_social',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
}

/**
 * Campos comunes de detalle/body para todas las facturas
 */
export enum BaseBodyFields {
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  VALOR_IBUA_Y_OTROS = 'valor_ibua_y_otros',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  PACKS_VENDIDOS = 'packs_vendidos',
  VALOR_DESCUENTO_ITEM = 'valor_descuento_item',
  APLICA_IVA_ITEM = 'aplica_iva_item',
}

/**
 * Interfaz base para un campo de factura
 */
export interface BaseField<T extends string = string> {
  type: T;
  text?: string;
  confidence: number;
  row?: number;
}

/**
 * Esquema base para cualquier factura
 */
export interface BaseInvoiceSchema<
  THeader extends string = string,
  TBody extends string = string,
> {
  encabezado: BaseField<THeader>[];
  detalles: BaseField<TBody>[];
  tipoFacturaOcr?: string;
  urlFactura?: string;
  id?: number;
  facturaId?: number;
}

/**
 * Configuración de campos para inferencia de encabezado
 */
export interface HeaderFieldConfig<T> {
  fechaFactura?: T;
  numeroFactura?: T;
  razonSocial?: T;
  valorTotalFactura?: T;
}

/**
 * Configuración de campos para inferencia de productos
 */
export interface BodyFieldConfig<T> {
  codigoProducto?: T;
  descripcionProducto?: T;
  tipoEmbalaje?: T;
  unidadesVendidas?: T;
  valorUnitario?: T;
  valorVenta?: T;
  valorIbua?: T;
  unidadesEmbalaje?: T;
}
