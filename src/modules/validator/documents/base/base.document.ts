import { DateTime } from 'luxon';
import { EMBALAJES } from '../../utils/validator.utils';
import { RAZON_SOCIAL } from '../../enums/fields';
import {
  BaseField,
  BaseInvoiceSchema,
  HeaderFieldConfig,
  BodyFieldConfig,
} from './base.schema';

/**
 * Clase base abstracta para documentos de factura.
 * Proporciona métodos comunes de normalización, validación e inferencia.
 */
export abstract class BaseDocument<
  TSchema extends BaseInvoiceSchema<THeader, TBody>,
  THeader extends string = string,
  TBody extends string = string,
> {
  protected errors: Record<string, string> = {};
  protected isValid = true;

  constructor(protected data: TSchema) {
    this.normalize();
    this.validate();
    this.infer();
  }

  // ============ MÉTODOS ABSTRACTOS ============

  /**
   * Normaliza los datos de la factura (ej: convertir valores negativos)
   */
  abstract normalize(): this;

  /**
   * Valida los datos de la factura
   */
  abstract validate(): void;

  /**
   * Realiza inferencias específicas del tipo de factura
   */
  abstract infer(): this;

  /**
   * Configuración de campos del encabezado para esta factura
   */
  protected abstract getHeaderFieldConfig(): HeaderFieldConfig<THeader>;

  /**
   * Configuración de campos del body para esta factura
   */
  protected abstract getBodyFieldConfig(): BodyFieldConfig<TBody>;

  // ============ GETTER ============

  get() {
    return { data: this.data, errors: this.errors, isValid: this.isValid };
  }

  // ============ MÉTODOS DE INFERENCIA COMUNES ============

  /**
   * Infiere confianza para todos los campos del encabezado
   */
  protected inferHeaders(): void {
    const config = this.getHeaderFieldConfig();

    for (const field of this.data.encabezado) {
      if (config.fechaFactura && field.type === config.fechaFactura) {
        // Intentar reparar la fecha antes de inferir
        this.repairFechaFactura(field);
        this.inferFechaFactura(field);
      }
      if (config.numeroFactura && field.type === config.numeroFactura) {
        this.inferNumeroFactura(field);
      }
      if (config.razonSocial && field.type === config.razonSocial) {
        this.inferRazonSocial(field);
      }
    }
  }

  /**
   * Infiere confianza de fecha si tiene formato válido dd/MM/yyyy
   */
  protected inferFechaFactura(field: BaseField<THeader>): void {
    if (DateTime.fromFormat(field?.text || '', 'dd/MM/yyyy').isValid) {
      field.confidence = 1;
    }
  }

  /**
   * Intenta reparar el año de una fecha con errores de OCR
   * Ej: '2825-18-24' -> '24/11/2025' (asume año actual o cercano)
   */
  protected repairFechaFactura(field: BaseField<THeader>): void {
    if (!field?.text) return;

    // Si ya es válida, no hacer nada
    if (DateTime.fromFormat(field.text, 'dd/MM/yyyy').isValid) {
      return;
    }

    const currentYear = DateTime.now().year;
    const text = field.text;

    // Intentar parsear con diferentes formatos
    // Formato: dd/MM/yyyy o dd-MM-yyyy
    const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const repairedYear = this.repairYear(year, currentYear);
      const repairedDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${repairedYear}`;

      if (DateTime.fromFormat(repairedDate, 'dd/MM/yyyy').isValid) {
        field.text = repairedDate;
        return;
      }
    }

    // Formato invertido: yyyy-MM-dd o yyyy/MM/dd
    const matchInverted = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (matchInverted) {
      const [, year, month, day] = matchInverted;
      const repairedYear = this.repairYear(year, currentYear);
      const repairedDate = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${repairedYear}`;

      if (DateTime.fromFormat(repairedDate, 'dd/MM/yyyy').isValid) {
        field.text = repairedDate;
        return;
      }
    }
  }

  /**
   * Repara un año con posibles errores de OCR
   * Ej: 2825 -> 2025, 2924 -> 2024
   */
  private repairYear(yearStr: string, currentYear: number): string {
    const year = parseInt(yearStr, 10);

    // Si el año es válido (entre currentYear-5 y currentYear+1), no reparar
    if (year >= currentYear - 5 && year <= currentYear + 1) {
      return yearStr;
    }

    // Intentar reparar dígitos confundidos por OCR
    // 2825 -> 2025 (8 confundido con 0)
    // 2924 -> 2024 (9 confundido con 0)
    const yearDigits = yearStr.split('');

    // Mapeo de dígitos que suelen confundirse
    const ocrConfusions: Record<string, string[]> = {
      '8': ['0', '6', '9'],
      '9': ['0', '4'],
      '6': ['0', '8'],
      '5': ['6', '8'],
      '1': ['7', '4'],
      '7': ['1', '4'],
      '4': ['1', '9'],
      '3': ['8', '5'],
    };

    // Intentar corregir cada dígito
    for (let i = 0; i < yearDigits.length; i++) {
      const digit = yearDigits[i];
      const alternatives = ocrConfusions[digit] || [];

      for (const alt of alternatives) {
        const testYear = [...yearDigits];
        testYear[i] = alt;
        const testYearNum = parseInt(testYear.join(''), 10);

        if (testYearNum >= currentYear - 5 && testYearNum <= currentYear + 1) {
          return testYear.join('');
        }
      }
    }

    // Si no se pudo reparar, devolver el año actual
    return currentYear.toString();
  }

  /**
   * Infiere confianza de número de factura si los últimos 5 caracteres son numéricos
   */
  protected inferNumeroFactura(field: BaseField<THeader>): void {
    const lastFive = field?.text?.slice(-5);
    if (this.isNumeric(lastFive)) {
      field.confidence = 1;
      field.text = lastFive;
    }
  }

  /**
   * Infiere confianza de razón social si está en el catálogo conocido
   */
  protected inferRazonSocial(field: BaseField<THeader>): void {
    const normalizedValue =
      RAZON_SOCIAL[field.text as keyof typeof RAZON_SOCIAL];
    if (normalizedValue) {
      field.text = normalizedValue;
      field.confidence = 1;
    }
  }

  /**
   * Infiere confianza del tipo de embalaje si está en el catálogo
   */
  protected inferTipoEmbalaje(field: BaseField<TBody>): void {
    if (!field?.text) return;

    const embalajeNormalizado = field.text.trim().toUpperCase();
    if (EMBALAJES.includes(embalajeNormalizado)) {
      field.confidence = 1;
    }
  }

  /**
   * Redondea confianza >= 0.95 a 1 para todos los campos
   */
  protected guessConfidence(): void {
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

  // ============ MÉTODOS DE VALIDACIÓN COMUNES ============

  /**
   * Valida que la fecha no sea obsoleta (más de n meses)
   */
  protected validateFechaObsoleta(months: number): boolean {
    const config = this.getHeaderFieldConfig();
    if (!config.fechaFactura) return true;

    const fechaField = this.data.encabezado.find(
      (f) => f.type === config.fechaFactura,
    );
    if (!fechaField?.text) return true;

    const parsedDate = DateTime.fromFormat(fechaField.text, 'dd/MM/yyyy');
    if (!parsedDate.isValid) {
      this.errors.fecha_factura = 'Fecha inválida (formato)';
      this.isValid = false;
      return false;
    }

    const now = DateTime.now();
    const targetDate = parsedDate.plus({ months });

    if (now >= targetDate) {
      return true;
    }

    this.errors.fecha_factura = 'Fecha obsoleta';
    this.isValid = false;
    return false;
  }

  // ============ UTILIDADES ============

  /**
   * Agrupa los campos de detalle por fila
   */
  protected groupFields(): BaseField<TBody>[][] {
    const rows = this.data.detalles;
    if (rows.some((r) => typeof r.row !== 'number' || r.row! < 1)) {
      return [];
    }

    const output: BaseField<TBody>[][] = [];

    for (const row of rows) {
      if (!row.row) continue;
      const index = row.row - 1;

      if (!output[index]) {
        output[index] = [row];
      } else {
        output[index].push(row);
      }
    }

    return output;
  }

  /**
   * Obtiene un mapa de campos por tipo
   */
  protected getFieldsMap<T extends string>(
    fields: BaseField<T>[],
  ): Record<T, BaseField<T>> {
    const output = {} as Record<T, BaseField<T>>;
    for (const field of fields) {
      output[field.type] = field;
    }
    return output;
  }

  /**
   * Obtiene el mapa de campos del encabezado
   */
  protected getHeaderFields(): Record<THeader, BaseField<THeader>> {
    return this.getFieldsMap(this.data.encabezado);
  }

  /**
   * Verifica si un string es numérico
   */
  protected isNumeric(value: string | undefined): boolean {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  /**
   * Convierte un campo a número
   */
  protected toNumber(
    field: BaseField<THeader> | BaseField<TBody> | undefined,
  ): number {
    return Number(field?.text || 0);
  }
}
