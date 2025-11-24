import { CokeBodyFields, CokeHeaderFields } from './coke.fields';
import { CokeInvoiceSchema } from './coke.schema';
import {
  BaseDocument,
  BaseField,
  HeaderFieldConfig,
  BodyFieldConfig,
} from '../base';

type BodyField = BaseField<CokeBodyFields>;

export class CokeInvoice extends BaseDocument<
  CokeInvoiceSchema,
  CokeHeaderFields,
  CokeBodyFields
> {
  // ============ CONFIGURACIÓN DE CAMPOS ============

  protected getHeaderFieldConfig(): HeaderFieldConfig<CokeHeaderFields> {
    return {
      fechaFactura: CokeHeaderFields.FECHA_FACTURA,
      numeroFactura: CokeHeaderFields.NUMERO_FACTURA,
      razonSocial: CokeHeaderFields.RAZON_SOCIAL,
      valorTotalFactura: CokeHeaderFields.VALOR_TOTAL_FACTURA,
    };
  }

  protected getBodyFieldConfig(): BodyFieldConfig<CokeBodyFields> {
    return {
      codigoProducto: CokeBodyFields.CODIGO_PRODUCTO,
      descripcionProducto: CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      tipoEmbalaje: CokeBodyFields.TIPO_EMBALAJE,
      unidadesVendidas: CokeBodyFields.UNIDADES_VENDIDAS,
      valorUnitario: CokeBodyFields.VALOR_UNITARIO_ITEM,
      valorVenta: CokeBodyFields.VALOR_VENTA_ITEM,
      valorIbua: CokeBodyFields.VALOR_IBUA_Y_OTROS,
      unidadesEmbalaje: CokeBodyFields.UNIDADES_EMBALAJE,
    };
  }

  // ============ MÉTODOS PRINCIPALES ============

  normalize(): this {
    // Normalizar encabezados (reparar fechas con errores de OCR)
    this.normalizeHeaders();

    const products = this.groupFields();
    for (const product of products) {
      const fields = this.getFieldsMap(product);
      const descriptionField = fields[CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        const valorField = fields[CokeBodyFields.VALOR_VENTA_ITEM];
        if (valorField) {
          valorField.text = String(this.toNumber(valorField) * -1);
        }
      }
    }
    return this;
  }

  validate(): void {
    this.validateFechaObsoleta(3);
  }

  infer(): this {
    this.inferHeaders();
    this.inferProducts();
    this.inferTotalFactura();
    this.guessConfidence();
    return this;
  }

  // ============ INFERENCIAS ESPECÍFICAS DE COKE ============

  private inferProducts(): void {
    const products = this.groupFields();

    for (const product of products) {
      const fields = this.getFieldsMap(product);
      const descripcion = fields[CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      // Caso especial: REDUCCION
      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        this.inferReduccion(product);
        continue;
      }

      // Inferir tipo de embalaje
      const embalaje = fields[CokeBodyFields.TIPO_EMBALAJE];
      if (embalaje) {
        this.inferTipoEmbalaje(embalaje);
      }

      // Inferencia por cálculo cruzado
      this.inferValoresPorCalculo(fields);
    }
  }

  /**
   * Productos tipo REDUCCION: todos los campos con confianza 1
   */
  private inferReduccion(product: BodyField[]): void {
    product.forEach((field) => (field.confidence = 1));
  }

  /**
   * Inferencia por cálculo cruzado de valores
   */
  private inferValoresPorCalculo(
    fields: Record<CokeBodyFields, BodyField>,
  ): void {
    const unidadesEmbalaje = fields[CokeBodyFields.UNIDADES_EMBALAJE];
    const unidadesVendidas = fields[CokeBodyFields.UNIDADES_VENDIDAS];
    const valorUnitario = fields[CokeBodyFields.VALOR_UNITARIO_ITEM];
    const valorIbuaOtros = fields[CokeBodyFields.VALOR_IBUA_Y_OTROS];
    const valorVentaItem = fields[CokeBodyFields.VALOR_VENTA_ITEM];

    if (
      !unidadesEmbalaje ||
      !unidadesVendidas ||
      !valorUnitario ||
      !valorIbuaOtros ||
      !valorVentaItem
    ) {
      return;
    }

    const unidadesEmbalajeNum = this.toNumber(unidadesEmbalaje);
    const unidadesVendidasNum = this.toNumber(unidadesVendidas);
    const valorUnitarioNum = this.toNumber(valorUnitario);
    const valorIbuaOtrosNum = this.toNumber(valorIbuaOtros);
    const valorVentaItemNum = this.toNumber(valorVentaItem);

    if (unidadesVendidasNum === 0) return;

    const unidadesItem = unidadesEmbalajeNum / unidadesVendidasNum;
    const valorItem = valorUnitarioNum / unidadesItem;
    const valorVentaCalculado = valorItem - valorIbuaOtrosNum;

    if (valorVentaCalculado === valorVentaItemNum) {
      unidadesEmbalaje.confidence = 1;
      unidadesVendidas.confidence = 1;
      valorUnitario.confidence = 1;
      valorIbuaOtros.confidence = 1;
      valorVentaItem.confidence = 1;
    }
  }

  /**
   * Infiere el total de factura sumando valores de venta + IBUA
   */
  private inferTotalFactura(): void {
    const products = this.groupFields();
    const headers = this.getHeaderFields();

    const calculatedTotal = products.reduce((acc, product) => {
      const fields = this.getFieldsMap(product);
      const valorVenta = this.toNumber(fields[CokeBodyFields.VALOR_VENTA_ITEM]);
      const valorIbua = this.toNumber(fields[CokeBodyFields.VALOR_IBUA_Y_OTROS]);
      return acc + valorVenta + valorIbua;
    }, 0);

    const valorTotalFactura = headers[CokeHeaderFields.VALOR_TOTAL_FACTURA];
    if (
      valorTotalFactura &&
      calculatedTotal === this.toNumber(valorTotalFactura)
    ) {
      valorTotalFactura.confidence = 1;
    }
  }
}
