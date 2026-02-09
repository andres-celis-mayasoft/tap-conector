import { DistribuidorGrpsInvoiceSchema } from './distribuidor-grps.schema';
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
import {
  DistribuidorGrpsBodyFields,
  DistribuidorGrpsHeaderFields,
} from './distribuidor-grps.fields';

export class DistribuidorGrpsInvoice extends Document<DistribuidorGrpsInvoiceSchema> {
  constructor(
    data: DistribuidorGrpsInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    Utils.addMissingFields(
      this.data.detalles,
      Object.values(DistribuidorGrpsBodyFields),
    );
    Utils.parseAndFixNumber(this.data.detalles, [
      DistribuidorGrpsBodyFields.VALOR_VENTA_ITEM,
      DistribuidorGrpsBodyFields.UNIDADES_VENDIDAS,
    ]);
    Utils.parseAndFixNumber(this.data.encabezado, [
      DistribuidorGrpsHeaderFields.TOTAL_FACTURA_SIN_IVA,
      DistribuidorGrpsHeaderFields.VALOR_TOTAL_FACTURA,
    ]);
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<DistribuidorGrpsHeaderFields>(
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
    } = Utils.getFields<DistribuidorGrpsHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        unidades_vendidas,
        codigo_producto,
        valor_venta_item,
      } = Utils.getFields<DistribuidorGrpsBodyFields>(product);

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
