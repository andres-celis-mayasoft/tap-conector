import {
  QUALA_THRESOLDS,
  QualaBodyFields,
  QualaHeaderFields,
} from './quala.fields';
import { QualaInvoiceSchema } from './quala.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { RAZON_SOCIAL } from '../../enums/fields';
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

type HeaderField = QualaInvoiceSchema['encabezado'][number];
type BodyField = QualaInvoiceSchema['detalles'][number];

const QUALA_PRODUCTS_TO_EXCLUDE_KEYWORDS = [
  'CUATES',
  'QUIPITOS',
  'LIKE',
  'SUNTEA',
  'DN POLLO',
  'INSTACREM',
  'RC DESME',
  'POP MPX6 CAR 10X6X44 PRV',
  'SOPERA CRE',
  'FAM 6 UN NAL',
  'NUTR REPINT15',
];

export class QualaInvoice extends Document<QualaInvoiceSchema> {
  constructor(
    data: QualaInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    Utils.addMissingFields(this.data.detalles, Object.values(QualaBodyFields));
    Utils.parseAndFixNumber(this.data.detalles, [
      QualaBodyFields.VALOR_VENTA_ITEM,
      QualaBodyFields.UNIDADES_VENDIDAS,
      QualaBodyFields.VALOR_UNITARIO_ITEM,
    ]);
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<QualaHeaderFields>(
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
    this.inferSubTotal();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<QualaBodyFields>(product);

      if (
        QUALA_PRODUCTS_TO_EXCLUDE_KEYWORDS.some((item) =>
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
    ]);
    this.data.detalles = Utils.removeFields(this.data.detalles, [
      'total_ico',
      'porcentaje_icui',
      'total_ibua',
      'valor_iva',
      'valor_unitario_item',
      'es_devolucion',
    ]);
  }

  private inferSubTotal() {
    const { total_factura_sin_iva } = Utils.getFields<QualaHeaderFields>(
      this.data.encabezado,
    );
    let total = 0;
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { valor_unitario_item, unidades_vendidas } =
        Utils.getFields<QualaBodyFields>(product);
      total =
        total +
        this.toNumber(valor_unitario_item) * this.toNumber(unidades_vendidas);
    }

    const difference = Math.abs(this.toNumber(total_factura_sin_iva) - total);

    // PARAMETRIZAR MARGEN DE ERROR
    if (difference <= 1.0) {
      total_factura_sin_iva.confidence = 1;
      for (const product of products) {
        const { valor_unitario_item, unidades_vendidas } =
          Utils.getFields<QualaBodyFields>(product);
        valor_unitario_item.confidence = 1;
        unidades_vendidas.confidence = 1;
      }
    } else {
      total_factura_sin_iva.error = `Total calculation do not match: Calculated: ${total}. Expected : ${this.toNumber(total_factura_sin_iva)} `;
      for (const product of products) {
        const { valor_unitario_item, unidades_vendidas } =
          Utils.getFields<QualaBodyFields>(product);
        valor_unitario_item.error = `Total calculation do not match: Calculated: ${total}. Expected : ${this.toNumber(total_factura_sin_iva)} `;
        unidades_vendidas.error = `Total calculation do not match: Calculated: ${total}. Expected : ${this.toNumber(total_factura_sin_iva)} `;
      }
    }
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<QualaHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<QualaHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion, codigo_producto } =
        Utils.getFields<QualaBodyFields>(product);

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      // Verificar si es fila en blanco (particularidad de Quala)
      if (this.isQualaFilaBlanco(product)) {
        this.setFilaBlancoConfidence(product);
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

      // Validación específica de Quala por cálculo
      this.inferProductByCalculation(product);
    }
  }

  private inferTotal() {
    const { valor_total_factura } = Utils.getFields<QualaHeaderFields>(
      this.data.encabezado,
    );
    let total = 0;
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        valor_venta_item,
        valor_unitario_item,
        unidades_vendidas,
        valor_iva,
        total_ico,
        total_ibua,
        porcentaje_icui,
      } = Utils.getFields<QualaBodyFields>(product);

      const totalProducto =
        this.toNumber(valor_unitario_item) * this.toNumber(unidades_vendidas);

      const iva = totalProducto * (this.toNumber(valor_iva) / 100);

      const icui = totalProducto * (this.toNumber(porcentaje_icui) / 100);

      const totalByProduct =
        this.toNumber(total_ico) +
        this.toNumber(total_ibua) +
        totalProducto +
        iva +
        icui;

      total = total + totalByProduct;

      if (this.toNumber(valor_venta_item) === totalByProduct) {
        valor_venta_item.confidence = 1;
        unidades_vendidas.confidence = 1;
      } else {
        valor_venta_item.error = `Value do not match expected: ${this.toNumber(valor_venta_item)}. Calculated: ${totalByProduct}`;
        unidades_vendidas.error = `Value do not match expected: ${this.toNumber(valor_venta_item)}. Calculated: ${totalByProduct}`;
      }
    }

    const difference = Math.abs(this.toNumber(valor_total_factura) - total);

    // PARAMETRIZAR MARGEN DE ERROR
    if (difference <= 1.0) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_unitario_item, unidades_vendidas } =
          Utils.getFields<QualaBodyFields>(product);
        valor_unitario_item.confidence = 1;
        unidades_vendidas.confidence = 1;
      }
    } else {
      valor_total_factura.error = `Total calculation do not match: Calculated: ${total}. Expected : ${this.toNumber(valor_total_factura)}`;
    }
  }

  /**
   * Verifica si una fila es "en blanco" según la lógica de Quala:
   * Una fila está en blanco si PORCENTAJE_ICUI, TOTAL_IBUA y VALOR_VENTA_ITEM están vacíos
   */
  private isQualaFilaBlanco(product: any[]): boolean {
    const { porcentaje_icui, total_ibua, valor_venta_item } =
      Utils.getFields<QualaBodyFields>(product);

    const porcentajeVacio =
      !porcentaje_icui?.text || porcentaje_icui.text.trim() === '';
    const ibuaVacio = !total_ibua?.text || total_ibua.text.trim() === '';
    const valorVentaVacio =
      !valor_venta_item?.text || valor_venta_item.text.trim() === '';

    return porcentajeVacio && ibuaVacio && valorVentaVacio;
  }

  /**
   * Cuando una fila está en blanco, se asigna confianza 100 a campos específicos
   */
  private setFilaBlancoConfidence(product: any[]): void {
    const { porcentaje_icui, total_ibua, valor_venta_item } =
      Utils.getFields<QualaBodyFields>(product);

    if (porcentaje_icui) porcentaje_icui.confidence = 1;
    if (total_ibua) total_ibua.confidence = 1;
    if (valor_venta_item) valor_venta_item.confidence = 1;
  }

  /**
   * Validación específica de Factura QUALA:
   * valorSegunCantidad = VALOR_UNITARIO_ITEM * UNIDADES_VENDIDAS
   * valorIvaCalculado = valorSegunCantidad * (VALOR_IVA / 100)
   * valorPorcentajeIcui = valorSegunCantidad * (PORCENTAJE_ICUI / 100)
   * valorVentaCalculado = valorSegunCantidad + valorIvaCalculado + TOTAL_ICO + valorPorcentajeIcui + TOTAL_IBUA
   *
   * Si la diferencia con VALOR_VENTA_ITEM es <= 1.0, se validan UNIDADES_VENDIDAS y VALOR_VENTA_ITEM
   */
  private inferProductByCalculation(product: any[]): void {
    const {
      valor_unitario_item,
      unidades_vendidas,
      valor_iva,
      total_ico,
      porcentaje_icui,
      total_ibua,
      valor_venta_item,
    } = Utils.getFields<QualaBodyFields>(product);

    const valorUnitarioItemDbl = this.toNumber(valor_unitario_item) || 0;
    const unidadesVendidasDbl = this.toNumber(unidades_vendidas) || 0;
    const valorIvaDbl = this.toNumber(valor_iva) || 0;
    const totalIcoDbl = this.toNumber(total_ico) || 0;
    const porcentajeIcuiDbl = this.toNumber(porcentaje_icui) || 0;
    const totalIbuaDbl = this.toNumber(total_ibua) || 0;
    const valorVentaItemDbl = this.toNumber(valor_venta_item) || 0;

    // Ignorar si todos los valores son cero
    if (
      this.isAllZero(
        valorUnitarioItemDbl,
        unidadesVendidasDbl,
        valorIvaDbl,
        totalIcoDbl,
        valorVentaItemDbl,
      )
    ) {
      return;
    }

    // Cálculo Quala
    const valorSegunCantidad = valorUnitarioItemDbl * unidadesVendidasDbl;
    const valorIvaCalculado = valorSegunCantidad * (valorIvaDbl / 100);
    const valorPorcentajeIcui = valorSegunCantidad * (porcentajeIcuiDbl / 100);
    const valorVentaCalculado =
      valorSegunCantidad +
      valorIvaCalculado +
      totalIcoDbl +
      valorPorcentajeIcui +
      totalIbuaDbl;

    const diferencia = Math.abs(valorVentaItemDbl - valorVentaCalculado);

    if (diferencia <= 1.0) {
      if (unidades_vendidas) unidades_vendidas.confidence = 1;
      if (valor_venta_item) valor_venta_item.confidence = 1;
    } else {
      unidades_vendidas.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}. Expected : ${this.toNumber(valor_venta_item)} `;
      valor_venta_item.error = `Product total calculation do not match: Calculated: ${valorVentaCalculado}. Expected : ${this.toNumber(valor_venta_item)} `;
    }
  }

  private isAllZero(...valores: number[]): boolean {
    for (const v of valores) {
      if (Math.abs(v) > 0.0001) return false;
    }
    return true;
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, QUALA_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, QUALA_THRESOLDS);
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
      numero_factura,
      razon_social,
      valor_total_factura,
      total_factura_sin_iva,
    } = Utils.getFields<QualaHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        codigo_producto,
        unidades_embalaje,
        valor_venta_item,
        unidades_vendidas,
      } = Utils.getFields<QualaBodyFields>(product);

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
        packagingUnit: isNullOrIllegible(unidades_embalaje.text)
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
        totalInvoiceWithoutVAT: isNullOrIllegible(total_factura_sin_iva.text)
          ? NULL_NUMBER
          : total_factura_sin_iva.text,
        valueIbuaAndOthers: NULL_IBUA,
      });
    });

    return output;
  }
}
