import { DateTime } from "luxon";


export type OCR_Field<T> = {
    text: string,
    confidence: number,
    type: T;
    error?: string,
    row: number;
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

export const NULL_DATE = DateTime.fromObject({ year: 1900, month: 1, day: 1 }).toString();
export const NULL_FLOAT = parseFloat('-0.01')
export const NULL_NUMBER = -1
export const NULL_STRING = "[ILEGIBLE]"

export const isNullOrIllegible = (text?: string) => {
    if(!text) return true;
    if(text === '[ILEGIBLE]') return true;
    return false;
}