import { PostobonBodyFields, PostobonHeaderFields } from './postobon.fields';
import { PostobonInvoiceSchema } from './postobon.schema';
import { Utils } from '../utils';
import { DateTime } from 'luxon';
import { EMBALAJES, EMBALAJES_POSTOBON_CAJA } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import { Document } from '../base/document';
import { MeikoService } from 'src/modules/meiko/meiko.service';
import { InvoiceService } from 'src/modules/invoice/invoice.service';

type HeaderField = PostobonInvoiceSchema['encabezado'][number];
type BodyField = PostobonInvoiceSchema['detalles'][number];

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
    this.inferTotalFacturaSinIva();
    this.addEsDevolucionField();
    this.guessConfidence();
    return this;
  }

  async exclude(): Promise<this> {
    this.data.detalles = await Utils.asyncFilter(
      this.data.detalles,
      async (field) => {
        const { item_descripcion_producto } = Utils.getFields<PostobonBodyFields>([
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
      Utils.getFields<PostobonHeaderFields>(this.data.encabezado);

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

      if (productDB?.packagingType === tipo_embalaje.text) {
        tipo_embalaje.confidence = 1;
      }

      if (productDB?.packagingUnit?.toNumber() === Number(unidades_embalaje?.text)) {
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

  /**
   * Maneja la lógica específica de embalaje de Postobon:
   * - Si es CAJA: el valor viene por packs_vendidos, unidades_vendidas se limpia
   * - Si NO es CAJA: el valor viene por unidades_vendidas, packs_vendidos se limpia
   */
  private inferEmbalaje(product: any[]): void {
    const {
      tipo_embalaje,
      unidades_vendidas,
      packs_vendidos,
    } = Utils.getFields<PostobonBodyFields>(product);

    const embalaje = (tipo_embalaje?.text || '').trim().toUpperCase();

    if (EMBALAJES.includes(embalaje)) {
      tipo_embalaje.confidence = 1;

      if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
        if (unidades_vendidas) {
          unidades_vendidas.text = undefined;
          unidades_vendidas.confidence = 1;
        }
        if (packs_vendidos) {
          packs_vendidos.confidence = 1;
        }
      } else {
        if (packs_vendidos) {
          packs_vendidos.text = undefined;
          packs_vendidos.confidence = 1;
        }
        if (unidades_vendidas) {
          unidades_vendidas.confidence = 1;
        }
      }
    }
  }

  /**
   * Valida los campos mediante cálculo:
   * valorBase = cantidad * valorUnitario
   * valorProducto = valorBase - descuento
   * valorIva = valorProducto * (aplicaIva / 100)
   * valorVentaCalculado = valorProducto + valorIva
   */
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
    }
  }

  /**
   * Valida el total de factura sin IVA sumando los valores base de cada producto
   */
  private inferTotalFacturaSinIva(): void {
    const products = Utils.groupFields(this.data.detalles);
    const headers = Utils.getFields<PostobonHeaderFields>(this.data.encabezado);

    const totalFacturaSinIvaField = headers[PostobonHeaderFields.TOTAL_FACTURA_SIN_IVA];
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
    }
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

  /**
   * Agrega el campo ES_DEVOLUCION a cada producto si no existe
   */
  private addEsDevolucionField(): void {
    const products = Utils.groupFields(this.data.detalles);

    for (const product of products) {
      if (!product || product.length === 0) continue;

      const rowNumber = product[0].row;

      const exists = product.some(
        (f) => f.type === PostobonBodyFields.ES_DEVOLUCION,
      );
      if (exists) continue;

      const newField: BodyField = {
        type: PostobonBodyFields.ES_DEVOLUCION,
        text: '0',
        confidence: 1,
        row: rowNumber,
      };

      product.push(newField);
      this.data.detalles.push(newField);
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
