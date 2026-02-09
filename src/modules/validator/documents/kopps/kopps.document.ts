import {
  KOPPS_THRESOLDS,
  KoppsBodyFields,
  KoppsHeaderFields,
} from './kopps.fields';
import { KoppsInvoiceSchema } from './kopps.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import {
  EMBALAJES,
  isNullOrIllegible,
  NULL_DATE,
  NULL_FLOAT,
  NULL_IBUA,
  NULL_NUMBER,
  NULL_STRING,
  toISO8601,
} from '../common';
import { Prisma } from '@generated/client-meiko';
import { Product } from '@generated/client';
import { ExcludedService } from 'src/modules/excluded/excluded.service';
import { ProductService } from 'src/modules/product/product.service';

type HeaderField = KoppsInvoiceSchema['encabezado'][number];
type BodyField = KoppsInvoiceSchema['detalles'][number];

export class KoppsInvoice extends Document<KoppsInvoiceSchema> {
  constructor(
    data: KoppsInvoiceSchema,
    protected excludedService: ExcludedService,
    protected productService: ProductService,
  ) {
    super(data);
  }

  normalize(): this {
    Utils.addMissingFields(this.data.detalles, Object.values(KoppsBodyFields));
    Utils.parseAndFixNumber(this.data.detalles, [
      KoppsBodyFields.VALOR_VENTA_ITEM,
      KoppsBodyFields.PACKS_VENDIDOS,
      KoppsBodyFields.VALOR_UNITARIO_ITEM,
    ]);
    Utils.parseAndFixNumber(this.data.encabezado, [
      KoppsHeaderFields.TOTAL_FACTURA_SIN_IVA,
      KoppsHeaderFields.VALOR_TOTAL_FACTURA,
    ]);
    
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<KoppsHeaderFields>(
      this.data.encabezado,
    );
    
    fecha_factura.text = Utils.fixYear(fecha_factura.text);
    const isValidDate = Utils.isValidDate(fecha_factura.text);

    if (!isValidDate) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
      return;
    }

