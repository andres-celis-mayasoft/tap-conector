import { EntregaPostobonInvoiceSchema } from './entrega-postobon.schema';
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
  EntregaPostobonBodyFields,
  EntregaPostobonHeaderFields,
} from './entrega-postobon.fields';

export class EntregaPostobonInvoice extends Document<EntregaPostobonInvoiceSchema> {
  constructor(
    data: EntregaPostobonInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
    Utils.addMissingFields(
      this.data.detalles,
      Object.values(EntregaPostobonBodyFields),
    );
    Utils.parseAndFixNumber(this.data.detalles, [
      EntregaPostobonBodyFields.VALOR_VENTA_ITEM,
      EntregaPostobonBodyFields.PACKS_VENDIDOS,
    ]);
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

    const { fecha_factura, razon_social, valor_total_factura } =
      Utils.getFields<EntregaPostobonHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        packs_vendidos,
        unidades_embalaje,
        valor_venta_item,
      } = Utils.getFields<EntregaPostobonBodyFields>(product);

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
        invoiceNumber: NULL_STRING,
        packagingType: NULL_STRING,
        packagingUnit: isNullOrIllegible(unidades_embalaje?.text)
          ? NULL_FLOAT
          : unidades_embalaje?.text,
        packsSold: isNullOrIllegible(packs_vendidos?.text)
          ? NULL_FLOAT
          : packs_vendidos?.text,
        unitsSold: NULL_FLOAT,
        productCode: NULL_STRING,
        saleValue: isNullOrIllegible(valor_venta_item?.text)
          ? NULL_NUMBER
          : valor_venta_item?.text,
        totalInvoice: isNullOrIllegible(valor_total_factura?.text)
          ? NULL_NUMBER
          : valor_total_factura?.text,
        totalInvoiceWithoutVAT: NULL_NUMBER,
        valueIbuaAndOthers: NULL_IBUA,
      });
    });

    return output;
  }
}
