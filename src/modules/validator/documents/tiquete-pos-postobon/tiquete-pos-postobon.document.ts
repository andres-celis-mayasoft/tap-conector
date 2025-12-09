import {
  POS_POSTOBON_THRESOLDS,
  TiquetePosPostobonBodyFields,
  TiquetePosPostobonHeaderFields,
} from './tiquete-pos-postobon.fields';
import { TiquetePosPostobonInvoiceSchema } from './tiquete-pos-postobon.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { EMBALAJES, isNullOrIllegible, NULL_DATE, NULL_FLOAT, NULL_NUMBER, NULL_STRING, toISO8601 } from '../common';
import { Prisma } from '@generated/client-meiko';

type HeaderField = TiquetePosPostobonInvoiceSchema['encabezado'][number];
type BodyField = TiquetePosPostobonInvoiceSchema['detalles'][number];

const EMBALAJE_OPTIONS = ['ST', 'CJ', 'UN'];

export class TiquetePosPostobonInvoice extends Document<TiquetePosPostobonInvoiceSchema> {
  constructor(
    data: TiquetePosPostobonInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<TiquetePosPostobonHeaderFields>(
      this.data.encabezado,
    );
    const isValidDate = Utils.isValidDate(fecha_factura.text);

    if (!isValidDate) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
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
    await this.inferDetalles();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<TiquetePosPostobonBodyFields>(product);

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
    this.data.encabezado = Utils.removeFields(this.data.encabezado, [
      'total_articulos',
    ]);
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      'total_articulos',
      'valor_descuento',
      'valor_subtotal_item',
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<TiquetePosPostobonHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<TiquetePosPostobonHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion, tipo_embalaje } =
        Utils.getFields<TiquetePosPostobonBodyFields>(product);

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

      if (productDB?.description === descripcion.text?.toUpperCase()) {
        descripcion.confidence = 1;
      }

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      this.inferUnidadesEmbalaje(product, descripcion?.text || '');
    }

    this.inferPacks();
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, POS_POSTOBON_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, POS_POSTOBON_THRESOLDS);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }

  private inferPacks() {
    const { total_articulos } = Utils.getFields<TiquetePosPostobonHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let suma_entera = 0;
    let suma_decimal = 0;
    for (const product of products) {
      const { packs_vendidos } =
        Utils.getFields<TiquetePosPostobonBodyFields>(product);

      const texto = packs_vendidos.text ?? '0';

      let ent = '0';
      let dec = '0';

      if (texto.includes('.')) {
        const parts = texto.split('.');
        ent = parts[0];
        dec = parts[1];
      } else {
        ent = texto;
      }

      suma_entera += Number(ent);
      suma_decimal += Number(dec);
    }

    const totalInfered = Number(`${suma_entera}.${suma_decimal}`);
    if (totalInfered === this.toNumber(total_articulos)) {
      for (const product of products) {
        const { packs_vendidos } =
          Utils.getFields<TiquetePosPostobonBodyFields>(product);
        packs_vendidos.confidence = 1;
      }
    }

    return;
  }

  private inferUnidadesEmbalaje(product: any[], descripcion: string): void {
    const { unidades_embalaje } =
      Utils.getFields<TiquetePosPostobonBodyFields>(product);

    if (!unidades_embalaje) return;

    const valor = unidades_embalaje.text || '';
    const confianza = unidades_embalaje.confidence || 0;

    const pattern = /.*[xX]\s*(\d+)/;
    const match = descripcion.match(pattern);

    if ((!valor || valor.trim() === '') && confianza === 0) {
      if (match) {
        const numero = match[1];
        unidades_embalaje.text = numero;
        unidades_embalaje.confidence = 1;
      } else {
        unidades_embalaje.confidence = 1;
      }
    } else if (match) {
      try {
        const valorExistente = parseInt(valor.trim(), 10);
        const numeroDescripcion = parseInt(match[1], 10);

        if (valorExistente === numeroDescripcion) {
          unidades_embalaje.confidence = 1;
        } else
          unidades_embalaje.error = `Unidades embalaje do not match description: Found ${numeroDescripcion}, Expected ${valorExistente}`;
      } catch (e) {
        // Valor no numérico, se ignora
      }
    }
  }

  private inferSubtotal() {
    const { total_factura_sin_iva } =
      Utils.getFields<TiquetePosPostobonHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    let subtotal = 0;

    for (const product of products) {
      const { valor_subtotal_item } =
        Utils.getFields<TiquetePosPostobonBodyFields>(product);

      subtotal = subtotal + this.toNumber(valor_subtotal_item);
    }

    const difference = Math.abs(
      subtotal - this.toNumber(total_factura_sin_iva),
    );

    if (difference <= 5) {
      total_factura_sin_iva.confidence = 1;
    }

    return;
  }

  private inferTotal() {
    const { valor_total_factura } =
      Utils.getFields<TiquetePosPostobonHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    let total = 0;

    for (const product of products) {
      const { valor_venta_item_total_nc } =
        Utils.getFields<TiquetePosPostobonBodyFields>(product);

      total = total + this.toNumber(valor_venta_item_total_nc);
    }

    const difference = Math.abs(total - this.toNumber(valor_total_factura));

    if (difference <= 1) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_venta_item_total_nc } =
          Utils.getFields<TiquetePosPostobonBodyFields>(product);
        valor_venta_item_total_nc.confidence = 1;
      }
    }
  }

    format(): Prisma.ResultCreateManyInput[] {
      const output: Prisma.ResultCreateManyInput[] = [];
  
      const {
        fecha_factura,
        numero_factura,
        razon_social,
        valor_total_factura,
        total_factura_sin_iva,
      } = Utils.getFields<TiquetePosPostobonHeaderFields>(this.data.encabezado);
  
      const products = Utils.groupFields(this.data.detalles);
  
      products.forEach((product, index) => {
        const {
          item_descripcion_producto,
          unidades_embalaje,
          packs_vendidos,
          tipo_embalaje,
          valor_venta_item_total_nc
        } = Utils.getFields<TiquetePosPostobonBodyFields>(product);
  
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
                unitsSold: NULL_FLOAT,
                productCode:  NULL_STRING,
                saleValue: isNullOrIllegible(valor_venta_item_total_nc.text) ?  NULL_NUMBER : valor_venta_item_total_nc.text,
                totalInvoice: isNullOrIllegible(valor_total_factura.text) ?  NULL_NUMBER : valor_total_factura.text,
                totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva.text) ?  NULL_NUMBER : total_factura_sin_iva.text,
                valueIbuaAndOthers: 0,
              });
      });
  
      return output;
    }
}
