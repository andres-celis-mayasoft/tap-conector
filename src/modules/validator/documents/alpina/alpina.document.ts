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
    return this;
  }

  validate(): void {}

  async infer(): Promise<this> {
    return this;
  }

  async exclude(): Promise<this> {
    return this;
  }

  prune() {}

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
        tipo_embalaje,
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
        packagingType: isNullOrIllegible(tipo_embalaje?.text)
          ? NULL_STRING
          : tipo_embalaje?.text,
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
