import {
  INFOCARGUE_THRESOLDS,
  InfocargueBodyFields,
  InfocargueHeaderFields,
} from './infocargue.fields';
import { InfocargueInvoiceSchema } from './infocargue.schema';
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

type HeaderField = InfocargueInvoiceSchema['encabezado'][number];
type BodyField = InfocargueInvoiceSchema['detalles'][number];

export class InfocargueInvoice extends Document<InfocargueInvoiceSchema> {
  constructor(
    data: InfocargueInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    const products = Utils.groupFields(this.data.detalles);
    for (const product of products) {
      const descriptionField = product.find(
        (field) => field.type == InfocargueBodyFields.ITEM_DESCRIPCION_PRODUCTO,
      );
      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        const valorField = product.find(
          (field) => field.type === InfocargueBodyFields.VALOR_VENTA_ITEM,
        );
        if (valorField)
          valorField.text = String(this.toNumber(valorField) * -1);
        continue;
      }
    }

    Utils.addMissingFields(
      this.data.detalles,
      Object.values(InfocargueBodyFields),
    );
    Utils.parseAndFixNumber(this.data.detalles, [
      InfocargueBodyFields.VALOR_VENTA_ITEM,
      InfocargueBodyFields.PACKS_CON_UNIDADES,
    ]);
    Utils.parseAndFixNumber(this.data.encabezado, [
      InfocargueHeaderFields.VALOR_TOTAL_FACTURA,
    ]);
    
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<InfocargueHeaderFields>(
      this.data.encabezado,
    );

    fecha_factura.text = Utils.fixYear(fecha_factura.text);
    const isValidDate = Utils.isValidDate(fecha_factura.text);

    if (!isValidDate) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
      return;
    }

    const isValid = Utils.hasMonthsPassed(fecha_factura.text);
    this.isValid = isValid;
    if (!isValid) this.errors.fecha_factura = 'Fecha obsoleta';
  }

  async infer(): Promise<this> {
    this.inferEncabezado();
    this.inferPacks();
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
        Utils.getFields<InfocargueBodyFields>(product);

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

  prune() {}

  private inferEncabezado(): void {
    const { fecha_factura, razon_social } =
      Utils.getFields<InfocargueHeaderFields>(this.data.encabezado);

    if (
      DateTime.fromFormat(fecha_factura?.text || '', 'dd/MM/yyyy').isValid &&
      !fecha_factura.error
    ) {
      fecha_factura.confidence = 1;
    }

    if (RAZON_SOCIAL[razon_social.text as any]) {
      razon_social.text = RAZON_SOCIAL[razon_social.text as any];
      razon_social.confidence = 1;
    }
  }

  private async inferDetalles(): Promise<void> {
    const { razon_social } = Utils.getFields<InfocargueHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<InfocargueBodyFields>(product);

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

      this.inferUnidadesEmbalaje(product, descripcion?.text || '');
    }
  }

  private async inferPacks() {
    const products = Utils.groupFields(this.data.detalles);
    const pattern = /^\d+\/\d+$/;

    for (const product of products) {
      const { packs_con_unidades } =
        Utils.getFields<InfocargueBodyFields>(product);

      if (pattern.test(packs_con_unidades?.text)) {
        packs_con_unidades.confidence = 1;
      }
    }
  }

  private inferTotal() {
    const { valor_total_factura } = Utils.getFields<InfocargueHeaderFields>(
      this.data.encabezado,
    );

    const products = Utils.groupFields(this.data.detalles);

    let subtotal = 0;

    for (const product of products) {
      const { valor_venta_item } =
        Utils.getFields<InfocargueBodyFields>(product);

      subtotal = subtotal + this.toNumber(valor_venta_item);
    }

    const difference = Math.abs(subtotal - this.toNumber(valor_total_factura));

    if (difference <= 1) {
      valor_total_factura.confidence = 1;
      for (const product of products) {
        const { valor_venta_item } =
          Utils.getFields<InfocargueBodyFields>(product);
        valor_venta_item.confidence = 1;
      }
    }
  }
  /**
   * Infiere UNIDADES_EMBALAJE desde la descripción del producto
   * Busca patrones como "x12", "X24", etc.
   */
  private inferUnidadesEmbalaje(product: any[], descripcion: string): void {
    const { unidades_embalaje } =
      Utils.getFields<InfocargueBodyFields>(product);

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
          unidades_embalaje.error = `Unidades embalaje do not match description: Found ${numeroDescripcion}. Expected ${valorExistente}`;
      } catch (e) {
        // Valor no numérico, se ignora
      }
    }
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, INFOCARGUE_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, INFOCARGUE_THRESOLDS);
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

    const { fecha_factura, razon_social, valor_total_factura } =
      Utils.getFields<InfocargueHeaderFields>(this.data.encabezado);

    const products = Utils.groupFields(this.data.detalles);

    products.forEach((product, index) => {
      const {
        item_descripcion_producto,
        unidades_embalaje,
        valor_venta_item,
        packs_con_unidades,
      } = Utils.getFields<InfocargueBodyFields>(product);

      const { packsSold, unitsSold } = Utils.parsePackConUnidades(
        packs_con_unidades.text,
      );

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
        invoiceNumber: NULL_STRING,
        packagingType: NULL_STRING,
        packagingUnit: isNullOrIllegible(unidades_embalaje.text)
          ? NULL_FLOAT
          : unidades_embalaje.text,
        packsSold: packsSold,
        unitsSold: unitsSold,
        productCode: NULL_STRING,
        saleValue: isNullOrIllegible(valor_venta_item.text)
          ? NULL_NUMBER
          : valor_venta_item.text,
        totalInvoice: isNullOrIllegible(valor_total_factura.text)
          ? NULL_NUMBER
          : valor_total_factura.text,
        totalInvoiceWithoutVAT: NULL_NUMBER,
        valueIbuaAndOthers: NULL_IBUA,
      });
    });

    return output;
  }
}
