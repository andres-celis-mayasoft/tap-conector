export enum StickerFields {
  STICKER_VALUE = 'sticker_value',
  OBSERVATIONS = 'observations',
}

export const STICKER_THRESHOLDS = {
  [StickerFields.STICKER_VALUE]: 0.8,
  [StickerFields.OBSERVATIONS]: 0.5,
};
