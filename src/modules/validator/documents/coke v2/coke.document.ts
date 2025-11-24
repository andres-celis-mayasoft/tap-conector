import { CokeBodyFields, CokeHeaderFields } from './coke.fields';
import { CokeInvoiceSchema } from './coke.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../document';
import { MeikoService } from 'src/modules/meiko/meiko.service';

type HeaderField = CokeInvoiceSchema['encabezado'][number];
type BodyField = CokeInvoiceSchema['detalles'][number];

export class CokeInvoice extends Document<CokeInvoiceSchema> {
  constructor(
    data: CokeInvoiceSchema,
    protected meikoService: MeikoService,
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
        if (valorField)
          valorField.text = String(this.toNumber(valorField) * -1);
        continue;
      }
    }
    return this;
  }

  validate(): void {
    // Validate FECHA_FACTURA passed months
    const { fecha_factura } = Utils.getFields<CokeHeaderFields>(
      this.data.encabezado,
    );
    const isValidDate = Utils.isValidDate(fecha_factura.text);

    if (!isValidDate) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
      this.isValid = false;
      return;
    }

    const isValid = Utils.hasMonthsPassed(fecha_factura.text, 3);
    this.isValid = isValid;
    if (!isValid) this.errors.fecha_factura = 'Fecha obsoleta';
  }

  async infer(): Promise<this> {
    this.inferEncabezado();
    await this.inferDetalles();
    this.inferTotalFactura();
    this.guessConfidence();
    return this;
  }

  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<CokeHeaderFields>(this.data.encabezado);

    if (DateTime.fromFormat(fecha_factura?.text || '', 'dd/MM/yyyy').isValid) {
      fecha_factura.confidence = 1;
    }
    if (this.isNumeric(numero_factura?.text?.slice(-5))) {
      numero_factura.confidence = 1;
      numero_factura.text = numero_factura?.text?.slice(-5);
    }
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
        valor_total_unitario_item,
      } = Utils.getFields<CokeBodyFields>(product);

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }
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

      if (productDB?.saleValue === valor_total_unitario_item.text) {
        valor_total_unitario_item.confidence = 1;
      }


      // Custom calculation
      this.inferProductByCalculation(product);
      
    }
  }
  private inferProductByCalculation(product: any): void {
    const {
      valor_venta_item,
      valor_total_unitario_item,
      valor_ibua_y_otros,
      unidades_embalaje,
      unidades_vendidas,
    } = Utils.getFields<CokeBodyFields>(product);

    const unidadesItem =
      this.toNumber(unidades_embalaje) / this.toNumber(unidades_vendidas);
    const valorItem = this.toNumber(valor_total_unitario_item) / unidadesItem;
    const valorVentaCalculado = valorItem - this.toNumber(valor_ibua_y_otros);

    if (valorVentaCalculado === this.toNumber(valor_venta_item)) {
      unidades_embalaje.confidence = 1;
      unidades_vendidas.confidence = 1;
      valor_total_unitario_item.confidence = 1;
      valor_ibua_y_otros.confidence = 1;
      valor_venta_item.confidence = 1;
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
    }
  }

  private guessConfidence(): void {
    for (const field of this.data.encabezado) {
      if (field.confidence >= 0.95) {
        field.confidence = 1;
      }
    }

    for (const field of this.data.detalles) {
      if (field.confidence >= 0.95) {
        field.confidence = 1;
      }
    }
  }


  private isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  private toNumber(field: BodyField | HeaderField | undefined): number {
    return Number(field?.text || 0);
  }
}
