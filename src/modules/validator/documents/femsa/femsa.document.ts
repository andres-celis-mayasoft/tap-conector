import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { FemsaInvoiceSchema } from './femsa.schema';
import {
  FEMSA_THRESOLDS,
  FemsaBodyFields,
  FemsaHeaderFields,
} from './femsa.fields';
import { InvoiceService } from 'src/modules/invoice/invoice.service';

type HeaderField = FemsaInvoiceSchema['encabezado'][number];
type BodyField = FemsaInvoiceSchema['detalles'][number];

export class FemsaInvoice extends Document<FemsaInvoiceSchema> {
  constructor(
    data: FemsaInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<FemsaHeaderFields>(
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
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    const rows: number[] = [];
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const { item_descripcion_producto: descripcion } =
        Utils.getFields<FemsaBodyFields>(product);

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
      Utils.getFields<FemsaHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<FemsaHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
        valor_unitario_item,
      } = Utils.getFields<FemsaBodyFields>(product);

      const productDB = await this.meikoService.findByDescription(
        razon_social?.text || '',
        descripcion?.text || '',
      );

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

      const embalaje = (tipo_embalaje.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      if (productDB?.saleValue === valor_unitario_item.text) {
        valor_unitario_item.confidence = 1;
      }
    }
  }

  private guessConfidence(): void {
    Utils.guessConfidence(this.data.encabezado, FEMSA_THRESOLDS);
    Utils.guessConfidence(this.data.detalles, FEMSA_THRESOLDS);
  }

  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }
}
