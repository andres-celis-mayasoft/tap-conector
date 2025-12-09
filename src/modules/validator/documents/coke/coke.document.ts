import {
  COKE_THRESOLDS,
  CokeBodyFields,
  CokeHeaderFields,
} from './coke.fields';
import { CokeInvoiceSchema } from './coke.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { EMBALAJES, isNullOrIllegible, NULL_DATE, NULL_FLOAT, NULL_NUMBER, NULL_STRING, toISO8601 } from '../common';
import { Prisma } from '@generated/client-meiko';

type HeaderField = CokeInvoiceSchema['encabezado'][number];
type BodyField = CokeInvoiceSchema['detalles'][number];

export class CokeInvoice extends Document<CokeInvoiceSchema> {
  constructor(
    data: CokeInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    // Convert to negative VALOR_VENTA_ITEM where descriptio is 'REDUCCION'
    const products = Utils.groupFields(this.data.detalles);
    for (const product of products) {
      const descriptionField = product.find(
        (field) => field.type == CokeBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      );
      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        const valorField = product.find(
          (field) => field.type === CokeBodyFields.VALOR_VENTA_ITEM,
        );
        descriptionField.text = descriptionField.text.toUpperCase();
        const valorIBUA = product.find(
          (field) => field.type == CokeBodyFields.VALOR_IBUA_Y_OTROS,
        );
        if(valorIBUA) valorIBUA.text = '';
        
        if (valorField)
          valorField.text = String(this.toNumber(valorField) * -1);
        continue;
      }
    }
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<CokeHeaderFields>(
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
    this.inferTotalFactura();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<CokeBodyFields>(product);

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
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<CokeHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<CokeHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
        valor_unitario_item,
        valor_ibua_y_otros,
      } = Utils.getFields<CokeBodyFields>(product);

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      let productDB;
        
      productDB = await this.meikoService.findByDescription(
        razon_social?.text || '',
        descripcion?.text.slice(1) || '',
      );
      
