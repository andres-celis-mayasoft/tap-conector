import {
  Inject,
  Injectable,
  Optional,
  NotFoundException,
} from '@nestjs/common';
import { ValidateInvoice, InvoiceEntry } from './interfaces/invoice.interface';
import { Fields, RAZON_SOCIAL } from './enums/fields';
import {
  EMBALAJES,
  EMBALAJES_POSTOBON_CAJA,
  ValidatorUtils as Validator,
} from './utils/validator.utils';
import { MeikoService } from '../meiko/meiko.service';
import { DateTime } from 'luxon';
import { DocumentFactory } from './documents/base/document.factory';
import { PrismaService } from '../../database/services/prisma.service';
import { PrismaTapService } from 'src/database/services/prisma-tap.service';
import { CokeInvoice } from './documents/coke/coke.document';

@Injectable()
export class ValidatorService {
  constructor(
    private meikoService: MeikoService,
    private tapService: PrismaTapService,
    private prisma: PrismaService,
  ) {}

  async validateInvoice(invoice: ValidateInvoice) {
    // const { data , errors } = DocumentFactory.create(invoice.tipoFacturaOcr, invoice).get();

    if (invoice.tipoFacturaOcr == 'Factura Coke')
            return new CokeInvoice(invoice as any, this.meikoService);
      
      return this.CokeValidator(invoice);
    if (invoice.tipoFacturaOcr === 'Factura Postobon')
      return this.PostobonValidator(invoice);
    if (invoice.tipoFacturaOcr === 'Factura Infocargue')
      return this.InfocargueValidator(invoice);
  }

  async CokeValidator(invoice: ValidateInvoice) {
    const headers = invoice.encabezado;
    const body = Validator.groupFields(invoice.detalles);

    for (const field of headers) {
      if (field.type === Fields.FECHA_FACTURA) {
        if (DateTime.fromFormat(field?.text || '', 'dd/MM/yyyy').isValid) {
          field.confidence = 1;
        }
        // el año actual
        // fecha obsoleta si es de hace más de 3 meses
      }
      if (field.type === Fields.NUMERO_FACTURA) {
        if (Validator.isNumeric(field?.text?.slice(-5))) {
          field.confidence = 1;
          field.text = field?.text?.slice(-5);
        }
      }
      if (field.type === Fields.RAZON_SOCIAL) {
        if (RAZON_SOCIAL[field.text as any]) {
          field.text = RAZON_SOCIAL[field.text as any];
          field.confidence = 1;
        }
      }
    }

    for (const product of body) {
      const descriptionField = product.find(
        (field) => field.type == Fields.ITEM_DESCRIPCION_PRODUCTO,
      );
      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        const valorField = product.find(
          (field) => field.type === Fields.VALOR_VENTA_ITEM,
        );
        if (valorField)
          valorField.text = String(Validator.toNumber(valorField) * -1);
        continue;
      }
      const razonSocialField = headers.find(
        (field) => field.type === Fields.RAZON_SOCIAL,
      );
      const productDB = await this.meikoService.findByDescription(
        razonSocialField?.text || '',
        descriptionField?.text || '',
      );

      for (const field of product) {
        if (field.type === Fields.CODIGO_PRODUCTO) {
          const result = await this.meikoService.find({
            where: { productCode: field.text },
            select: { productCode: true },
          });
          if (result?.productCode === field.text) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.ITEM_DESCRIPCION_PRODUCTO) {
          if (productDB?.description === field.text?.toUpperCase()) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.TIPO_EMBALAJE) {
          const embalaje = (field.text || '').trim().toUpperCase();
          if (EMBALAJES.includes(embalaje)) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.VALOR_UNITARIO_ITEM) {
          if (productDB?.saleValue === field.text) {
            field.confidence = 1;
          }
        }

        if (field.type === Fields.VALOR_IBUA_Y_OTROS) {
          if (productDB?.valueIbuaAndOthers === field.text) {
            field.confidence = 1;
          }
        }
      }

      const unidadesEmbalaje = product.find(
        (field) => field.type == Fields.UNIDADES_EMBALAJE,
      );
      const unidadesVendidas = product.find(
        (field) => field.type == Fields.UNIDADES_VENDIDAS,
      );
      const valorUnitario = product.find(
        (field) => field.type == Fields.VALOR_UNITARIO_ITEM,
      );
      const valorIbuaOtros = product.find(
        (field) => field.type == Fields.VALOR_IBUA_Y_OTROS,
      );
      const valorVentaItem = product.find(
        (field) => field.type == Fields.VALOR_VENTA_ITEM,
      );

      const unidadesItem =
        Validator.toNumber(unidadesEmbalaje) /
        Validator.toNumber(unidadesVendidas);
      const valorItem = Validator.toNumber(valorUnitario) / unidadesItem;
      const valorVentaCalculado =
        valorItem - Validator.toNumber(valorIbuaOtros);

      if (valorVentaCalculado === Validator.toNumber(valorVentaItem)) {
        if (
          unidadesEmbalaje &&
          unidadesVendidas &&
          valorUnitario &&
          valorIbuaOtros &&
          valorVentaItem
        ) {
          unidadesEmbalaje.confidence = 1;
          unidadesVendidas.confidence = 1;
          valorUnitario.confidence = 1;
          valorIbuaOtros.confidence = 1;
          valorVentaItem.confidence = 1;
        }
      }
    }
    const calculatedTotal = body.reduce((acc, next) => {
      return (
        acc +
        Number(
          next.find((field) => field.type === Fields.VALOR_VENTA_ITEM)?.text,
        ) +
        Number(
          next.find((field) => field.type === Fields.VALOR_IBUA_Y_OTROS)?.text,
        )
      );
    }, 0);
    const valorTotalFactura = headers.find(
      (field) => field.type === Fields.VALOR_TOTAL_FACTURA,
    );
    if (calculatedTotal === Validator.toNumber(valorTotalFactura)) {
      if (valorTotalFactura) valorTotalFactura.confidence = 1;
    }

