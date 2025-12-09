import { DateTime } from 'luxon';
import { OCR_Field as OCR_Field } from './common';

export class Utils {
  static getFields<T extends string | number | symbol>(
    fields: { type: T; text: string; confidence: number, row: number }[],
  ) {
    const output: Record<T, OCR_Field<T>> = {} as Record<T, OCR_Field<T>>;

    for (const field of fields) {
      output[field.type] = field ;
    }

    return output;
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

    return output.filter( r => r);
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

  static async asyncFilter<T>( arr, predicate) {
    const results = await Promise.all(arr.map(predicate));
    return arr.filter((_v, index) => results[index]);
  }

  static hasMonthsPassed(date: string): boolean {
    const parsedDate = DateTime.fromFormat(date, 'dd/MM/yyyy');

    if (!parsedDate.isValid) {
      throw new Error(
        `Invalid date format: ${date}. Expected format: dd/MM/yyyy`,
      );
    }

    const now = DateTime.now();
    const currentMonth = now.startOf('month');
    const previousMonth = currentMonth.minus({ months: 1 });
    const dateStartOfMonth = parsedDate.startOf('month');

    return dateStartOfMonth >= previousMonth && dateStartOfMonth <= currentMonth;
  }
}
