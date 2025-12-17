import {
  TOLIMA_THRESOLDS,
  TolimaBodyFields,
  TolimaHeaderFields,
} from './tolima.fields';
import { TolimaInvoiceSchema } from './tolima.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import {
  EMBALAJES,
  isNullOrIllegible,
  NULL_DATE,
  NULL_FLOAT,
  NULL_IBUA,
  NULL_NUMBER,
  NULL_STRING,
  OCR_Field,
  toISO8601,
} from '../common';
import { Prisma } from '@generated/client-meiko';

type HeaderField = TolimaInvoiceSchema['encabezado'][number];
type BodyField = TolimaInvoiceSchema['detalles'][number];

export class TolimaInvoice extends Document<TolimaInvoiceSchema> {
  constructor(
    data: TolimaInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<TolimaHeaderFields>(
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
    await this.inferDetalles();
    this.inferTotal();
    this.inferProduct();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<TolimaBodyFields>(product);

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

  private inferTotal() {
    const { valor_total_factura } = Utils.getFields<TolimaHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let total = 0;

    for (const product of products) {
      const { valor_venta_item } = Utils.getFields<TolimaBodyFields>(product);

      total = total + this.toNumber(valor_venta_item);
    }

    const difference = Math.abs(total - this.toNumber(valor_total_factura));

    if (difference <= 1) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_venta_item } = Utils.getFields<TolimaBodyFields>(product);
        valor_venta_item.confidence = 1;
      }
    }else {
      valor_total_factura.error = `Valor total factura no coincide : Expected: ${valor_total_factura.text}. Calculated : ${total}`
    }
  }

  private inferProduct() {
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      let unidadesCalculadas;
      const {
        valor_venta_item,
        cajas,
        descuento,
        unidades_embalaje,
        unidades_vendidas,
        valor_unitario_item,
      } = Utils.getFields<TolimaBodyFields>(product);
      let valorVentaCalculado = 0;
      if (cajas.text === '0') {
        unidadesCalculadas =
          this.toNumber(unidades_embalaje) / this.toNumber(unidades_vendidas);

        valorVentaCalculado =
          this.toNumber(valor_unitario_item) / unidadesCalculadas -
          this.toNumber(descuento);
      } else {
        unidadesCalculadas = this.toNumber(cajas);
        valorVentaCalculado =
          this.toNumber(valor_unitario_item) * unidadesCalculadas -
          this.toNumber(descuento);
      }

      const difference = Math.abs(
        valorVentaCalculado - this.toNumber(valor_venta_item),
      );

      if (difference <= 1) {
        valor_venta_item.confidence = 1;
        unidades_vendidas.confidence = 1;
      } else {
        valor_venta_item.error = `Cálculo producto no coincide: Expected ${valor_venta_item.text}. Calculated: ${valorVentaCalculado}`;
        unidades_vendidas.error = `Cálculo producto no coincide: Expected ${valor_venta_item.text}. Calculated: ${valorVentaCalculado}`;
      }
    }
  }
  prune() {
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      TolimaBodyFields.CAJAS,
      TolimaBodyFields.UNIDADES,
      TolimaBodyFields.DESCUENTO,
      TolimaBodyFields.UNIDADES_EMBALAJE,
      TolimaBodyFields.VALOR_UNITARIO_ITEM,
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<TolimaHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<TolimaHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion, codigo_producto } =
        Utils.getFields<TolimaBodyFields>(product);

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

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
        where: { productCode: codigo_producto?.text },
        select: { productCode: true },
      });

      if (result && result?.productCode === codigo_producto?.text) {
        codigo_producto.confidence = 1;
      }

      if (
        productDB &&
        productDB?.description === descripcion?.text?.toUpperCase()
      ) {
        descripcion.confidence = 1;
      }
    }
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, TOLIMA_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, TOLIMA_THRESOLDS);
  }

  private toNumber(field: OCR_Field<any>): number {
    return Number(field?.text || 0);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  format(): Prisma.ResultCreateManyInput[] {
    const output: Prisma.ResultCreateManyInput[] = [];

    const { fecha_factura, razon_social, valor_total_factura, numero_factura } =
      Utils.getFields<TolimaHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        unidades_embalaje,
        unidades_vendidas,
        codigo_producto,
        valor_venta_item,
      } = Utils.getFields<TolimaBodyFields>(product);

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
        packagingType: NULL_STRING,
        packagingUnit: isNullOrIllegible(unidades_embalaje?.text)
          ? NULL_FLOAT
          : unidades_embalaje.text,
        packsSold: NULL_FLOAT,
        unitsSold: isNullOrIllegible(unidades_vendidas.text)
          ? NULL_FLOAT
          : unidades_vendidas.text,
        productCode: isNullOrIllegible(codigo_producto.text)
          ? NULL_STRING
          : codigo_producto.text,
        saleValue: isNullOrIllegible(valor_venta_item.text)
          ? NULL_NUMBER
          : valor_venta_item.text,
        totalInvoice: isNullOrIllegible(valor_total_factura.text)
          ? NULL_NUMBER
          : valor_total_factura.text,
        totalInvoiceWithoutVAT: NULL_NUMBER,
        valueIbuaAndOthers: NULL_IBUA,
      });
    });

    return output;
  }
}
