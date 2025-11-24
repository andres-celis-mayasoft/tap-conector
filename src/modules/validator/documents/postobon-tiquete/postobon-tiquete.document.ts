import {
  PostobonTiqueteBodyFields,
  PostobonTiqueteHeaderFields,
} from './postobon-tiquete.fields';
import { PostobonTiqueteInvoiceSchema } from './postobon-tiquete.schema';
import {
  BaseDocument,
  BaseField,
  HeaderFieldConfig,
  BodyFieldConfig,
} from '../base';
import { EMBALAJES_POSTOBON_CAJA } from '../../utils/validator.utils';

type BodyField = BaseField<PostobonTiqueteBodyFields>;

const MIN_CONFIANZA_OCR_85 = 0.85;

export class PostobonTiqueteInvoice extends BaseDocument<
  PostobonTiqueteInvoiceSchema,
  PostobonTiqueteHeaderFields,
  PostobonTiqueteBodyFields
> {
  // ============ CONFIGURACIÓN DE CAMPOS ============

  protected getHeaderFieldConfig(): HeaderFieldConfig<PostobonTiqueteHeaderFields> {
    return {
      fechaFactura: PostobonTiqueteHeaderFields.FECHA_FACTURA,
      numeroFactura: PostobonTiqueteHeaderFields.NUMERO_FACTURA,
      razonSocial: PostobonTiqueteHeaderFields.RAZON_SOCIAL,
      valorTotalFactura: PostobonTiqueteHeaderFields.VALOR_TOTAL_FACTURA,
    };
  }

  protected getBodyFieldConfig(): BodyFieldConfig<PostobonTiqueteBodyFields> {
    return {
      codigoProducto: PostobonTiqueteBodyFields.CODIGO_PRODUCTO,
      descripcionProducto: PostobonTiqueteBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      tipoEmbalaje: PostobonTiqueteBodyFields.TIPO_EMBALAJE,
      unidadesVendidas: PostobonTiqueteBodyFields.UNIDADES_VENDIDAS,
      valorUnitario: PostobonTiqueteBodyFields.VALOR_UNITARIO_ITEM,
      valorVenta: PostobonTiqueteBodyFields.VALOR_VENTA_ITEM,
      unidadesEmbalaje: PostobonTiqueteBodyFields.UNIDADES_EMBALAJE,
    };
  }

  // ============ MÉTODOS PRINCIPALES ============

  normalize(): this {
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
    this.ajustarARiesgo();
    return this;
  }

  // ============ INFERENCIAS (IGUAL QUE POSTOBON) ============

  private inferProducts(): void {
    const products = this.groupFields();

    for (const product of products) {
      const fields = this.getFieldsMap(product);
      const descripcion = fields[PostobonTiqueteBodyFields.ITEM_DESCRIPCION_PRODUCTO];

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      const embalaje = fields[PostobonTiqueteBodyFields.TIPO_EMBALAJE];
      if (embalaje) {
        this.inferEmbalajePostobon(product, fields);
      }

      this.inferUnidadesVendidas(fields);
    }
  }

  private inferEmbalajePostobon(
    product: BodyField[],
    fields: Record<PostobonTiqueteBodyFields, BodyField>,
  ): void {
    const embalajeField = fields[PostobonTiqueteBodyFields.TIPO_EMBALAJE];
    if (!embalajeField?.text) return;

    const embalaje = embalajeField.text.trim().toUpperCase();
    this.inferTipoEmbalaje(embalajeField);

    const unidadesVendidas = fields[PostobonTiqueteBodyFields.UNIDADES_VENDIDAS];
    const packsVendidos = fields[PostobonTiqueteBodyFields.PACKS_VENDIDOS];

    if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
      if (unidadesVendidas) {
        unidadesVendidas.text = undefined;
        unidadesVendidas.confidence = 1;
      }
      if (packsVendidos) {
        packsVendidos.confidence = 1;
      }
    } else {
      if (packsVendidos) {
        packsVendidos.text = undefined;
        packsVendidos.confidence = 1;
      }
      if (unidadesVendidas) {
        unidadesVendidas.confidence = 1;
      }
    }
  }

  private inferUnidadesVendidas(
    fields: Record<PostobonTiqueteBodyFields, BodyField>,
  ): void {
    const packsVendidos = fields[PostobonTiqueteBodyFields.PACKS_VENDIDOS];
    const unidadesVendidas = fields[PostobonTiqueteBodyFields.UNIDADES_VENDIDAS];
    const valorUnitario = fields[PostobonTiqueteBodyFields.VALOR_UNITARIO_ITEM];
    const valorVentaItem = fields[PostobonTiqueteBodyFields.VALOR_VENTA_ITEM];
    const aplicaIvaItem = fields[PostobonTiqueteBodyFields.APLICA_IVA_ITEM];
    const valorDescuentoItem = fields[PostobonTiqueteBodyFields.VALOR_DESCUENTO_ITEM];
    const tipoEmbalaje = fields[PostobonTiqueteBodyFields.TIPO_EMBALAJE];

    const packsVendidosNum = this.toNumber(packsVendidos);
    const unidadesVendidasNum = this.toNumber(unidadesVendidas);
    const valorUnitarioNum = this.toNumber(valorUnitario);
    const valorVentaItemNum = this.toNumber(valorVentaItem);
    const aplicaIvaItemNum = this.toNumber(aplicaIvaItem);
    const valorDescuentoItemNum = this.toNumber(valorDescuentoItem);

    const embalaje = (tipoEmbalaje?.text || '').toUpperCase();

    const cantidadUnidades = EMBALAJES_POSTOBON_CAJA.includes(embalaje)
      ? packsVendidosNum
      : unidadesVendidasNum;

    const valorBaseCalculado = cantidadUnidades * valorUnitarioNum;
    const valorProductoCalculado = valorBaseCalculado - valorDescuentoItemNum;
    const valorIva = valorProductoCalculado * (aplicaIvaItemNum / 100);
    const valorVentaCalculado = valorProductoCalculado + valorIva;

    const diferencia = Math.abs(valorVentaItemNum - valorVentaCalculado);

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

  private inferTotalFacturaSinIva(): void {
    const headers = this.getHeaderFields();
    const totalFacturaSinIvaField =
      headers[PostobonTiqueteHeaderFields.TOTAL_FACTURA_SIN_IVA];

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

  private calcularValorBaseProducto(product: BodyField[]): number | null {
    const fields = this.getFieldsMap(product);

    const packsVendidos = fields[PostobonTiqueteBodyFields.PACKS_VENDIDOS];
    const unidadesVendidas = fields[PostobonTiqueteBodyFields.UNIDADES_VENDIDAS];
    const valorUnitario = fields[PostobonTiqueteBodyFields.VALOR_UNITARIO_ITEM];
    const tipoEmbalaje = fields[PostobonTiqueteBodyFields.TIPO_EMBALAJE];

    const packsVendidosNum = this.toNumber(packsVendidos);
    const unidadesVendidasNum = this.toNumber(unidadesVendidas);
    const valorUnitarioNum = this.toNumber(valorUnitario);
    const embalaje = (tipoEmbalaje?.text || '').toUpperCase();

    const cantidadUnidades = EMBALAJES_POSTOBON_CAJA.includes(embalaje)
      ? packsVendidosNum
      : unidadesVendidasNum;

    return cantidadUnidades * valorUnitarioNum;
  }

  private addEsDevolucionField(): void {
    const products = this.groupFields();

    for (const product of products) {
      if (!product || product.length === 0) continue;

      const rowNumber = product[0].row;

      const exists = product.some(
        (f) => f.type === PostobonTiqueteBodyFields.ES_DEVOLUCION,
      );
      if (exists) continue;

      const newField: BodyField = {
        type: PostobonTiqueteBodyFields.ES_DEVOLUCION,
        text: '0',
        confidence: 1,
        row: rowNumber,
      };

      product.push(newField);
      this.data.detalles.push(newField);
    }
  }

  // ============ AJUSTE A RIESGO (ÚNICO DE TIQUETE POS POSTOBON) ============

  /**
   * Si no hay errores y TOTAL_FACTURA_SIN_IVA tiene confianza >= 85%,
   * se ajusta a 100% (Ajuste a Riesgo)
   */
  private ajustarARiesgo(): void {
    // Si hay errores, no aplicar ajuste
    if (Object.keys(this.errors).length > 0) {
      return;
    }

    const headers = this.getHeaderFields();
    const totalFacturaSinIvaField =
      headers[PostobonTiqueteHeaderFields.TOTAL_FACTURA_SIN_IVA];

    if (!totalFacturaSinIvaField) return;

    const confianza = totalFacturaSinIvaField.confidence || 0;

    // Confianza debe ser >= 85%
    if (confianza < MIN_CONFIANZA_OCR_85) {
      return;
    }

    // Ajustar a 100%
    totalFacturaSinIvaField.confidence = 1;
  }
}
