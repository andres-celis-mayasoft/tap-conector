import { PostobonBodyFields, PostobonHeaderFields } from './postobon.fields';
import { PostobonInvoiceSchema } from './postobon.schema';
import {
  BaseDocument,
  BaseField,
  HeaderFieldConfig,
  BodyFieldConfig,
} from '../base';
import { EMBALAJES_POSTOBON_CAJA } from '../../utils/validator.utils';

type BodyField = BaseField<PostobonBodyFields>;
type HeaderField = BaseField<PostobonHeaderFields>;

export class PostobonInvoice extends BaseDocument<
  PostobonInvoiceSchema,
  PostobonHeaderFields,
  PostobonBodyFields
> {
  // ============ CONFIGURACIÓN DE CAMPOS ============

  protected getHeaderFieldConfig(): HeaderFieldConfig<PostobonHeaderFields> {
    return {
      fechaFactura: PostobonHeaderFields.FECHA_FACTURA,
      numeroFactura: PostobonHeaderFields.NUMERO_FACTURA,
      razonSocial: PostobonHeaderFields.RAZON_SOCIAL,
      valorTotalFactura: PostobonHeaderFields.VALOR_TOTAL_FACTURA,
    };
  }

  protected getBodyFieldConfig(): BodyFieldConfig<PostobonBodyFields> {
    return {
      codigoProducto: PostobonBodyFields.CODIGO_PRODUCTO,
      descripcionProducto: PostobonBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      tipoEmbalaje: PostobonBodyFields.TIPO_EMBALAJE,
      unidadesVendidas: PostobonBodyFields.UNIDADES_VENDIDAS,
      valorUnitario: PostobonBodyFields.VALOR_UNITARIO_ITEM,
      valorVenta: PostobonBodyFields.VALOR_VENTA_ITEM,
      unidadesEmbalaje: PostobonBodyFields.UNIDADES_EMBALAJE,
    };
  }

  // ============ MÉTODOS PRINCIPALES ============

  normalize(): this {
    // Postobon no tiene normalización de REDUCCION como Coke
    return this;
  }

  validate(): void {
    this.validateFechaObsoleta(3);
  }

  infer(): this {
    this.inferHeaders();
    this.inferProducts();
    this.inferTotalFacturaSinIva();
    this.addEsDevolucionField();
    this.guessConfidence();
    return this;
  }

  // ============ INFERENCIAS ESPECÍFICAS DE POSTOBON ============

  private inferProducts(): void {
    const products = this.groupFields();

    for (const product of products) {
      const fields = this.getFieldsMap(product);
      const descripcion = fields[PostobonBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      // Caso especial: REDUCCION - todos los campos con confianza 1
      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      // Inferir tipo de embalaje con reglas específicas de Postobon
      const embalaje = fields[PostobonBodyFields.TIPO_EMBALAJE];
      if (embalaje) {
        this.inferEmbalajePostobon(product, fields);
      }

      // Validar cálculo de unidades vendidas
      this.inferUnidadesVendidas(fields);
    }
  }

  /**
   * Regla específica de Postobon para embalaje:
   * - Si es CAJA: el valor viene por packs_vendidos, unidades_vendidas queda vacío
   * - Si NO es CAJA: el valor viene por unidades_vendidas, packs_vendidos queda vacío
   */
  private inferEmbalajePostobon(
    product: BodyField[],
    fields: Record<PostobonBodyFields, BodyField>,
  ): void {
    const embalajeField = fields[PostobonBodyFields.TIPO_EMBALAJE];
    if (!embalajeField?.text) return;

    const embalaje = embalajeField.text.trim().toUpperCase();
    this.inferTipoEmbalaje(embalajeField);

    const unidadesVendidas = fields[PostobonBodyFields.UNIDADES_VENDIDAS];
    const packsVendidos = fields[PostobonBodyFields.PACKS_VENDIDOS];

    if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
      // CAJA: usar packs_vendidos, limpiar unidades_vendidas
      if (unidadesVendidas) {
        unidadesVendidas.text = undefined;
        unidadesVendidas.confidence = 1;
      }
      if (packsVendidos) {
        packsVendidos.confidence = 1;
      }
    } else {
      // NO CAJA: usar unidades_vendidas, limpiar packs_vendidos
      if (packsVendidos) {
        packsVendidos.text = undefined;
        packsVendidos.confidence = 1;
      }
      if (unidadesVendidas) {
        unidadesVendidas.confidence = 1;
      }
    }
  }

  /**
   * Inferencia por cálculo cruzado para Postobon:
   * valorBase = cantidad * valorUnitario
   * valorProducto = valorBase - descuento
   * valorIva = valorProducto * (aplicaIva / 100)
   * valorVenta = valorProducto + valorIva
   */
  private inferUnidadesVendidas(
    fields: Record<PostobonBodyFields, BodyField>,
  ): void {
    const packsVendidos = fields[PostobonBodyFields.PACKS_VENDIDOS];
    const unidadesVendidas = fields[PostobonBodyFields.UNIDADES_VENDIDAS];
    const valorUnitario = fields[PostobonBodyFields.VALOR_UNITARIO_ITEM];
    const valorVentaItem = fields[PostobonBodyFields.VALOR_VENTA_ITEM];
    const aplicaIvaItem = fields[PostobonBodyFields.APLICA_IVA_ITEM];
    const valorDescuentoItem = fields[PostobonBodyFields.VALOR_DESCUENTO_ITEM];
    const tipoEmbalaje = fields[PostobonBodyFields.TIPO_EMBALAJE];

    const packsVendidosNum = this.toNumber(packsVendidos);
    const unidadesVendidasNum = this.toNumber(unidadesVendidas);
    const valorUnitarioNum = this.toNumber(valorUnitario);
    const valorVentaItemNum = this.toNumber(valorVentaItem);
    const aplicaIvaItemNum = this.toNumber(aplicaIvaItem);
    const valorDescuentoItemNum = this.toNumber(valorDescuentoItem);

    const embalaje = (tipoEmbalaje?.text || '').toUpperCase();

    // Determinar cantidad según tipo de embalaje
    const cantidadUnidades = EMBALAJES_POSTOBON_CAJA.includes(embalaje)
      ? packsVendidosNum
      : unidadesVendidasNum;

    // Cálculos
    const valorBaseCalculado = cantidadUnidades * valorUnitarioNum;
    const valorProductoCalculado = valorBaseCalculado - valorDescuentoItemNum;
    const valorIva = valorProductoCalculado * (aplicaIvaItemNum / 100);
    const valorVentaCalculado = valorProductoCalculado + valorIva;

    const diferencia = Math.abs(valorVentaItemNum - valorVentaCalculado);

    // Tolerancia de 1.0 para diferencias de redondeo
    if (diferencia <= 1.0) {
      if (packsVendidos) packsVendidos.confidence = 1;
      if (unidadesVendidas) unidadesVendidas.confidence = 1;
      if (valorUnitario) valorUnitario.confidence = 1;
      if (valorVentaItem) valorVentaItem.confidence = 1;
      if (tipoEmbalaje) tipoEmbalaje.confidence = 1;
      if (valorDescuentoItem) valorDescuentoItem.confidence = 1;
      if (aplicaIvaItem) aplicaIvaItem.confidence = 1;
    }
  }

  /**
   * Valida el total de factura sin IVA sumando valores base de productos
   */
  private inferTotalFacturaSinIva(): void {
    const headers = this.getHeaderFields();
    const totalFacturaSinIvaField =
      headers[PostobonHeaderFields.TOTAL_FACTURA_SIN_IVA];

    if (!totalFacturaSinIvaField) return;

    const totalFacturaSinIva = this.toNumber(totalFacturaSinIvaField);
    let acumulado = 0;

    const products = this.groupFields();
    for (const product of products) {
      const valorBase = this.calcularValorBaseProducto(product);
      if (valorBase !== null) {
        acumulado += valorBase;
      }
    }

    const diferencia = Math.abs(totalFacturaSinIva - acumulado);

    if (diferencia <= 1.0) {
      totalFacturaSinIvaField.confidence = 1;
    }
  }

  /**
   * Calcula el valor base de un producto (cantidad * valorUnitario)
   */
  private calcularValorBaseProducto(product: BodyField[]): number | null {
    const fields = this.getFieldsMap(product);

    const packsVendidos = fields[PostobonBodyFields.PACKS_VENDIDOS];
    const unidadesVendidas = fields[PostobonBodyFields.UNIDADES_VENDIDAS];
    const valorUnitario = fields[PostobonBodyFields.VALOR_UNITARIO_ITEM];
    const tipoEmbalaje = fields[PostobonBodyFields.TIPO_EMBALAJE];

    const packsVendidosNum = this.toNumber(packsVendidos);
    const unidadesVendidasNum = this.toNumber(unidadesVendidas);
    const valorUnitarioNum = this.toNumber(valorUnitario);
    const embalaje = (tipoEmbalaje?.text || '').toUpperCase();

    const cantidadUnidades = EMBALAJES_POSTOBON_CAJA.includes(embalaje)
      ? packsVendidosNum
      : unidadesVendidasNum;

    return cantidadUnidades * valorUnitarioNum;
  }

  /**
   * Agrega el campo ES_DEVOLUCION a cada producto si no existe
   */
  private addEsDevolucionField(): void {
    const products = this.groupFields();

    for (const product of products) {
      if (!product || product.length === 0) continue;

      const rowNumber = product[0].row;

      // Verificar si ya existe ES_DEVOLUCION
      const exists = product.some(
        (f) => f.type === PostobonBodyFields.ES_DEVOLUCION,
      );
      if (exists) continue;

      // Crear nuevo campo ES_DEVOLUCION
      const newField: BodyField = {
        type: PostobonBodyFields.ES_DEVOLUCION,
        text: '0',
        confidence: 1,
        row: rowNumber,
      };

      // Agregar a la fila y a los detalles
      product.push(newField);
      this.data.detalles.push(newField);
    }
  }
}
