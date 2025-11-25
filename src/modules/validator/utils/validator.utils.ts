import { Fields } from '../enums/fields';
import { InvoiceEntry, ValidateInvoice } from '../interfaces/invoice.interface';

/**
 * Interfaz base para entries de cualquier schema de documento
 */
interface BaseEntry {
  type: string;
  text?: string;
  confidence: number;
  row?: number;
}

export const EMBALAJES = [
  'UN',
  'CJ',
  'PZA',
  'BOT',
  'ST',
  'PQT',
  'UNIDAD',
  'PAC',
  'CAJA',
  'CAJ',
  'LAT',
  'UND',
  'SXP',
  'PAQ',
  'SIX',
];

export const EMBALAJES_POSTOBON_CAJA = ['CAJA'];
export class ValidatorUtils {
  static groupFields(rows: InvoiceEntry[]): InvoiceEntry[][] {
    if (rows.some((r) => typeof r.row !== 'number' || r.row < 1)) {
      return [];
    }

    const output: InvoiceEntry[][] = [];

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

  static isNumeric(value: string | undefined) {
    if (!value) return false;
    return /^-?\d+$/.test(value);
  }

  static getFields(rows: InvoiceEntry[]) {
    const output: Record<string, InvoiceEntry> = {};
    for (const row of rows) {
      output[row.type] = row;
    }
    return output;
  }

  static toNumber(row: InvoiceEntry | undefined) {
    return Number(row?.text || 0);
  }

  /**
   * Convierte un ValidateInvoice a un array de CampoDto
   * compatible con la estructura de Java CampoDto
   */
  static convertToCampoDto(
    validateInvoice:
      | ValidateInvoice
      | { encabezado: BaseEntry[]; detalles: BaseEntry[] },
  ): CampoDto[] {
    const campos: CampoDto[] = [];

    // Procesar encabezado
    validateInvoice.encabezado.forEach((entry) => {
      campos.push(this.mapInvoiceEntryToCampoDto(entry as InvoiceEntry));
    });

    // Procesar detalles
    validateInvoice.detalles.forEach((entry) => {
      campos.push(this.mapInvoiceEntryToCampoDto(entry as InvoiceEntry));
    });

    return campos;
  }

  /**
   * Mapea un InvoiceEntry a CampoDto
   */

  private static isFloat(n){
    return Number(n) === n && n % 1 !== 0;
}

private static isInt(n){
    return Number(n) === n && n % 1 === 0;
}


private static  normalizeAtomization(value: string) {
  if(Number.isInteger(value)) return Number(value).toString();

  return parseFloat(value).toString().replace('.',',')
  
}
  private static mapInvoiceEntryToCampoDto(entry: InvoiceEntry): CampoDto {
    
    const FIELDS_TO_FORMAT  = [ Fields.TOTAL_FACTURA_SIN_IVA, Fields.VALOR_TOTAL_FACTURA, Fields.VALOR_VENTA_ITEM]
    if(FIELDS_TO_FORMAT.some((item) => item === entry.type) && entry.text) 
      entry.text = this.normalizeAtomization(entry.text)
    if(entry.type === undefined){
      console.log("hit undefined type")
    }

    return {
      nombre: entry.type.toUpperCase(),
      pagina: 0,
      registro: 1,
      fila: entry.row || 1,
      confianza: Math.round(entry.confidence * 100), // Convertir de 0.0-1.0 a 0-100
      x: 0,
      y: 0,
      ancho: 0,
      altura: 0,
      imagen: '',
      valor_atomizacion: entry.text || null,
      es_blanco: entry.text ? 0 : 1,
      valor_cierre: entry.text || '',
    };
  }
}

/**
 * Interfaz que representa el CampoDto de Java
 */
export interface CampoDto {
  nombre: string;
  pagina: number;
  registro: number;
  fila: number;
  valor_atomizacion: string | null;
  es_blanco: number;
  confianza: number;
  x: number;
  y: number;
  ancho: number;
  altura: number;
  imagen: string;
  valor_cierre: string | null;
}