    // return Validator.convertToCampoDto(invoice)
    const filteredInvoice = this.removeFields(invoice, [
      Fields.VALOR_UNITARIO_ITEM,
    ]);
    return this.guessConfidence(filteredInvoice);
  }

  removeFields(invoice: ValidateInvoice, fields: Fields[]) {
    return {
      ...invoice,
      detalles: invoice.detalles.filter(
        (field) => !fields.some((item) => item === field.type),
      ),
    };
  }
  guessConfidence(invoice: ValidateInvoice) {
    const headers = invoice.encabezado;
    const body = Validator.groupFields(invoice.detalles);
    for (const field of headers) {
      if (field.confidence >= 0.95) {
        field.confidence = 1;
      }
    }

    for (const product of body) {
      for (const field of product) {
        if (field.confidence >= 0.95) {
          field.confidence = 1;
        }
      }
    }
    return invoice;
  }

  async PostobonValidator(invoice: ValidateInvoice) {
    const headers = invoice.encabezado;
    const body = Validator.groupFields(invoice.detalles);
    const errors: string[] = [];

    // Validar encabezados
    for (const field of headers) {
      if (field.type === Fields.FECHA_FACTURA) {
        if (DateTime.fromFormat(field?.text || '', 'dd/MM/yyyy').isValid) {
          field.confidence = 1;
        }
      }
      if (field.type === Fields.NUMERO_FACTURA) {
        if (Validator.isNumeric(field?.text?.slice(-5))) {
          field.confidence = 1;
          field.text = field?.text?.slice(-5);
        }
      }
      if (field.type === Fields.RAZON_SOCIAL) {
        if (RAZON_SOCIAL[field.text as any]) {
          field.text = RAZON_SOCIAL[field.text as any];
          field.confidence = 1;
        }
      }
    }

    // Validar productos
    for (let rowIndex = 0; rowIndex < body.length; rowIndex++) {
      const product = body[rowIndex];
      const rowNumber = rowIndex + 1;

      // Validar descripción de producto
      await this.validarDescripcionProductoPostobon(product, rowNumber, errors);

      // Validar si es "reduccion" (skip otras validaciones)
      const descriptionField = product.find(
        (field) => field.type === Fields.ITEM_DESCRIPCION_PRODUCTO,
      );
      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        continue;
      }

      // Buscar producto en base de datos
      const razonSocialField = headers.find(
        (field) => field.type === Fields.RAZON_SOCIAL,
      );
      const productDB = await this.meikoService.findByDescription(
        razonSocialField?.text || '',
        descriptionField?.text || '',
      );

      // Validar campos individuales contra la BD
      for (const field of product) {
        if (field.type === Fields.CODIGO_PRODUCTO) {
          const result = await this.meikoService.find({
            where: { productCode: field.text },
            select: { productCode: true },
          });
          if (result?.productCode === field.text) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.ITEM_DESCRIPCION_PRODUCTO) {
          if (productDB?.description === field.text?.toUpperCase()) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.TIPO_EMBALAJE) {
          this.validarEmbalajePostobon(product, rowNumber, errors, field);
          if (productDB?.packagingType === field.text) {
            field.confidence = 1;
          }
        }

        if (field.type === Fields.UNIDADES_EMBALAJE) {
          if (productDB?.packagingUnit?.toNumber() === Number(field.text)) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.PACKS_VENDIDOS) {
          if (productDB?.packsSold?.toNumber() === Number(field.text)) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.VALOR_VENTA_ITEM) {
          if (productDB?.saleValue?.toNumber() === Number(field.text)) {
            field.confidence = 1;
          }
        }
      }

      // Validar unidades vendidas y cálculos
      this.validarUnidadesVendidasPostobon(product, rowNumber, errors);
    }

    // Validar total factura sin IVA
    this.validarTotalFacturaSinIvaPostobon(headers, body, errors);

    // Agregar campo ES_DEVOLUCION si no existe
    this.adicionarCampoDevolucionPostobon(invoice, body);

    const filteredInvoice = this.removeFields(invoice, [
      Fields.APLICA_IVA_ITEM,
      Fields.VALOR_UNITARIO_ITEM,
      Fields.VALOR_DESCUENTO_ITEM,
    ]);

    return Validator.convertToCampoDto(this.guessConfidence(filteredInvoice));
    return;

    return invoice;
  }

  private cleanProductDescription(value: string): string {
    if (!value) return '';
    // Elimina prefijo "número + punto/guion + letra opcional"
    const regex = /^\s*\d+(\s*[\.\-])?(\s*[a-zA-Z])?[\.-]?\s*\(?/;
    return value.replace(regex, '').trim();
  }

  private async validarDescripcionProductoPostobon(
    product: InvoiceEntry[],
    rowNumber: number,
    errors: string[],
  ) {
    const descField = product.find(
      (f) => f.type === Fields.ITEM_DESCRIPCION_PRODUCTO,
    );
    if (!descField) return;

    const originalValue = descField.text || '';
    const cleanedValue = this.cleanProductDescription(originalValue);

    if (cleanedValue.toLowerCase() === 'reduccion') return;

    const confidence = descField.confidence || 0;

    // Validar contra catálogos (simulado - en producción usar servicios reales)
    // TODO: Implementar búsquedas en catálogos cuando el servicio esté disponible
  }

  private validarEmbalajePostobon(
    product: InvoiceEntry[],
    rowNumber: number,
    errors: string[],
    embalajeField: InvoiceEntry,
  ) {
    const embalaje = (embalajeField.text || '').trim().toUpperCase();

    if (EMBALAJES.includes(embalaje)) {
      embalajeField.confidence = 1;

      // Regla específica de Postobon: si es CAJA, el valor viene por packs_vendidos
      if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
        const unidadesVendidasField = product.find(
          (f) => f.type === Fields.UNIDADES_VENDIDAS,
        );
        const packsVendidosField = product.find(
          (f) => f.type === Fields.PACKS_VENDIDOS,
        );

        if (unidadesVendidasField) {
          unidadesVendidasField.text = undefined;
          unidadesVendidasField.confidence = 1;
        }
        if (packsVendidosField) {
          packsVendidosField.confidence = 1;
        }
      } else {
        // Si NO es caja, el valor viene por unidades_vendidas
        const packsVendidosField = product.find(
          (f) => f.type === Fields.PACKS_VENDIDOS,
        );
        const unidadesVendidasField = product.find(
          (f) => f.type === Fields.UNIDADES_VENDIDAS,
        );

        if (packsVendidosField) {
          packsVendidosField.text = undefined;
          packsVendidosField.confidence = 1;
        }
        if (unidadesVendidasField) {
          unidadesVendidasField.confidence = 1;
        }
      }
    } else {
      errors.push(
        `Fila ${rowNumber}: TIPO_EMBALAJE inválido: ${embalajeField.text}`,
      );
    }
  }

  private validarUnidadesVendidasPostobon(
    product: InvoiceEntry[],
    rowNumber: number,
    errors: string[],
  ) {
    try {
      const packsVendidos = product.find(
        (f) => f.type === Fields.PACKS_VENDIDOS,
      );
      const unidadesVendidas = product.find(
        (f) => f.type === Fields.UNIDADES_VENDIDAS,
      );
      const valorUnitario = product.find(
        (f) => f.type === Fields.VALOR_UNITARIO_ITEM,
      );
      const valorVentaItem = product.find(
        (f) => f.type === Fields.VALOR_VENTA_ITEM,
      );
      const aplicaIvaItem = product.find(
        (f) => f.type === Fields.APLICA_IVA_ITEM,
      );
      const valorDescuentoItem = product.find(
        (f) => f.type === Fields.VALOR_DESCUENTO_ITEM,
      );
      const tipoEmbalaje = product.find((f) => f.type === Fields.TIPO_EMBALAJE);

      const packsVendidosDbl = Validator.toNumber(packsVendidos) || 0;
      const unidadesVendidasDbl = Validator.toNumber(unidadesVendidas) || 0;
      const valorUnitarioDbl = Validator.toNumber(valorUnitario) || 0;
      const valorVentaItemDbl = Validator.toNumber(valorVentaItem) || 0;
      const aplicaIvaItemDbl = Validator.toNumber(aplicaIvaItem) || 0;
      const valorDescuentoItemDbl = Validator.toNumber(valorDescuentoItem) || 0;

      const embalaje = (tipoEmbalaje?.text || '').toUpperCase();

      // Determinar cantidad según tipo de embalaje
      let cantidadUnidades = 0;
      if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
        cantidadUnidades = packsVendidosDbl;
      } else {
        cantidadUnidades = unidadesVendidasDbl;
      }

      // Cálculos
      const valorBaseCalculado = cantidadUnidades * valorUnitarioDbl;
      const valorProductoCalculado = valorBaseCalculado - valorDescuentoItemDbl;
      const valorIva = valorProductoCalculado * (aplicaIvaItemDbl / 100);
      const valorVentaCalculado = valorProductoCalculado + valorIva;

      const diferencia = Math.abs(valorVentaItemDbl - valorVentaCalculado);

      if (diferencia >= 0.0 && diferencia <= 1.0) {
        if (packsVendidos) packsVendidos.confidence = 1;
        if (unidadesVendidas) unidadesVendidas.confidence = 1;
        if (valorUnitario) valorUnitario.confidence = 1;
        if (valorVentaItem) valorVentaItem.confidence = 1;
        if (tipoEmbalaje) tipoEmbalaje.confidence = 1;
        if (valorDescuentoItem) valorDescuentoItem.confidence = 1;
        if (aplicaIvaItem) aplicaIvaItem.confidence = 1;
      }
    } catch (error) {
      errors.push(`Fila ${rowNumber}: ${error.message}`);
    }
  }

  private validarTotalFacturaSinIvaPostobon(
    headers: InvoiceEntry[],
    body: InvoiceEntry[][],
    errors: string[],
  ) {
    try {
      const totalFacturaSinIvaField = headers.find(
        (f) => f.type === Fields.TOTAL_FACTURA_SIN_IVA,
      );
      if (!totalFacturaSinIvaField) return;

      const totalFacturaSinIva =
        Validator.toNumber(totalFacturaSinIvaField) || 0;
      let acumulado = 0.0;

      for (let rowIndex = 0; rowIndex < body.length; rowIndex++) {
        const product = body[rowIndex];
        const valorBase = this.calcularValorBaseProductoPostobon(product);
        if (valorBase !== null) {
          acumulado += valorBase;
        }
      }

      const diferencia = Math.abs(totalFacturaSinIva - acumulado);

      if (diferencia >= 0.0 && diferencia <= 1.0) {
        totalFacturaSinIvaField.confidence = 1;
      }
    } catch (error) {
      errors.push(`Error validando total factura sin IVA: ${error.message}`);
    }
  }

  private calcularValorBaseProductoPostobon(
    product: InvoiceEntry[],
  ): number | null {
    try {
      const packsVendidos = product.find(
        (f) => f.type === Fields.PACKS_VENDIDOS,
      );
      const unidadesVendidas = product.find(
        (f) => f.type === Fields.UNIDADES_VENDIDAS,
      );
      const valorUnitario = product.find(
        (f) => f.type === Fields.VALOR_UNITARIO_ITEM,
      );
      const tipoEmbalaje = product.find((f) => f.type === Fields.TIPO_EMBALAJE);

      const packsVendidosDbl = Validator.toNumber(packsVendidos) || 0;
      const unidadesVendidasDbl = Validator.toNumber(unidadesVendidas) || 0;
      const valorUnitarioDbl = Validator.toNumber(valorUnitario) || 0;
      const embalaje = (tipoEmbalaje?.text || '').toUpperCase();

      let cantidadUnidades = 0;
      if (EMBALAJES_POSTOBON_CAJA.includes(embalaje)) {
        cantidadUnidades = packsVendidosDbl;
      } else {
        cantidadUnidades = unidadesVendidasDbl;
      }

      return cantidadUnidades * valorUnitarioDbl;
    } catch (error) {
      return null;
    }
  }

  private adicionarCampoDevolucionPostobon(
    invoice: ValidateInvoice,
    body: InvoiceEntry[][],
  ) {
    for (let rowIndex = 0; rowIndex < body.length; rowIndex++) {
      const product = body[rowIndex];
      if (!product || product.length === 0) continue;

      const rowNumber = product[0].row;

      // Verificar si ya existe ES_DEVOLUCION
      const exists = product.some((f) => f.type === Fields.ES_DEVOLUCION);
      if (exists) continue;

      // Crear nuevo campo ES_DEVOLUCION
      const newField: InvoiceEntry = {
        type: Fields.ES_DEVOLUCION,
        text: '0',
        confidence: 1,
        row: rowNumber,
      };

      // Agregar a la fila
      product.push(newField);

      // Agregar también a invoice.detalles
      invoice.detalles.push(newField);
    }
  }

  async InfocargueValidator(invoice: ValidateInvoice) {
    const headers = invoice.encabezado;
    const body = Validator.groupFields(invoice.detalles);
    const errors: string[] = [];

    // Validaciones compartidas de encabezado (igual que Coke y Postobon)
    for (const field of headers) {
      if (field.type === Fields.FECHA_FACTURA) {
        if (DateTime.fromFormat(field?.text || '', 'dd/MM/yyyy').isValid) {
          field.confidence = 1;
        }
      }
      if (field.type === Fields.NUMERO_FACTURA) {
        if (Validator.isNumeric(field?.text?.slice(-5))) {
          field.confidence = 1;
          field.text = field?.text?.slice(-5);
        }
      }
      if (field.type === Fields.RAZON_SOCIAL) {
        if (RAZON_SOCIAL[field.text as any]) {
          field.text = RAZON_SOCIAL[field.text as any];
          field.confidence = 1;
        }
      }
    }

    // Validar productos
    for (let rowIndex = 0; rowIndex < body.length; rowIndex++) {
      const product = body[rowIndex];
      const rowNumber = rowIndex + 1;

      const descriptionField = product.find(
        (field) => field.type === Fields.ITEM_DESCRIPCION_PRODUCTO,
      );

      // Manejo especial de REDUCCION
      if (descriptionField?.text?.toUpperCase() === 'REDUCCION') {
        product.forEach((field) => (field.confidence = 1));
        const valorField = product.find(
          (field) => field.type === Fields.VALOR_VENTA_ITEM,
        );
        if (valorField)
          valorField.text = String(Validator.toNumber(valorField) * -1);
        continue;
      }

      // Buscar producto en base de datos
      const razonSocialField = headers.find(
        (field) => field.type === Fields.RAZON_SOCIAL,
      );
      const productDB = await this.meikoService.findByDescription(
        razonSocialField?.text || '',
        descriptionField?.text || '',
      );

      // Validar campos individuales contra la BD
      for (const field of product) {
        if (field.type === Fields.CODIGO_PRODUCTO) {
          const result = await this.meikoService.find({
            where: { productCode: field.text },
            select: { productCode: true },
          });
          if (result?.productCode === field.text) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.ITEM_DESCRIPCION_PRODUCTO) {
          if (productDB?.description === field.text?.toUpperCase()) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.TIPO_EMBALAJE) {
          const embalaje = (field.text || '').trim().toUpperCase();
          if (EMBALAJES.includes(embalaje)) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.VALOR_UNITARIO_ITEM) {
          if (productDB?.saleValue === field.text) {
            field.confidence = 1;
          }
        }
        if (field.type === Fields.VALOR_IBUA_Y_OTROS) {
          if (productDB?.valueIbuaAndOthers === field.text) {
            field.confidence = 1;
          }
        }
      }

      // Validación personalizada de UNIDADES_EMBALAJE
      this.validarUnidadesEmbalajeInfocargue(product, rowNumber, errors);
    }

    const filteredInvoice = this.removeFields(invoice, [
      Fields.VALOR_UNITARIO_ITEM,
    ]);
    return this.guessConfidence(filteredInvoice);
  }

  private validarUnidadesEmbalajeInfocargue(
    product: InvoiceEntry[],
    rowNumber: number,
    errors: string[],
  ) {
    const unidadesEmbalajeField = product.find(
      (f) => f.type === Fields.UNIDADES_EMBALAJE,
    );
    const descriptionField = product.find(
      (f) => f.type === Fields.ITEM_DESCRIPCION_PRODUCTO,
    );

    if (!unidadesEmbalajeField || !descriptionField) return;

    const valor = unidadesEmbalajeField.text || '';
    const confianza = unidadesEmbalajeField.confidence || 0;
    const descripcion = descriptionField.text || '';

    // Pattern para encontrar "x<número>" o "X<número>"
    const pattern = /[xX]\s*(\d+)/;
    const match = descripcion.match(pattern);

    if ((!valor || valor.trim() === '') && confianza === 0) {
      // Caso 1: está vacío → inferimos o validamos
      if (match) {
        const numero = match[1];
        unidadesEmbalajeField.text = numero;
        unidadesEmbalajeField.confidence = 1;
        console.log(
          `🔎 Fila ${rowNumber}: Se infirió UNIDADES_EMBALAJE=${numero} desde descripción='${descripcion}'`,
        );
      } else {
        unidadesEmbalajeField.confidence = 1;
        console.log(
          `✅ Fila ${rowNumber}: UNIDADES_EMBALAJE vacío, sin patrón 'xN'. Confianza=100`,
        );
      }
    } else if (match) {
      // Caso 2: ya hay valor → comparamos
      try {
        const valorExistente = parseInt(valor.trim(), 10);
        const numeroDescripcion = parseInt(match[1], 10);

        if (valorExistente === numeroDescripcion) {
          unidadesEmbalajeField.confidence = 1;
          console.log(
            `✅ Fila ${rowNumber}: UNIDADES_EMBALAJE=${valorExistente} coincide con descripción (x${numeroDescripcion}). Confianza=100`,
          );
        } else {
          console.log(
            `⚠️ Fila ${rowNumber}: UNIDADES_EMBALAJE=${valorExistente} difiere de descripción (x${numeroDescripcion}). No se modifica.`,
          );
        }
      } catch (e) {
        console.warn(
          `⚠️ Fila ${rowNumber}: Valor UNIDADES_EMBALAJE='${valor}' no es numérico. Se ignora comparación.`,
        );
      }
    }
  }

  /**
   * Test endpoint: consulta una factura por ID, valida con el OCR y compara con el resultado esperado
   */
  async testInvoice(facturaId: number) {
    const invoice = await this.tapService.extractionInvoiceMaya.findUnique({
      where: { invoiceId: facturaId },
    });

    if (!invoice) {
      throw new NotFoundException(`Factura con ID ${facturaId} no encontrada`);
    }

    if (!invoice.mayaInvoiceJson) {
      throw new NotFoundException(
        `Factura ${facturaId} no tiene respuesta OCR (mayaInvoiceJson)`,
      );
    }

    // Parsear la respuesta OCR
    const ocrData = JSON.parse(invoice.mayaInvoiceJson);

    // Validar usando el DocumentFactory

    
    const document = DocumentFactory.create(
      invoice.photoTypeOcr || '',
      ocrData,
      this
    )

    await document.process();

    const { data, errors, isValid } = document.get();

    // Convertir resultado al formato CampoDto para comparación
    const resultCampos = Validator.convertToCampoDto(data);

    // Parsear el resultado esperado si existe
    let expected = null;
    if (invoice.tapInvoiceJson) {
      expected = JSON.parse(invoice.tapInvoiceJson);
    }

    // Comparar resultados (ambos en formato { campos: CampoDto[] })
    const comparison = this.compareResults({ campos: resultCampos }, expected);

    return {
      facturaId,
      photoType: invoice.photoTypeOcr,
      isValid,
      errors,
      result: { campos: resultCampos },
      expected,
      comparison,
    };
  }

  /**
   * Compara el resultado obtenido con el esperado
   * Ambos tienen formato { campos: CampoDto[] } donde CampoDto es:
   * { nombre, pagina, registro, fila, confianza, x, y, ancho, altura, imagen, valor_atomizacion, es_blanco, valor_cierre }
   */
  private compareResults(result: any, expected: any) {
    if (!expected) {
      return { hasExpected: false, matches: null, differences: null };
    }

    const differences: any[] = [];
    const resultCampos = result?.campos || [];
    const expectedCampos = expected?.campos || [];

    // Comparar cada campo del resultado con el esperado
    for (const field of resultCampos) {
      // Buscar el campo esperado por nombre, registro y fila
      const expectedField = expectedCampos.find(
        (e: any) =>
          e.nombre === field.nombre &&
          e.registro === field.registro &&
          e.fila === field.fila,
      );

      if (expectedField) {
        // Comparar valor_cierre y confianza
        const valorResultado = field.valor_cierre;
        const valorEsperado = expectedField.valor_cierre;
        const confianzaResultado = field.confianza;
        const confianzaEsperada = expectedField.confianza;

        if (valorResultado !== valorEsperado || confianzaResultado !== confianzaEsperada) {
          differences.push({
            nombre: field.nombre,
            registro: field.registro,
            fila: field.fila,
            result: {
              valor_cierre: valorResultado,
              confianza: confianzaResultado,
            },
            expected: {
              valor_cierre: valorEsperado,
              confianza: confianzaEsperada,
            },
          });
        }
      } else {
        // Campo en resultado que no existe en esperado
        differences.push({
          nombre: field.nombre,
          registro: field.registro,
          fila: field.fila,
          result: {
            valor_cierre: field.valor_cierre,
            confianza: field.confianza,
          },
          expected: null,
          issue: 'missing_in_expected',
        });
      }
    }

    // Buscar campos que están en expected pero no en result
    for (const expectedField of expectedCampos) {
      const existsInResult = resultCampos.some(
        (r: any) =>
          r.nombre === expectedField.nombre &&
          r.registro === expectedField.registro &&
          r.fila === expectedField.fila,
      );

      if (!existsInResult) {
        differences.push({
          nombre: expectedField.nombre,
          registro: expectedField.registro,
          fila: expectedField.fila,
          result: null,
          expected: {
            valor_cierre: expectedField.valor_cierre,
            confianza: expectedField.confianza,
          },
          issue: 'missing_in_result',
        });
      }
    }

    return {
      hasExpected: true,
      matches: differences.length === 0,
      totalDifferences: differences.length,
      differences,
    };
  }
}
