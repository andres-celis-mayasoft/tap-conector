import { InvoiceEntry } from '../interfaces/invoice.interface';

export enum Fields {
  FECHA_FACTURA = 'fecha_factura',
  NUMERO_FACTURA = 'numero_factura',
  RAZON_SOCIAL = 'razon_social',
  TOTAL_FACTURA_SIN_IVA = 'total_factura_sin_iva',
  VALOR_TOTAL_FACTURA = 'valor_total_factura',
  CODIGO_PRODUCTO = 'codigo_producto',
  ITEM_DESCRIPCION_PRODUCTO = 'item_descripcion_producto',
  TIPO_EMBALAJE = 'tipo_embalaje',
  UNIDADES_VENDIDAS = 'unidades_vendidas',
  VALOR_UNITARIO_ITEM = 'valor_unitario_item',
  VALOR_VENTA_ITEM = 'valor_venta_item',
  UNIDADES_EMBALAJE = 'unidades_embalaje',
  PACKS_VENDIDOS = 'packs_vendidos',
  VALOR_IBUA_Y_OTROS = 'valor_ibua_y_otros',
  VALOR_VENTA_ITEM_TOTAL_NC = 'valor_venta_item_total_nc',
  ES_DEVOLUCION = 'es_devolucion',
  VALOR_DESCUENTO_ITEM = 'valor_descuento_item',
  APLICA_IVA_ITEM = 'aplica_iva_item',
}

export const RAZON_SOCIAL = {
  'Coca-Cola': 'COCA COLA',
  'POSTOBON S.A.': 'POSTOBON'
};
