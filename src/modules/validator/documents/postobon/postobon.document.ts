import {
  POSTOBON_THRESOLDS,
  PostobonBodyFields,
  PostobonHeaderFields,
} from './postobon.fields';
import { PostobonInvoiceSchema } from './postobon.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { EMBALAJES, EMBALAJES_POSTOBON_CAJA, isNullOrIllegible, NULL_DATE, NULL_FLOAT, NULL_NUMBER, NULL_STRING, OCR_Field, toISO8601 } from '../common';
import { Prisma } from '@generated/client-meiko';

export class PostobonInvoice extends Document<PostobonInvoiceSchema> {
  constructor(
    data: PostobonInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<PostobonHeaderFields>(
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
    this.inferTotalFacturaSinIva();
    this.inferTotal();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<PostobonBodyFields>(product);

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
      'valor_total_unitario_item',
      'valor_descuento_item',
      'aplica_iva_item',
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<PostobonHeaderFields>(this.data.encabezado);

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

    razon_social.confidence = 1;
  }

  private async inferDetalles(): Promise<void> {
    const { razon_social } = Utils.getFields<PostobonHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
        unidades_embalaje,
        packs_vendidos,
        valor_venta_item,
      } = Utils.getFields<PostobonBodyFields>(product);

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

      if (result?.productCode === codigo_producto.text) {
        codigo_producto.confidence = 1;
      }

      if (productDB?.description === descripcion.text?.toUpperCase()) {
        descripcion.confidence = 1;
      }

      if (productDB?.packagingType === tipo_embalaje.text) {
        tipo_embalaje.confidence = 1;
      }

      if (
        productDB?.packagingUnit?.toNumber() === Number(unidades_embalaje?.text)
      ) {
        unidades_embalaje.confidence = 1;
      }

      if (productDB?.packsSold?.toNumber() === Number(packs_vendidos?.text)) {
        packs_vendidos.confidence = 1;
      }

      if (productDB?.saleValue?.toNumber() === Number(valor_venta_item?.text)) {
        valor_venta_item.confidence = 1;
      }

      this.inferEmbalaje(product);
      this.inferProductByCalculation(product);
    }
  }

  private inferEmbalaje(product: any[]): void {
    const { tipo_embalaje, unidades_vendidas, packs_vendidos } =
      Utils.getFields<PostobonBodyFields>(product);

    const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();

    if (EMBALAJES.includes(embalaje)) {
      tipo_embalaje.confidence = 1;

      if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
        if (unidades_vendidas) {
          unidades_vendidas.text = '';
          unidades_vendidas.confidence = 1;
        }
        if (packs_vendidos) {
          packs_vendidos.confidence = 1;
        }
      } else {
        if (packs_vendidos) {
          packs_vendidos.text = '';
          packs_vendidos.confidence = 1;
        }
        if (unidades_vendidas) {
          unidades_vendidas.confidence = 1;
        }
      }
    }
  }

  private inferTotal() {
    const { valor_total_factura } = Utils.getFields<PostobonHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let total = 0;

    for (const product of products) {
      const { valor_venta_item } = Utils.getFields<PostobonBodyFields>(product);

      total = total + this.toNumber(valor_venta_item);
    }

    const difference = Math.abs(total - this.toNumber(valor_total_factura));

    if (difference <= 1) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_venta_item } =
          Utils.getFields<PostobonBodyFields>(product);
        valor_venta_item.confidence = 1;
      }
    }
  }

  private inferProductByCalculation(product: any[]): void {
    const {
      packs_vendidos,
      unidades_vendidas,
      valor_unitario_item,
      valor_venta_item,
      aplica_iva_item,
      valor_descuento_item,
      tipo_embalaje,
    } = Utils.getFields<PostobonBodyFields>(product);

    const packsVendidosDbl = this.toNumber(packs_vendidos) || 0;
    const unidadesVendidasDbl = this.toNumber(unidades_vendidas) || 0;
    const valorUnitarioDbl = this.toNumber(valor_unitario_item) || 0;
    const valorVentaItemDbl = this.toNumber(valor_venta_item) || 0;
    const aplicaIvaItemDbl = this.toNumber(aplica_iva_item) || 0;
    const valorDescuentoItemDbl = this.toNumber(valor_descuento_item) || 0;

    const embalaje = (tipo_embalaje?.text || '').toUpperCase();

    let cantidadUnidades = 0;
    if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
      cantidadUnidades = packsVendidosDbl;
    } else {
      cantidadUnidades = unidadesVendidasDbl;
    }

    const valorBaseCalculado = cantidadUnidades * valorUnitarioDbl;
    const valorProductoCalculado = valorBaseCalculado - valorDescuentoItemDbl;
    const valorIva = valorProductoCalculado * (aplicaIvaItemDbl / 100);
    const valorVentaCalculado = valorProductoCalculado + valorIva;

    const diferencia = Math.abs(valorVentaItemDbl - valorVentaCalculado);

    if (diferencia >= 0.0 && diferencia <= 1.0) {
      if (packs_vendidos) packs_vendidos.confidence = 1;
      if (unidades_vendidas) unidades_vendidas.confidence = 1;
      if (valor_unitario_item) valor_unitario_item.confidence = 1;
      if (valor_venta_item) valor_venta_item.confidence = 1;
      if (tipo_embalaje) tipo_embalaje.confidence = 1;
      if (valor_descuento_item) valor_descuento_item.confidence = 1;
      if (aplica_iva_item) aplica_iva_item.confidence = 1;
    } else {
      packs_vendidos.error = 'Valor de venta no concuerda con el cálculo';
      unidades_vendidas.error = 'Valor de venta no concuerda con el cálculo';
      valor_unitario_item.error = 'Valor de venta no concuerda con el cálculo';
      valor_venta_item.error = 'Valor de venta no concuerda con el cálculo';
      tipo_embalaje.error = 'Valor de venta no concuerda con el cálculo';
      valor_descuento_item.error = 'Valor de venta no concuerda con el cálculo';
      aplica_iva_item.error = 'Valor de venta no concuerda con el cálculo';
    }
  }

  private inferTotalFacturaSinIva(): void {
    const products = Utils.groupFields(this.data.detalles);
    const headers = Utils.getFields<PostobonHeaderFields>(this.data.encabezado);

    const totalFacturaSinIvaField =
      headers[PostobonHeaderFields.TOTAL_FACTURA_SIN_IVA];
    if (!totalFacturaSinIvaField) return;

    const totalFacturaSinIva = this.toNumber(totalFacturaSinIvaField) || 0;
    let acumulado = 0.0;

    for (const product of products) {
      const valorBase = this.calcularValorBaseProducto(product);
      if (valorBase !== null) {
        acumulado += valorBase;
      }
    }

    const diferencia = Math.abs(totalFacturaSinIva - acumulado);

    if (diferencia >= 0.0 && diferencia <= 1.0) {
      totalFacturaSinIvaField.confidence = 1;
    } else
      totalFacturaSinIvaField.error =
        'Total factura sin IVA no concuerda con la suma de los productos';
  }

  private calcularValorBaseProducto(product: any[]): number | null {
    const {
      packs_vendidos,
      unidades_vendidas,
      valor_unitario_item,
      tipo_embalaje,
    } = Utils.getFields<PostobonBodyFields>(product);

    const packsVendidosDbl = this.toNumber(packs_vendidos) || 0;
    const unidadesVendidasDbl = this.toNumber(unidades_vendidas) || 0;
    const valorUnitarioDbl = this.toNumber(valor_unitario_item) || 0;
    const embalaje = (tipo_embalaje?.text || '').toUpperCase();

    let cantidadUnidades = 0;
    if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
      cantidadUnidades = packsVendidosDbl;
    } else {
      cantidadUnidades = unidadesVendidasDbl;
    }

    return cantidadUnidades * valorUnitarioDbl;
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, POSTOBON_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, POSTOBON_THRESOLDS);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: OCR_Field<any>): number {
    return Number(field?.text || 0);
  }

  format(): Prisma.ResultCreateManyInput[] {
    const output: Prisma.ResultCreateManyInput[] = [];

    const {
      fecha_factura,
      numero_factura,
      razon_social,
      valor_total_factura,
      total_factura_sin_iva,
    } = Utils.getFields<PostobonHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        codigo_producto,
        tipo_embalaje,
        unidades_embalaje,
        packs_vendidos,
        valor_venta_item,
        unidades_vendidas,
      } = Utils.getFields<PostobonBodyFields>(product);
      

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
        packsSold: isNullOrIllegible(packs_vendidos.text) ?  NULL_FLOAT : packs_vendidos.text,
        unitsSold: isNullOrIllegible(unidades_vendidas.text) ?  NULL_FLOAT : unidades_vendidas.text,
        productCode: isNullOrIllegible(codigo_producto.text) ? NULL_STRING : codigo_producto.text ,
        saleValue: isNullOrIllegible(valor_venta_item.text) ?  NULL_NUMBER : valor_venta_item.text,
        totalInvoice: isNullOrIllegible(valor_total_factura.text) ?  NULL_NUMBER : valor_total_factura.text,
        totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva.text) ?  NULL_NUMBER : total_factura_sin_iva.text,
        valueIbuaAndOthers: 0,
      });
    });

    return output;
  }
}
