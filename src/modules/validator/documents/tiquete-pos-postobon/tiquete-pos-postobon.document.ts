import {
  POS_POSTOBON_THRESOLDS,
  TiquetePosPostobonBodyFields,
  TiquetePosPostobonHeaderFields,
} from './tiquete-pos-postobon.fields';
import { TiquetePosPostobonInvoiceSchema } from './tiquete-pos-postobon.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';

type HeaderField = TiquetePosPostobonInvoiceSchema['encabezado'][number];
type BodyField = TiquetePosPostobonInvoiceSchema['detalles'][number];

const MIN_CONFIANZA_OCR_85 = 0.85;

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

      const productDB = await this.meikoService.findByDescription(
        razon_social?.text || '',
        descripcion?.text || '',
      );

      if (productDB?.description === descripcion.text?.toUpperCase()) {
        descripcion.confidence = 1;
      }

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }
    }
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
}
