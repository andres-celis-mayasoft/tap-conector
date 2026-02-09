import { OCR_Field } from '../common';
import { StickerFields } from './sticker.fields';

type StickerField = OCR_Field<StickerFields> & {
  id?: number;
  error?: string;
};

export type StickerSchema = {
  fields: StickerField[];
  stickerId: number;
  externalId: number;
  submissionId: string;
  photoLink?: string;
};
