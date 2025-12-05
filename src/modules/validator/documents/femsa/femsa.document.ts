import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { FemsaInvoiceSchema } from './femsa.schema';
import {
  FEMSA_THRESOLDS,
  FemsaBodyFields,
  FemsaHeaderFields,
} from './femsa.fields';
import { InvoiceService } from 'src/modules/invoice/invoice.service';

type HeaderField = FemsaInvoiceSchema['encabezado'][number];
type BodyField = FemsaInvoiceSchema['detalles'][number];

export class FemsaInvoice extends Document<FemsaInvoiceSchema> {
  constructor(
    data: FemsaInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<FemsaHeaderFields>(
      this.data.encabezado,
    );
    const isValidDate = Utils.isValidDate(fecha_factura.text);

    if (!isValidDate) {
      fecha_factura.error = 'Fecha inválida (formato)';
      return;
    }

    const isValid = Utils.hasMonthsPassed(fecha_factura.text);
    this.isValid = isValid;
    if (!isValid) {
      fecha_factura.error = 'Fecha obsoleta';
    }
  }

  async infer(): Promise<this> {
    this.inferEncabezado();
    this.inferSubtotal();
    this.inferTotal();
    this.inferIBUA();
    await this.inferDetalles();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<FemsaBodyFields>(product);

      const productDB = await this.invoiceService.isExcluded(descripcion?.text);

      if (!productDB) continue;

      if (productDB?.description === descripcion?.text)
        rows.push(descripcion.row);
    }

    this.data.detalles = this.data.detalles.filter(
      (field) => !rows.includes(field.row || -1),
    );

    return this;
  }

  prune() {
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      'valor_unitario_item',
      FemsaBodyFields.VALOR_DESCUENTO,
      FemsaBodyFields.CANTIDAD,
    ]);
    this.data.encabezado = Utils.removeFields(this.data.encabezado, [
      FemsaHeaderFields.IBUA,
      FemsaHeaderFields.IVA_TARIFA_GENERAL,
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<FemsaHeaderFields>(this.data.encabezado);

    if (
      DateTime.fromFormat(fecha_factura?.text || '', 'dd/MM/yyyy').isValid &&
      !fecha_factura.error
    ) {
      fecha_factura.confidence = 1;
    }

    if (this.isNumeric(numero_factura?.text?.slice(-5))) {
      numero_factura.confidence = 1;
      numero_factura.text = numero_factura?.text?.slice(-5);
    } else numero_factura.error = 'Número de factura inválido';

    if (RAZON_SOCIAL[razon_social.text as any]) {
      razon_social.text = RAZON_SOCIAL[razon_social.text as any];
      razon_social.confidence = 1;
    }
  }

  private async inferDetalles(): Promise<void> {
    const { razon_social } = Utils.getFields<FemsaHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
        valor_unitario_item,
      } = Utils.getFields<FemsaBodyFields>(product);

      let productDB;

      productDB = await this.meikoService.findByDescription(
        razon_social?.text || '',
        descripcion?.text.slice(1) || '',
      );

      if (!productDB) {
        productDB = await this.meikoService.findByDescription(
          razon_social?.text || '',
          descripcion?.text || '',
        );
      }

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

      const embalaje = (tipo_embalaje.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      if (productDB?.saleValue === valor_unitario_item.text) {
        valor_unitario_item.confidence = 1;
      }

      this.inferProductByCalculation(product);
    }
  }

  private inferProductByCalculation(product: any): void {
    const { valor_unitario_item, valor_venta_item, cantidad } =
      Utils.getFields<FemsaBodyFields>(product);

    const valorVentaCalculado =
      this.toNumber(valor_unitario_item) * this.toNumber(cantidad);

    const difference = Math.abs(
      valorVentaCalculado - this.toNumber(valor_venta_item),
    );

    if (difference <= 5) {
      valor_venta_item.confidence = 1;
    } else
      valor_venta_item.error = `Valor venta no coincide, expected: ${this.toNumber(valor_venta_item)} calculated : ${valorVentaCalculado}`;
  }

  private inferSubtotal() {
    const { total_factura_sin_iva } = Utils.getFields<FemsaHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    let calculatedSubtotal = 0;

    for (const product of products) {
      const { valor_venta_item, valor_descuento } =
        Utils.getFields<FemsaBodyFields>(product);
      calculatedSubtotal =
        calculatedSubtotal +
        this.toNumber(valor_venta_item) -
        this.toNumber(valor_descuento);
    }

    const difference = Math.abs(
      calculatedSubtotal - this.toNumber(total_factura_sin_iva),
    );

    if (difference <= 5) {
      for (const product of products) {
        const { valor_venta_item } = Utils.getFields<FemsaBodyFields>(product);
        valor_venta_item.confidence = 1;
      }
    }
  }
  private inferTotal() {
    const {
      total_factura_sin_iva,
      valor_total_factura,
      ibua,
      iva_tarifa_general,
    } = Utils.getFields<FemsaHeaderFields>(this.data.encabezado);

    const calculated =
      this.toNumber(total_factura_sin_iva) +
      this.toNumber(ibua) +
      this.toNumber(iva_tarifa_general);

    const difference = Math.abs(
      calculated - this.toNumber(valor_total_factura),
    );

    if (difference <= 5) {
      total_factura_sin_iva.confidence = 1;
      valor_total_factura.confidence = 1;
    }
  }

  private inferIBUA() {
    const { ibua } = Utils.getFields<FemsaHeaderFields>(this.data.encabezado);
    const products = Utils.groupFields(this.data.detalles);

    let calculatedValorIBUA = 0;

    for (const product of products) {
      const { valor_ibua_y_otros } = Utils.getFields<FemsaBodyFields>(product);
      calculatedValorIBUA =
        calculatedValorIBUA + this.toNumber(valor_ibua_y_otros);
    }

    const difference = Math.abs(calculatedValorIBUA - this.toNumber(ibua));

    if (difference <= 5) {
      for (const product of products) {
        const { valor_ibua_y_otros } =
          Utils.getFields<FemsaBodyFields>(product);
        valor_ibua_y_otros.confidence = 1;
      }
    }
  }



  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, FEMSA_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, FEMSA_THRESOLDS);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }
}
