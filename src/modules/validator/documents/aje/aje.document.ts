import { AjeBodyFields, AjeHeaderFields } from './aje.fields';
import { AjeInvoiceSchema } from './aje.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';

type HeaderField = AjeInvoiceSchema['encabezado'][number];
type BodyField = AjeInvoiceSchema['detalles'][number];

export class AjeInvoice extends Document<AjeInvoiceSchema> {
  constructor(
    data: AjeInvoiceSchema,
    protected meikoService: MeikoService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );
    const isValidDate = Utils.isValidDate(fecha_factura.text);

    if (!isValidDate) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
      this.isValid = false;
      return;
    }

    const isValid = Utils.hasMonthsPassed(fecha_factura.text, 3);
    this.isValid = isValid;
    if (!isValid) this.errors.fecha_factura = 'Fecha obsoleta';
  }

  async infer(): Promise<this> {
    this.inferEncabezado();
    await this.inferDetalles();
    this.guessConfidence();
    return this;
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<AjeHeaderFields>(this.data.encabezado);

    if (DateTime.fromFormat(fecha_factura?.text || '', 'dd/MM/yyyy').isValid) {
      fecha_factura.confidence = 1;
    }
    if (this.isNumeric(numero_factura?.text?.slice(-5))) {
      numero_factura.confidence = 1;
      numero_factura.text = numero_factura?.text?.slice(-5);
    }
    if (RAZON_SOCIAL[razon_social.text as any]) {
      razon_social.text = RAZON_SOCIAL[razon_social.text as any];
      razon_social.confidence = 1;
    }
  }

  private async inferDetalles(): Promise<void> {
    const { razon_social } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
      } = Utils.getFields<AjeBodyFields>(product);

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      const productDB = await this.meikoService.findByDescription(
        razon_social?.text || '',
        descripcion?.text || '',
      );

      const result = await this.meikoService.find({
        where: { productCode: codigo_producto.text },
        select: { productCode: true },
      });

      if (result?.productCode === codigo_producto.text) {
        codigo_producto.confidence = 1;
      }

      if (productDB?.description === descripcion.text?.toUpperCase()) {
        descripcion.confidence = 1;
      }

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      // Validación específica de AJE por cálculo
      this.inferProductByCalculation(product);
    }
  }

  /**
   * Validación específica de Factura AJE:
   * valorIvaCalculado = (precioAntesIva - valorDescuento) * (valorIva / 100)
   * valorVentaCalculado = (precioAntesIva - valorDescuento) + valorIvaCalculado
   *
   * Si la diferencia con valorVentaItem es <= 1.0, se validan todos los campos
   */
  private inferProductByCalculation(product: any[]): void {
    const {
      precio_antes_iva,
      valor_descuento_item,
      valor_iva,
      valor_venta_item,
    } = Utils.getFields<AjeBodyFields>(product);

    const precioAntesIvaDbl = this.toNumber(precio_antes_iva) || 0;
    const valorDescuentoItemDbl = this.toNumber(valor_descuento_item) || 0;
    const valorIvaDbl = this.toNumber(valor_iva) || 0;
    const valorVentaItemDbl = this.toNumber(valor_venta_item) || 0;

    // Cálculo AJE
    const valorIvaCalculado = (precioAntesIvaDbl - valorDescuentoItemDbl) * (valorIvaDbl / 100);
    const valorVentaCalculado = (precioAntesIvaDbl - valorDescuentoItemDbl) + valorIvaCalculado;

    const diferencia = Math.abs(valorVentaItemDbl - valorVentaCalculado);

    if (diferencia <= 1.0) {
      if (precio_antes_iva) precio_antes_iva.confidence = 1;
      if (valor_descuento_item) valor_descuento_item.confidence = 1;
      if (valor_iva) valor_iva.confidence = 1;
      if (valor_venta_item) valor_venta_item.confidence = 1;
    }
  }

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

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }
}
