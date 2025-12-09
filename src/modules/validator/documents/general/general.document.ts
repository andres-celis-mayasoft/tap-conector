import {
  GENERAL_THRESOLDS,
  GeneralBodyFields,
  GeneralHeaderFields,
} from './general.fields';
import { GeneralInvoiceSchema as GeneralInvoiceSchema } from './general.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { isNullOrIllegible, NULL_DATE, NULL_FLOAT, NULL_NUMBER, NULL_STRING, toISO8601 } from '../common';
import { Prisma } from '@generated/client-meiko';

type HeaderField = GeneralInvoiceSchema['encabezado'][number];
type BodyField = GeneralInvoiceSchema['detalles'][number];

export class GeneralInvoice extends Document<GeneralInvoiceSchema> {
  constructor(
    data: GeneralInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
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
        numero_factura,total_factura_sin_iva
      } = Utils.getFields<GeneralHeaderFields>(this.data.encabezado);
  
      const products = Utils.groupFields(this.data.detalles);
  
      products.forEach((product, index) => {
        const {
          item_descripcion_producto,
          unidades_embalaje,
          valor_venta_item,
          packs_vendidos,
          codigo_producto,
          tipo_embalaje,
          unidades_vendidas,
          valor_ibua_y_otros
        } = Utils.getFields<GeneralBodyFields>(product);
        
  
        output.push({
        invoiceId: this.data.facturaId,
        rowNumber: index + 1,
        surveyRecordId: Number(this.data.surveyRecordId),
        businessName: isNullOrIllegible(razon_social.text) ? NULL_STRING : razon_social?.text ,
        description: isNullOrIllegible(item_descripcion_producto?.text) ? NULL_STRING : item_descripcion_producto?.text,
        invoiceDate: isNullOrIllegible(fecha_factura?.text) ?  NULL_DATE : toISO8601(fecha_factura?.text) ,
        invoiceNumber: isNullOrIllegible(numero_factura?.text) ? NULL_STRING : numero_factura?.text,
        packagingType: isNullOrIllegible(tipo_embalaje?.text) ? NULL_STRING : tipo_embalaje?.text ,
        packagingUnit: isNullOrIllegible(unidades_embalaje?.text) ?  NULL_FLOAT : unidades_embalaje?.text,
        packsSold: isNullOrIllegible(packs_vendidos?.text) ?  NULL_FLOAT : packs_vendidos?.text,
        unitsSold: isNullOrIllegible(unidades_vendidas?.text) ?  NULL_FLOAT : unidades_vendidas?.text,
        productCode: isNullOrIllegible(codigo_producto?.text) ? NULL_STRING : codigo_producto?.text ,
        saleValue: isNullOrIllegible(valor_venta_item?.text) ?  NULL_NUMBER : valor_venta_item?.text,
        totalInvoice: isNullOrIllegible(valor_total_factura?.text) ?  NULL_NUMBER : valor_total_factura?.text,
        totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva?.text) ?  NULL_NUMBER : total_factura_sin_iva?.text,
        valueIbuaAndOthers: isNullOrIllegible(valor_ibua_y_otros?.text) ?  0 : Number(valor_ibua_y_otros?.text),
      });
    });
  
      return output;
    }
}
