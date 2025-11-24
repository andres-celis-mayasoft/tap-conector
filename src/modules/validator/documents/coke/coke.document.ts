import { CokeBodyFields, CokeHeaderFields } from './coke.fields';
import { CokeInvoiceSchema } from './coke.schema';
import { Document } from '../document';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';

type HeaderField = CokeInvoiceSchema['encabezado'][number];
type BodyField = CokeInvoiceSchema['detalles'][number];

export class CokeInvoice extends Document<CokeInvoiceSchema> {
  normalize(): this {
    // Convert to negative VALOR_VENTA_ITEM where descriptio is 'REDUCCION'
    const products = Utils.groupFields(this.data.detalles);
    for (const product of products) {
      const descriptionField = product.find(
        (field) => field.type == CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      );
      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        const valorField = product.find(
          (field) => field.type === CokeBodyFields.VALOR_VENTA_ITEM,
        );
        if (valorField)
          valorField.text = String(this.toNumber(valorField) * -1);
        continue;
      }
    }
    return this;
  }

  validate(): void {
    // Validate FECHA_FACTURA passed months
    const { fecha_factura } = Utils.getFields<CokeHeaderFields>(
      this.data.encabezado,
    );
    const isValidDate = Utils.isValidDate(fecha_factura);

    if (!isValidDate) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
      this.isValid = false;
      return;
    }

    const isValid = Utils.hasMonthsPassed(fecha_factura, 3);
    this.isValid = isValid;
    if (!isValid) this.errors.fecha_factura = 'Fecha obsoleta';
  }

  infer(): this {
    this.inferHeaders();
    this.inferProducts();
    this.inferTotalFactura();
    this.guessConfidence();
    return this;
  }

  /**
   * Inferencias para campos del encabezado
   */
  private inferHeaders(): void {
    for (const field of this.data.encabezado) {
      this.inferFechaFactura(field);
      this.inferNumeroFactura(field);
      this.inferRazonSocial(field);
    }
  }

  /**
   * Infiere confianza de fecha si tiene formato válido dd/MM/yyyy
   */
  private inferFechaFactura(field: HeaderField): void {
    if (field.type !== CokeHeaderFields.FECHA_FACTURA) return;

    if (DateTime.fromFormat(field?.text || '', 'dd/MM/yyyy').isValid) {
      field.confidence = 1;
    }
  }

  /**
   * Infiere confianza de número de factura si los últimos 5 caracteres son numéricos
   * También normaliza el texto a solo los últimos 5 dígitos
   */
  private inferNumeroFactura(field: HeaderField): void {
    if (field.type !== CokeHeaderFields.NUMERO_FACTURA) return;

    const lastFive = field?.text?.slice(-5);
    if (this.isNumeric(lastFive)) {
      field.confidence = 1;
      field.text = lastFive;
    }
  }

  /**
   * Infiere confianza de razón social si está en el catálogo conocido
   * También normaliza el texto al valor del catálogo
   */
  private inferRazonSocial(field: HeaderField): void {
    if (field.type !== CokeHeaderFields.RAZON_SOCIAL) return;

    const normalizedValue =
      RAZON_SOCIAL[field.text as keyof typeof RAZON_SOCIAL];
    if (normalizedValue) {
      field.text = normalizedValue;
      field.confidence = 1;
    }
  }

  /**
   * Inferencias para productos (detalles)
   */
  private inferProducts(): void {
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const fields = Utils.getFields<CokeBodyFields>(product);
      const descripcion = fields[CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      // Caso especial: REDUCCION
      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        this.inferReduccion(product, fields);
        continue;
      }

      // Inferencias por campo individual
      this.inferTipoEmbalaje(fields);

      // Inferencia por cálculo cruzado de valores
      this.inferValoresPorCalculo(fields);
    }
  }

  /**
   * Maneja el caso especial de productos tipo REDUCCION
   * Todos los campos tienen confianza 1 y el valor de venta se vuelve negativo
   */
  private inferReduccion(
    product: BodyField[],
    fields: Record<CokeBodyFields, BodyField>,
  ): void {
    product.forEach((field) => (field.confidence = 1));

    const valorVenta = fields[CokeBodyFields.VALOR_VENTA_ITEM];
    if (valorVenta?.text) {
      valorVenta.text = String(this.toNumber(valorVenta) * -1);
    }
  }

  /**
   * Infiere confianza del tipo de embalaje si está en el catálogo conocido
   */
  private inferTipoEmbalaje(fields: Record<CokeBodyFields, BodyField>): void {
    const embalaje = fields[CokeBodyFields.TIPO_EMBALAJE];
    if (!embalaje?.text) return;

    const embalajeNormalizado = embalaje.text.trim().toUpperCase();
    if (EMBALAJES.includes(embalajeNormalizado)) {
      embalaje.confidence = 1;
    }
  }

  /**
   * Inferencia por cálculo cruzado:
   * Si el cálculo: (unidades_embalaje / unidades_vendidas) * valor_unitario - valor_ibua = valor_venta
   * coincide, entonces todos los campos involucrados tienen confianza 1
   */
  private inferValoresPorCalculo(
    fields: Record<CokeBodyFields, BodyField>,
  ): void {
    const unidadesEmbalaje = fields[CokeBodyFields.UNIDADES_EMBALAJE];
    const unidadesVendidas = fields[CokeBodyFields.UNIDADES_VENDIDAS];
    const valorUnitario = fields[CokeBodyFields.VALOR_UNITARIO_ITEM];
    const valorIbuaOtros = fields[CokeBodyFields.VALOR_IBUA_Y_OTROS];
    const valorVentaItem = fields[CokeBodyFields.VALOR_VENTA_ITEM];

    // Verificar que todos los campos existen
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

    // Evitar división por cero
    if (unidadesVendidasNum === 0) return;

    // Cálculo: unidades_item = unidades_embalaje / unidades_vendidas
    // valor_item = valor_unitario / unidades_item
    // valor_venta_calculado = valor_item - valor_ibua_otros
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
   * Infiere el total de factura sumando todos los valores de venta + IBUA
   */
  private inferTotalFactura(): void {
    const products = Utils.groupFields(this.data.detalles);
    const headers = Utils.getFields<CokeHeaderFields>(this.data.encabezado);

    const calculatedTotal = products.reduce((acc, product) => {
      const fields = Utils.getFields<CokeBodyFields>(product);
      const valorVenta = this.toNumber(fields[CokeBodyFields.VALOR_VENTA_ITEM]);
      const valorIbua = this.toNumber(
        fields[CokeBodyFields.VALOR_IBUA_Y_OTROS],
      );
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

  /**
   * Si la confianza es >= 0.95, se redondea a 1
   */
  private guessConfidence(): void {
    for (const field of this.data.encabezado) {
      if (field.confidence >= 0.95) {
        field.confidence = 1;
      }
    }

    for (const field of this.data.detalles) {
      if (field.confidence >= 0.95) {
        field.confidence = 1;
      }
    }
  }

  // ============ UTILIDADES ============

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }
}
