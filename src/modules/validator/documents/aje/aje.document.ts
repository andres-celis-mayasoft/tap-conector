import { AJE_THRESOLDS, AjeBodyFields, AjeHeaderFields } from './aje.fields';
import { AjeInvoiceSchema } from './aje.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';
import { EMBALAJES, isNullOrIllegible, NULL_DATE, NULL_FLOAT, NULL_IBUA, NULL_NUMBER, NULL_STRING, toISO8601 } from '../common';
import { Prisma } from '@generated/client-meiko';

type HeaderField = AjeInvoiceSchema['encabezado'][number];
type BodyField = AjeInvoiceSchema['detalles'][number];

const AJE_PRODUCTS_TO_EXCLUDE_KEYWORDS = ['ANDINA', 'ATUN ACEITE', 'TRULU'];

export class AjeInvoice extends Document<AjeInvoiceSchema> {
  constructor(
    data: AjeInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<AjeHeaderFields>(
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
        Utils.getFields<AjeBodyFields>(product);

      if (
        AJE_PRODUCTS_TO_EXCLUDE_KEYWORDS.some((item) =>
          descripcion.text.includes(item),
        ) &&
        descripcion?.text != ''
      ) {
        rows.push(descripcion.row);
      }

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
      'total_productos_filtrados',
      AjeHeaderFields.TOTAL_PACAS,
      AjeHeaderFields.TOTAL_UNIDADES,
    ]);
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      'total_pacas',
      'valor_descuento',
      'precio_antes_iva',
      'valor_iva',
    ]);
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<AjeHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
      } = Utils.getFields<AjeBodyFields>(product);

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
        where: { productCode: codigo_producto.text },
        select: { productCode: true },
      });

      if (result?.productCode === codigo_producto.text) {
        codigo_producto.confidence = 1;
      }

      if (productDB?.description === descripcion.text?.toUpperCase()) {
        descripcion.confidence = 1;
      }

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      // Validación específica de AJE por cálculo
      this.inferProductByCalculation(product);
    }

    this.inferTotalUnidades();
    this.inferTotalPacks();
  }

  private inferProductByCalculation(product: any[]): void {
    const { precio_antes_iva, valor_descuento, valor_iva, valor_venta_item } =
      Utils.getFields<AjeBodyFields>(product);

    const precioAntesIvaDbl = this.toNumber(precio_antes_iva) || 0;
    const valorDescuentoItemDbl = this.toNumber(valor_descuento) || 0;
    const valorIvaDbl = this.toNumber(valor_iva) || 0;
    const valorVentaItemDbl = this.toNumber(valor_venta_item) || 0;

    // Cálculo AJE
    const valorIvaCalculado =
      (precioAntesIvaDbl - valorDescuentoItemDbl) * (valorIvaDbl / 100);
    const valorVentaCalculado =
      precioAntesIvaDbl - valorDescuentoItemDbl + valorIvaCalculado;

    const diferencia = Math.abs(valorVentaItemDbl - valorVentaCalculado);

    if (diferencia <= 1.0) {
      if (precio_antes_iva) precio_antes_iva.confidence = 1;
      if (valor_descuento) valor_descuento.confidence = 1;
      if (valor_iva) valor_iva.confidence = 1;
      if (valor_venta_item) valor_venta_item.confidence = 1;
    } else {
      if (precio_antes_iva)
        precio_antes_iva.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado} Expected : ${this.toNumber(valor_venta_item)} `;

      if (valor_descuento)
        valor_descuento.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado} Expected : ${this.toNumber(valor_venta_item)} `;

      if (valor_iva)
        valor_iva.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado} Expected : ${this.toNumber(valor_venta_item)} `;

      if (valor_venta_item)
        valor_venta_item.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado} Expected : ${this.toNumber(valor_venta_item)} `;
    }
  }

  private inferTotalUnidades() {
    const { total_unidades } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    let totalUnidades = 0;
    for (const product of products) {
      const { unidades_vendidas } = Utils.getFields<AjeBodyFields>(product);
      totalUnidades = totalUnidades + this.toNumber(unidades_vendidas);
    }

    if (this.toNumber(total_unidades) === totalUnidades) {
      for (const product of products) {
        const { unidades_vendidas } = Utils.getFields<AjeBodyFields>(product);
        unidades_vendidas.confidence = 1;
      }
    }
  }

  private inferTotalPacks() {
    const { total_pacas } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    let totalPacks = 0;
    for (const product of products) {
      const { packs_vendidos } = Utils.getFields<AjeBodyFields>(product);
      totalPacks = totalPacks + this.toNumber(packs_vendidos);
    }

    if (this.toNumber(total_pacas) === totalPacks) {
      for (const product of products) {
        const { packs_vendidos } = Utils.getFields<AjeBodyFields>(product);
        packs_vendidos.confidence = 1;
      }
    }
  }

  private inferSubtotal() {
    const { total_factura_sin_iva } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let subtotal = 0;

    for (const product of products) {
      const { precio_antes_iva } = Utils.getFields<AjeBodyFields>(product);

      subtotal = subtotal + this.toNumber(precio_antes_iva);
    }

    if (subtotal === this.toNumber(total_factura_sin_iva)) {
      total_factura_sin_iva.confidence = 1;
    }

    return;
  }

  private inferTotal() {
    const { valor_total_factura } = Utils.getFields<AjeHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let subtotal = 0;

    for (const product of products) {
      const { valor_venta_item } = Utils.getFields<AjeBodyFields>(product);

      subtotal = subtotal + this.toNumber(valor_venta_item);
    }

    if (subtotal === this.toNumber(valor_total_factura)) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_venta_item } = Utils.getFields<AjeBodyFields>(product);
        valor_venta_item.confidence = 1;
      }
    }
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, AJE_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, AJE_THRESOLDS);
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
          total_factura_sin_iva,
          numero_factura
        } = Utils.getFields<AjeHeaderFields>(this.data.encabezado);
    
        const products = Utils.groupFields(this.data.detalles);
    
        products.forEach((product, index) => {
          const {
            item_descripcion_producto,
            unidades_embalaje,
            unidades_vendidas, 
            codigo_producto,
            tipo_embalaje,
            valor_venta_item,
            packs_vendidos,
          } = Utils.getFields<AjeBodyFields>(product);
          
    
        output.push({
                invoiceId: this.data.facturaId,
                rowNumber: index + 1,
                surveyRecordId: Number(this.data.surveyRecordId),
                businessName: isNullOrIllegible(razon_social.text) ? NULL_STRING : razon_social.text ,
                description: isNullOrIllegible(item_descripcion_producto.text) ? NULL_STRING : item_descripcion_producto.text,
                invoiceDate: isNullOrIllegible(fecha_factura.text) ?  NULL_DATE : toISO8601(fecha_factura.text) ,
                invoiceNumber: isNullOrIllegible(numero_factura.text) ? NULL_STRING : numero_factura.text,
                packagingType: isNullOrIllegible(tipo_embalaje.text) ? NULL_STRING : tipo_embalaje.text ,
                packagingUnit: isNullOrIllegible(unidades_embalaje?.text) ?  NULL_FLOAT : unidades_embalaje.text,
                packsSold: isNullOrIllegible(packs_vendidos.text) ?  NULL_FLOAT : packs_vendidos.text,
                unitsSold: isNullOrIllegible(unidades_vendidas.text) ?  NULL_FLOAT : unidades_vendidas.text,
                productCode: isNullOrIllegible(codigo_producto.text) ? NULL_STRING : codigo_producto.text ,
                saleValue: isNullOrIllegible(valor_venta_item.text) ?  NULL_NUMBER : valor_venta_item.text,
                totalInvoice: isNullOrIllegible(valor_total_factura.text) ?  NULL_NUMBER : valor_total_factura.text,
                totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva.text) ?  NULL_NUMBER : total_factura_sin_iva.text,
                valueIbuaAndOthers: NULL_IBUA,
              });
            });
    
        return output;
      }
}
