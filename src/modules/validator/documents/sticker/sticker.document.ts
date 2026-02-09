import { StickerFields } from './sticker.fields';
import { StickerSchema } from './sticker.schema';
import { Document } from '../base/document';
import { Utils } from '../utils';
import { isNullOrIllegible, NULL_STRING } from '../common';

/**
 * Sticker document processor
 * Handles validation and formatting of sticker data from DigMatch
 */
export class StickerDocument extends Document<StickerSchema> {
  constructor(data: StickerSchema) {
    super(data);
  }

  normalize(): this {
    // Trim whitespace from sticker value
    const stickerValue = this.data.fields.find(
      (f) => f.type === StickerFields.STICKER_VALUE,
    );
    if (stickerValue?.text) {
      stickerValue.text = stickerValue.text.trim();
    }

    return this;
  }

  validate(): void {
    const stickerValue = this.data.fields.find(
      (f) => f.type === StickerFields.STICKER_VALUE,
    );

    if (!stickerValue?.text || isNullOrIllegible(stickerValue.text)) {
      this.errors['sticker_value'] = 'Sticker value is required';
      this.isValid = false;
    }
  }

  async infer(): Promise<this> {
    // No inference needed for stickers
    return this;
  }

  async exclude(): Promise<this> {
    // No exclusion logic for stickers
    return this;
  }

  prune(): void {
    // No pruning needed for stickers
  }

  /**
   * Format sticker data for delivery to DigMatch
   * Returns the result structure expected by DigMatch
   */
  format(): StickerResult {
    const stickerValue = this.data.fields.find(
      (f) => f.type === StickerFields.STICKER_VALUE,
    );
    const observations = this.data.fields.find(
      (f) => f.type === StickerFields.OBSERVATIONS,
    );

    return {
      stickerId: this.data.stickerId,
      externalId: this.data.externalId,
      submissionId: this.data.submissionId,
      digitalizedValue: isNullOrIllegible(stickerValue?.text)
        ? NULL_STRING
        : stickerValue?.text || NULL_STRING,
      observations: observations?.text || null,
    };
  }

  /**
   * Get the sticker value field
   */
  getStickerValue(): string | null {
    const field = this.data.fields.find(
      (f) => f.type === StickerFields.STICKER_VALUE,
    );
    return field?.text || null;
  }

  /**
   * Get observations field
   */
  getObservations(): string | null {
    const field = this.data.fields.find(
      (f) => f.type === StickerFields.OBSERVATIONS,
    );
    return field?.text || null;
  }
}

export interface StickerResult {
  stickerId: number;
  externalId: number;
  submissionId: string;
  digitalizedValue: string;
  observations: string | null;
}
