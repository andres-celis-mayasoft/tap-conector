import { DateTime } from 'luxon';
import {
  isNullOrIllegible,
  NULL_FLOAT,
  OCR_Field as OCR_Field,
} from './common';

type InferResult = {
  date1: DateTime;
  date2: DateTime;
};

export class Utils {
  static getFields<T extends string | number | symbol>(
    fields: { type: T; text: string; confidence: number; row: number }[],
  ) {
    const output: Record<T, OCR_Field<T>> = {} as Record<T, OCR_Field<T>>;

    for (const field of fields) {
      output[field.type] = field;
    }

    return output;
  }

  static parsePackConUnidades(value: string | null | undefined) {
    if (!value || !value.includes('/') || isNullOrIllegible(value)) {
      return {
        packsSold: NULL_FLOAT,
        unitsSold: NULL_FLOAT,
      };
    }

    const [packs, units] = value.split('/');

    const packsParsed = isNaN(parseFloat(packs))
      ? NULL_FLOAT
      : parseFloat(packs);
    const unitsParsed = isNaN(parseFloat(units))
      ? NULL_FLOAT
      : parseFloat(units);

    return {
      packsSold: packsParsed,
      unitsSold: unitsParsed,
    };
  }

  static groupFields(rows: any[]): any[][] {
    if (rows.some((r) => typeof r.row !== 'number' || r.row < 1)) {
      return [];
    }

    const output: any[][] = [];

    for (const row of rows) {
      if (!row.row) throw Error('Invalid row');
      const index = row.row - 1;

      if (!output[index]) {
        output[index] = [row];
      } else {
        output[index].push(row);
      }
    }

    return output.filter((r) => r);
  }

  static guessConfidence(fields, thresholds: Record<string, number>) {
    for (const field of fields) {
      if (!field.error && field.confidence < thresholds[field.type]) {
        field.error = 'Confianza insuficiente';
      }
      if (!field.error && field.confidence >= thresholds[field.type]) {
        field.confidence = 1;
      }
    }
  }

  static removeFields(rows: any[], types: string[]): any[] {
    return rows.filter((field) => !types.includes(field.type));
  }

  static fixNumberString(value: string): string {
    return value.replace(',', '.');
  }

  static isValidDate(date: string) {
    const parsedDate = DateTime.fromFormat(date, 'dd/MM/yyyy');
    if (!parsedDate.isValid) {
      return false;
    }
    return true;
  }

  static swapDayMonth(dt: DateTime): DateTime {
    return DateTime.fromObject({
      year: dt.year,
      month: dt.day,
      day: dt.month,
    });
  }

  static inferDate(fechaFactura: string, fechaVencimiento: string): InferResult {

    const partsFechaFactura = fechaFactura.split('/');
    const first = partsFechaFactura[0];
    const second = partsFechaFactura[1];
    
    const partsVencimiento = fechaFactura.split('/');
    
    if(Number(first) > 12 && Number(second) <=12){
      // no hacer nada porque ya viene en el formato esperado
    }
    if(Number(second) > 12 && Number(first) <=12){
      // hacer swap porque viene en formato MM/dd/yyyy
      fechaFactura = `${second}/${first}/${partsFechaFactura[2]}`;
      fechaVencimiento = `${partsVencimiento[1]}/${partsVencimiento[0]}/${partsVencimiento[2]}`;
    }

    let d1 = DateTime.fromFormat(fechaFactura, 'dd/MM/yyyy');
    const d2 = DateTime.fromFormat(fechaVencimiento, 'dd/MM/yyyy');


    const sameDay = d1.day === d2.day;
    const sameMonth = d1.month === d2.month;

    // Si coinciden en el día → ese valor es realmente el mes
    if (sameDay && !sameMonth) {
      d1 = this.swapDayMonth(d1);
    }

    // Si coinciden en el mes → ese valor es realmente el día
    if (sameMonth && !sameDay) {
      // d1 = this.swapDayMonth(d1);
    }

    return {
      date1: d1,
      date2: d2,
    };
  }

