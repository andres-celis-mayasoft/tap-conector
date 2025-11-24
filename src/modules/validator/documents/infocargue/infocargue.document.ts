import { InfocargueBodyFields, InfocargueHeaderFields } from './infocargue.fields';
import { InfocargueInvoiceSchema } from './infocargue.schema';
import {
  BaseDocument,
  BaseField,
  HeaderFieldConfig,
  BodyFieldConfig,
} from '../base';

type BodyField = BaseField<InfocargueBodyFields>;

export class InfocargueInvoice extends BaseDocument<
  InfocargueInvoiceSchema,
  InfocargueHeaderFields,
  InfocargueBodyFields
> {
  // ============ CONFIGURACIÓN DE CAMPOS ============

  protected getHeaderFieldConfig(): HeaderFieldConfig<InfocargueHeaderFields> {
    return {
      fechaFactura: InfocargueHeaderFields.FECHA_FACTURA,
      numeroFactura: InfocargueHeaderFields.NUMERO_FACTURA,
      razonSocial: InfocargueHeaderFields.RAZON_SOCIAL,
      valorTotalFactura: InfocargueHeaderFields.VALOR_TOTAL_FACTURA,
    };
  }

  protected getBodyFieldConfig(): BodyFieldConfig<InfocargueBodyFields> {
    return {
      codigoProducto: InfocargueBodyFields.CODIGO_PRODUCTO,
      descripcionProducto: InfocargueBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      tipoEmbalaje: InfocargueBodyFields.TIPO_EMBALAJE,
      unidadesVendidas: InfocargueBodyFields.UNIDADES_VENDIDAS,
      valorUnitario: InfocargueBodyFields.VALOR_UNITARIO_ITEM,
      valorVenta: InfocargueBodyFields.VALOR_VENTA_ITEM,
      valorIbua: InfocargueBodyFields.VALOR_IBUA_Y_OTROS,
      unidadesEmbalaje: InfocargueBodyFields.UNIDADES_EMBALAJE,
    };
  }

  // ============ MÉTODOS PRINCIPALES ============

  normalize(): this {
    // Normalizar REDUCCION: convertir valor a negativo
    const products = this.groupFields();
    for (const product of products) {
      const fields = this.getFieldsMap(product);
      const descriptionField = fields[InfocargueBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        const valorField = fields[InfocargueBodyFields.VALOR_VENTA_ITEM];
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
    this.guessConfidence();
    return this;
  }

  // ============ INFERENCIAS ESPECÍFICAS DE INFOCARGUE ============

  private inferProducts(): void {
    const products = this.groupFields();

    for (const product of products) {
      const fields = this.getFieldsMap(product);
      const descripcion = fields[InfocargueBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      // Caso especial: REDUCCION - todos los campos con confianza 1
      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      // Inferir tipo de embalaje
      const embalaje = fields[InfocargueBodyFields.TIPO_EMBALAJE];
      if (embalaje) {
        this.inferTipoEmbalaje(embalaje);
      }

      // Inferir UNIDADES_EMBALAJE desde descripción (regla específica de Infocargue)
      this.inferUnidadesEmbalajeDesdeDescripcion(fields);
    }
  }

  /**
   * Regla específica de Infocargue:
   * Busca patrón "x<número>" o "X<número>" en la descripción del producto
   * para inferir o validar UNIDADES_EMBALAJE
   */
  private inferUnidadesEmbalajeDesdeDescripcion(
    fields: Record<InfocargueBodyFields, BodyField>,
  ): void {
    const unidadesEmbalajeField = fields[InfocargueBodyFields.UNIDADES_EMBALAJE];
    const descriptionField = fields[InfocargueBodyFields.ITEM_DESCRIPCION_PRODUCTO];

    if (!unidadesEmbalajeField || !descriptionField) return;

    const valor = unidadesEmbalajeField.text || '';
    const confianza = unidadesEmbalajeField.confidence || 0;
    const descripcion = descriptionField.text || '';

    // Pattern para encontrar "x<número>" o "X<número>"
    const pattern = /[xX]\s*(\d+)/;
    const match = descripcion.match(pattern);

    if ((!valor || valor.trim() === '') && confianza === 0) {
      // Caso 1: está vacío → inferimos desde descripción
      if (match) {
        const numero = match[1];
        unidadesEmbalajeField.text = numero;
        unidadesEmbalajeField.confidence = 1;
      } else {
        // Sin patrón 'xN', pero confianza 1 porque está vacío correctamente
        unidadesEmbalajeField.confidence = 1;
      }
    } else if (match) {
      // Caso 2: ya hay valor → comparamos con descripción
      try {
        const valorExistente = parseInt(valor.trim(), 10);
        const numeroDescripcion = parseInt(match[1], 10);

        if (valorExistente === numeroDescripcion) {
          unidadesEmbalajeField.confidence = 1;
        }
      } catch {
        // Valor no numérico, se ignora comparación
      }
    }
  }
}
