import { DateTime } from 'luxon';

export class Utils {
  static getFields<T extends string | number | symbol>(
    fields: { type: T; text?: string; confidence: number }[],
  ) {
    const output: Record<T, any> = {} as Record<T, any>;

    for (const field of fields) {
      output[field.type] = { ...field };
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

    return output;
  }

  static isValidDate(date: string) {
    const parsedDate = DateTime.fromFormat(date, 'dd/MM/yyyy');
    if (!parsedDate.isValid) {
      return false;
    }
    return true;
  }

  static hasMonthsPassed(date: string, months: number): boolean {
    const parsedDate = DateTime.fromFormat(date, 'dd/MM/yyyy');

    if (!parsedDate.isValid) {
      throw new Error(
        `Invalid date format: ${date}. Expected format: dd/MM/yyyy`,
      );
    }

    const now = DateTime.now();
    const targetDate = parsedDate.plus({ months });

    return now >= targetDate;
  }
}
