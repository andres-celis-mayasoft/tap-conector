import { QualaBodyFields, QualaHeaderFields } from './quala.fields';
import { QualaInvoiceSchema } from './quala.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';

type HeaderField = QualaInvoiceSchema['encabezado'][number];
type BodyField = QualaInvoiceSchema['detalles'][number];

export class QualaInvoice extends Document<QualaInvoiceSchema> {
  constructor(
    data: QualaInvoiceSchema,
    protected meikoService: MeikoService,
    protected invoiceService: InvoiceService,
  ) {
    super(data);
  }

  normalize(): this {
    return this;
  }

  validate(): void {
    const { fecha_factura } = Utils.getFields<QualaHeaderFields>(
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
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    this.data.detalles = await Utils.asyncFilter(
      this.data.detalles,
      async (field) => {
        const { item_descripcion_producto } = Utils.getFields<QualaBodyFields>([
          field,
        ]);
        const productDB = await this.invoiceService.isExcluded(
          item_descripcion_producto.text
        );
        return !productDB ? false : productDB?.description === item_descripcion_producto.text;
      },
    );
    return this;
  }


  private inferEncabezado(): void {
    const { fecha_factura, numero_factura, razon_social } =
      Utils.getFields<QualaHeaderFields>(this.data.encabezado);

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
    const { razon_social } = Utils.getFields<QualaHeaderFields>(
      this.data.encabezado,
    );
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      const {
        item_descripcion_producto: descripcion,
        codigo_producto,
        tipo_embalaje,
      } = Utils.getFields<QualaBodyFields>(product);

      if (descripcion?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      // Verificar si es fila en blanco (particularidad de Quala)
      if (this.isQualaFilaBlanco(product)) {
        this.setFilaBlancoConfidence(product);
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

      const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();
      if (EMBALAJES.includes(embalaje)) {
        tipo_embalaje.confidence = 1;
      }

      // Validación específica de Quala por cálculo
      this.inferProductByCalculation(product);
    }
  }

  /**
   * Verifica si una fila es "en blanco" según la lógica de Quala:
   * Una fila está en blanco si PORCENTAJE_ICUI, TOTAL_IBUA y VALOR_VENTA_ITEM están vacíos
   */
  private isQualaFilaBlanco(product: any[]): boolean {
    const {
      porcentaje_icui,
      total_ibua,
      valor_venta_item,
    } = Utils.getFields<QualaBodyFields>(product);

    const porcentajeVacio = !porcentaje_icui?.text || porcentaje_icui.text.trim() === '';
    const ibuaVacio = !total_ibua?.text || total_ibua.text.trim() === '';
    const valorVentaVacio = !valor_venta_item?.text || valor_venta_item.text.trim() === '';

    return porcentajeVacio && ibuaVacio && valorVentaVacio;
  }

  /**
   * Cuando una fila está en blanco, se asigna confianza 100 a campos específicos
   */
  private setFilaBlancoConfidence(product: any[]): void {
    const {
      porcentaje_icui,
      total_ibua,
      valor_venta_item,
    } = Utils.getFields<QualaBodyFields>(product);

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
    if (this.isAllZero(valorUnitarioItemDbl, unidadesVendidasDbl, valorIvaDbl, totalIcoDbl, valorVentaItemDbl)) {
      return;
    }

    // Cálculo Quala
    const valorSegunCantidad = valorUnitarioItemDbl * unidadesVendidasDbl;
    const valorIvaCalculado = valorSegunCantidad * (valorIvaDbl / 100);
    const valorPorcentajeIcui = valorSegunCantidad * (porcentajeIcuiDbl / 100);
    const valorVentaCalculado = valorSegunCantidad + valorIvaCalculado + totalIcoDbl + valorPorcentajeIcui + totalIbuaDbl;

    const diferencia = Math.abs(valorVentaItemDbl - valorVentaCalculado);

    if (diferencia <= 1.0) {
      if (unidades_vendidas) unidades_vendidas.confidence = 1;
      if (valor_venta_item) valor_venta_item.confidence = 1;
    }
  }

  private isAllZero(...valores: number[]): boolean {
    for (const v of valores) {
      if (Math.abs(v) > 0.0001) return false;
    }
    return true;
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