      if(!productDB) {
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

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      if (productDB && productDB?.saleValue === valor_unitario_item?.text) {
        valor_unitario_item.confidence = 1;
      }

      if (
        productDB &&
        productDB?.valueIbuaAndOthers === valor_ibua_y_otros?.text
      ) {
        valor_ibua_y_otros.confidence = 1;
      }

      // Custom calculation
      this.inferProductByCalculation(product);
    }
  }
  private inferProductByCalculation(product: any): void {
    const {
      valor_venta_item,
      valor_unitario_item,
      valor_ibua_y_otros,
      unidades_embalaje,
      unidades_vendidas,
    } = Utils.getFields<CokeBodyFields>(product);

    if (
      !valor_venta_item ||
      !valor_unitario_item ||
      !valor_ibua_y_otros ||
      !unidades_embalaje ||
      !unidades_vendidas
    ) {
      valor_venta_item.error = 'Missing fields for calculation inference';
      return;
    }

    const unidadesItem =
      this.toNumber(unidades_embalaje) / this.toNumber(unidades_vendidas);
    const valorItem = this.toNumber(valor_unitario_item) / unidadesItem;
    const valorVentaCalculado = valorItem - this.toNumber(valor_ibua_y_otros);

    if (valorVentaCalculado === this.toNumber(valor_venta_item)) {
      unidades_embalaje.confidence = 1;
      unidades_vendidas.confidence = 1;
      valor_unitario_item.confidence = 1;
      valor_ibua_y_otros.confidence = 1;
      valor_venta_item.confidence = 1;
    } else {
      valor_venta_item.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}, Expected : ${this.toNumber(valor_venta_item)} `;
      valor_ibua_y_otros.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}, Expected : ${this.toNumber(valor_venta_item)} `;
      valor_unitario_item.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}, Expected : ${this.toNumber(valor_venta_item)} `;
      unidades_vendidas.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}, Expected : ${this.toNumber(valor_venta_item)} `;
      unidades_embalaje.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}, Expected : ${this.toNumber(valor_venta_item)} `;
    }
  }

  /**
   * Infiere el total de factura sumando todos los valores de venta + IBUA
   */
  private inferTotalFactura(): void {
    const products = Utils.groupFields(this.data.detalles);
    const headers = Utils.getFields<CokeHeaderFields>(this.data.encabezado);

    const calculatedTotal = products.reduce((acc, product) => {
      const fields = Utils.getFields<CokeBodyFields>(product);
      const valorVenta = this.toNumber(fields[CokeBodyFields.VALOR_VENTA_ITEM]);
      const valorIbua = this.toNumber(
        fields[CokeBodyFields.VALOR_IBUA_Y_OTROS],
      );
      return acc + valorVenta + valorIbua;
    }, 0);

    const valorTotalFactura = headers[CokeHeaderFields.VALOR_TOTAL_FACTURA];
    if (
      valorTotalFactura &&
      calculatedTotal === this.toNumber(valorTotalFactura)
    ) {
      valorTotalFactura.confidence = 1;
    } else
      valorTotalFactura.error = `Total factura no coincide. Calculado: ${calculatedTotal}, Esperado: ${this.toNumber(valorTotalFactura)} `;
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, COKE_THRESOLDS);
    Utils.guessConfidence(this.data.detalles,COKE_THRESOLDS);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }

    format(): Prisma.ResultCreateManyInput[] {
          const output: Prisma.ResultCreateManyInput[] = [];
      
          const {
            fecha_factura,
            razon_social,
            valor_total_factura,
            numero_factura,
          } = Utils.getFields<CokeHeaderFields>(this.data.encabezado);
      
          const products = Utils.groupFields(this.data.detalles);
      
          products.forEach((product, index) => {
            const {
              item_descripcion_producto,
              unidades_embalaje,
              unidades_vendidas, 
              codigo_producto,
              valor_ibua_y_otros,
              tipo_embalaje,
              valor_venta_item,
              valor_unitario_item,
            } = Utils.getFields<CokeBodyFields>(product);
            
      
          output.push({
                  invoiceId: this.data.facturaId,
                  rowNumber: index + 1,
                  surveyRecordId: this.data.surveyRecordId,
                  businessName: isNullOrIllegible(razon_social.text) ? NULL_STRING : razon_social.text ,
                  description: isNullOrIllegible(item_descripcion_producto.text) ? NULL_STRING : item_descripcion_producto.text,
                  invoiceDate: isNullOrIllegible(fecha_factura.text) ?  NULL_DATE : toISO8601(fecha_factura.text) ,
                  invoiceNumber: isNullOrIllegible(numero_factura.text) ? NULL_STRING : numero_factura.text,
                  packagingType: isNullOrIllegible(tipo_embalaje.text) ? NULL_STRING : tipo_embalaje.text ,
                  packagingUnit: isNullOrIllegible(unidades_embalaje.text) ?  NULL_FLOAT : unidades_embalaje.text,
                  packsSold: isNullOrIllegible(unidades_embalaje.text) ?  NULL_FLOAT : unidades_embalaje.text,
                  unitsSold: isNullOrIllegible(unidades_vendidas.text) ?  NULL_FLOAT : unidades_vendidas.text,
                  productCode: isNullOrIllegible(codigo_producto.text) ? NULL_STRING : codigo_producto.text ,
                  saleValue: isNullOrIllegible(valor_venta_item.text) ?  NULL_NUMBER : valor_venta_item.text,
                  totalInvoice: isNullOrIllegible(valor_total_factura.text) ?  NULL_NUMBER : valor_total_factura.text,
                  totalInvoiceWithoutVAT: NULL_NUMBER,
                  valueIbuaAndOthers: isNullOrIllegible(valor_ibua_y_otros.text) ?  0 : Number(valor_ibua_y_otros.text),
                });
              });
      
          return output;
        }
}