    const isValid = Utils.hasMonthsPassed(fecha_factura.text);
    this.isValid = isValid;
    if (!isValid) this.errors.fecha_factura = 'Fecha obsoleta';
  }

  async infer(): Promise<this> {
    this.inferEncabezado();
    this.inferTotal();
    this.inferSubtotal();
    await this.inferDetalles();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<KoppsBodyFields>(product);

      const productDB = await this.excludedService.findByDescription(
        descripcion?.text,
        1,
      );

      if (!productDB) continue;

      rows.push(descripcion.row);
    }

    this.data.detalles = this.data.detalles.filter(
      (field) => !rows.includes(field.row || -1),
    );

    return this;
  }

  prune() {
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      KoppsBodyFields.PRECIO_BRUTO_ITEM,
      KoppsBodyFields.VALOR_UNITARIO_ITEM,
      KoppsBodyFields.TOTAL_ICO,
      KoppsBodyFields.VALOR_IVA,
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, razon_social, numero_factura } =
      Utils.getFields<KoppsHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<KoppsHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        tipo_embalaje,
        codigo_producto,
        unidades_embalaje,
      } = Utils.getFields<KoppsBodyFields>(product);

      let productDB: Product | null;
      productDB = await this.productService.findOneFuzzy(
        descripcion?.text || '',
        1,
      );

      if (!productDB && codigo_producto?.text) {
        productDB = await this.productService.findOne({
          code: codigo_producto.text,
          companyId: 1,
        });
      }

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      if (productDB) {
        descripcion.text = productDB?.description || descripcion.text;
        descripcion.confidence = 1;

        codigo_producto.text = productDB?.code || codigo_producto.text;
        codigo_producto.confidence = 1;

        unidades_embalaje.text =
          productDB?.packagingUnit || unidades_embalaje.text;
        unidades_embalaje.confidence = 1;

        tipo_embalaje.text = productDB?.packagingType || tipo_embalaje.text;
        tipo_embalaje.confidence = 1;
      } else {
        descripcion.confidence = 0;
        console.log('No está en base de conocimiento:', descripcion.text);
      }

      this.inferProduct(product);
    }
  }

  private inferProduct(product: any) {
    const {
      packs_vendidos,
      valor_unitario_item,
      descuento,
      valor_iva,
      total_ico,
      valor_venta_item,
    } = Utils.getFields<KoppsBodyFields>(product);

    const result =
      this.toNumber(packs_vendidos) * this.toNumber(valor_unitario_item);

    const iva =
      ((result - this.toNumber(descuento)) * this.toNumber(valor_iva)) / 100;

    const valorVentaCalculado =
      result - this.toNumber(descuento) + this.toNumber(total_ico) + iva;

    const difference = Math.abs(
      valorVentaCalculado - this.toNumber(valor_venta_item),
    );

    if (difference <= 1) {
      if (valor_venta_item) valor_venta_item.confidence = 1;
      if (descuento) descuento.confidence = 1;
      if (packs_vendidos) packs_vendidos.confidence = 1;
    } else {
      valor_venta_item.error = `Valor venta no coincide. Esperado ${valorVentaCalculado.toFixed(2)}, Calculado : ${this.toNumber(valor_venta_item)}`;
    }
  }

  private inferTotal() {
    const { valor_total_factura } = Utils.getFields<KoppsHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let subtotal = 0;

    for (const product of products) {
      const { valor_venta_item } = Utils.getFields<KoppsBodyFields>(product);

      subtotal = subtotal + this.toNumber(valor_venta_item);
    }

    const difference = Math.abs(subtotal - this.toNumber(valor_total_factura));

    if (difference <= 1) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_venta_item } = Utils.getFields<KoppsBodyFields>(product);
        if (valor_venta_item) valor_venta_item.confidence = 1;
      }
    }
  }

  private inferSubtotal() {
    const { total_factura_sin_iva } = Utils.getFields<KoppsHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let subtotal = 0;

    for (const product of products) {
      const { packs_vendidos, valor_unitario_item, valor_venta_item } =
        Utils.getFields<KoppsBodyFields>(product);

      const result =
        this.toNumber(packs_vendidos) * this.toNumber(valor_unitario_item);

      subtotal = subtotal + result;
    }

    const difference = Math.abs(
      subtotal - this.toNumber(total_factura_sin_iva),
    );

    if (difference <= 1) {
      total_factura_sin_iva.confidence = 1;
      for (const product of products) {
        const { packs_vendidos } = Utils.getFields<KoppsBodyFields>(product);
        if (packs_vendidos) packs_vendidos.confidence = 1;
      }
    }
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, KOPPS_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, KOPPS_THRESOLDS);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  format(): Prisma.ResultCreateManyInput[] {
    const output: Prisma.ResultCreateManyInput[] = [];

    const {
      fecha_factura,
      razon_social,
      valor_total_factura,
      numero_factura,
      total_factura_sin_iva,
    } = Utils.getFields<KoppsHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        valor_venta_item,
        codigo_producto,
        packs_vendidos,
        tipo_embalaje,
        descuento,
        unidades_embalaje,
      } = Utils.getFields<KoppsBodyFields>(product);

      output.push({
        invoiceId: this.data.facturaId,
        rowNumber: index + 1,
        surveyRecordId: Number(this.data.surveyRecordId),
        businessName: isNullOrIllegible(razon_social.text)
          ? NULL_STRING
          : razon_social.text,
        description: isNullOrIllegible(item_descripcion_producto.text)
          ? NULL_STRING
          : item_descripcion_producto.text,
        invoiceDate: isNullOrIllegible(fecha_factura.text)
          ? NULL_DATE
          : toISO8601(fecha_factura.text),
        invoiceNumber: isNullOrIllegible(numero_factura.text)
          ? NULL_STRING
          : numero_factura.text,
        packagingType: isNullOrIllegible(tipo_embalaje?.text)
          ? NULL_STRING
          : tipo_embalaje.text,
        packagingUnit: isNullOrIllegible(unidades_embalaje?.text)
          ? NULL_FLOAT
          : unidades_embalaje.text,
        packsSold: isNullOrIllegible(packs_vendidos?.text)
          ? NULL_FLOAT
          : packs_vendidos?.text,
        unitsSold: NULL_FLOAT,
        productCode: isNullOrIllegible(codigo_producto?.text)
          ? NULL_STRING
          : codigo_producto.text,
        saleValue: isNullOrIllegible(valor_venta_item?.text)
          ? NULL_NUMBER
          : valor_venta_item.text,
        totalInvoice: isNullOrIllegible(valor_total_factura.text)
          ? NULL_NUMBER
          : valor_total_factura.text,
        totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva.text)
          ? NULL_NUMBER
          : total_factura_sin_iva.text,
        valueIbuaAndOthers: NULL_IBUA,
      });
    });

    return output;
  }
}