  static parseFlexibleDate(dateStr: string): DateTime {
    // Primero intenta dd/MM/yyyy
    let dt = DateTime.fromFormat(dateStr, 'dd/MM/yyyy');

    if (dt.isValid) return dt;

    // Si falla, asume MM/dd/yyyy
    dt = DateTime.fromFormat(dateStr, 'MM/dd/yyyy');

    if (!dt.isValid) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    return dt;
  }

  static async asyncFilter<T>(arr, predicate) {
    const results = await Promise.all(arr.map(predicate));
    return arr.filter((_v, index) => results[index]);
  }

  static hasMonthsPassed(date: string): boolean {
    const parsedDate = DateTime.fromFormat(date, 'dd/MM/yyyy');
    //Si la fecha no es válida la asumimos la fecha como válida para no bloquear el proceso por este error
    if (!parsedDate.isValid) {
      return true;
    }

    const parsedMonth = parsedDate.month;
    const currentMonth = DateTime.now().month;

    if(currentMonth === 1 && parsedMonth === 12){
      return true;
    }
    
    let diff = Math.abs(currentMonth - parsedMonth);

    return diff < 2;
  }

  static isMonthValid(month: number): boolean {
    const currentMonth = DateTime.now().month;

    let diff = Math.abs(currentMonth - month);
    return diff < 2;
  }

  static addMissingFields(rows: any[], requiredFields: string[]): any[] {
    // Get all unique row numbers from the input
    const rowNumbers = [...new Set(rows.map((r) => r.row))];

    // For each row number, check if all required fields exist
    for (const rowNum of rowNumbers) {
      const fieldsInRow = rows.filter((r) => r.row === rowNum);
      const typesInRow = fieldsInRow.map((r) => r.type);

      for (const fieldType of requiredFields) {
        if (!typesInRow.includes(fieldType)) {
          rows.push({
            type: fieldType,
            text: '',
            confidence: 0,
            row: rowNum,
          });
        }
      }
    }

    return rows;
  }

  static parseAndFixNumber(
    rows: OCR_Field<string>[],
    fieldsToFix: string[],
  ): void {
    for (const row of rows) {
      if (!fieldsToFix.includes(row.type)) {
        continue;
      }

      const value = row.text;

      if (!value || value.trim() === '') {
        row.text = '';
        row.confidence = 0;
        continue;
      }

      const trimmed = value.trim();
      const directParse = Number(trimmed);

      if (!isNaN(directParse)) {
        row.text = trimmed;
        continue;
      }

      const fixed = this.fixMalformedNumber(trimmed);
      const fixedParse = Number(fixed);

      if (!isNaN(fixedParse)) {
        row.text = fixed;
        continue;
      }

      row.text = '';
      row.confidence = 0;
    }
  }

  /**
   * Corrige formatos numéricos mal formados:
   * - Si tiene punto Y coma: la coma es separador de miles → eliminar comas
   * - Si solo tiene coma:
   *   - 1-2 dígitos después: coma es decimal → cambiar por punto
   *   - 3+ dígitos después: coma es separador de miles → eliminar coma
   */
  static fixMalformedNumber(value: string): string {
    const hasComma = value.includes(',');
    const hasDot = value.includes('.');

    if (!hasComma) {
      return value;
    }

    if (hasComma && hasDot) {
      return value.replace(/,/g, '');
    }

    const commaMatch = value.match(/^-?[\d,]*,(\d+)$/);

    if (commaMatch) {
      const digitsAfterComma = commaMatch[1].length;

      // 1-2 dígitos después de la coma: es decimal (ej: "1,00", "1,5")
      if (digitsAfterComma <= 2) {
        return value.replace(',', '.');
      }

      // 3+ dígitos después de la coma: es separador de miles (ej: "35,000")
      return value.replace(/,/g, '');
    }

    // Si hay múltiples comas (ej: "1,000,000"), son separadores de miles
    if ((value.match(/,/g) || []).length > 1) {
      return value.replace(/,/g, '');
    }

    // Fallback: reemplazar coma por punto
    return value.replace(',', '.');
  }
}
