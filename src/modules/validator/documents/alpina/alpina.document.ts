import { AlpinaBodyFields, AlpinaHeaderFields } from './alpina.fields';
import { AlpinaInvoiceSchema } from './alpina.schema';
import { Utils } from '../utils';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import {
  isNullOrIllegible,
  NULL_DATE,
  NULL_FLOAT,
  NULL_IBUA,
  NULL_NUMBER,
  NULL_STRING,
  toISO8601,
} from '../common';
import { Prisma } from '@generated/client-meiko';

export class AlpinaInvoice extends Document<AlpinaInvoiceSchema> {
  constructor(
    data: AlpinaInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    Utils.addMissingFields(this.data.detalles, Object.values(AlpinaBodyFields));
    Utils.parseAndFixNumber(this.data.detalles, [
      AlpinaBodyFields.VALOR_VENTA_ITEM,
      AlpinaBodyFields.UNIDADES_VENDIDAS,
    ]);
    Utils.parseAndFixNumber(this.data.encabezado, [
      AlpinaHeaderFields.TOTAL_FACTURA_SIN_IVA,
      AlpinaHeaderFields.VALOR_TOTAL_FACTURA,
    ]);
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<AlpinaHeaderFields>(
      this.data.encabezado,
    );

    fecha_factura.text = Utils.fixYear(fecha_factura.text);
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
    const { numero_factura } = Utils.getFields<AlpinaHeaderFields>(
      this.data.encabezado,
    );
    if (this.isNumeric(numero_factura?.text?.slice(-5))) {
      numero_factura.confidence = 1;
      numero_factura.text = numero_factura?.text?.slice(-5);
    } else numero_factura.error = 'Número de factura inválido';
    return this;
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  async exclude(): Promise<this> {
    return this;
  }

  prune() {
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      AlpinaBodyFields.TIPO_EMBALAJE,
    ]);
    return this;
  }

  format(): Prisma.ResultCreateManyInput[] {
    const output: Prisma.ResultCreateManyInput[] = [];

    const {
      fecha_factura,
      razon_social,
      valor_total_factura,
      total_factura_sin_iva,
      numero_factura,
    } = Utils.getFields<AlpinaHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        unidades_vendidas,
        codigo_producto,
        valor_venta_item,
      } = Utils.getFields<AlpinaBodyFields>(product);

      output.push({
        invoiceId: this.data.facturaId,
        rowNumber: index + 1,
        surveyRecordId: Number(this.data.surveyRecordId),
        businessName: isNullOrIllegible(razon_social?.text)
          ? NULL_STRING
          : razon_social?.text,
        description: isNullOrIllegible(item_descripcion_producto?.text)
          ? NULL_STRING
          : item_descripcion_producto?.text,
        invoiceDate: isNullOrIllegible(fecha_factura?.text)
          ? NULL_DATE
          : toISO8601(fecha_factura?.text),
        invoiceNumber: isNullOrIllegible(numero_factura?.text)
          ? NULL_STRING
          : numero_factura?.text,
        packagingType: NULL_STRING,
        packagingUnit: NULL_FLOAT,
        packsSold: NULL_FLOAT,
        unitsSold: isNullOrIllegible(unidades_vendidas?.text)
          ? NULL_FLOAT
          : unidades_vendidas?.text,
        productCode: isNullOrIllegible(codigo_producto?.text)
          ? NULL_STRING
          : codigo_producto?.text,
        saleValue: isNullOrIllegible(valor_venta_item?.text)
          ? NULL_NUMBER
          : valor_venta_item?.text,
        totalInvoice: isNullOrIllegible(valor_total_factura?.text)
          ? NULL_NUMBER
          : valor_total_factura?.text,
        totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva?.text)
          ? NULL_NUMBER
          : total_factura_sin_iva?.text,
        valueIbuaAndOthers: NULL_IBUA,
      });
    });

    return output;
  }
}
