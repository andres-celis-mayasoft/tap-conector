import { StickerEntity } from '../domain/sticker.entity';
import { StickerStatus } from '../domain/sticker.types';

export interface FindStickersOptions {
  submissionId?: string;
  photoType?: string;
  status?: StickerStatus;
  limit?: number;
  offset?: number;
}

export interface StickerResultData {
  digitalizedValue: string | null;
  observations: string | null;
}

export interface IStickerRepository {
  findById(id: number): Promise<StickerEntity | null>;
  findByExternalId(externalId: number): Promise<StickerEntity | null>;
  findBySubmissionId(submissionId: string): Promise<StickerEntity[]>;
  findAll(options?: FindStickersOptions): Promise<StickerEntity[]>;
  findPending(limit?: number): Promise<StickerEntity[]>;
  findNeedsDelivery(limit?: number): Promise<StickerEntity[]>;
  save(sticker: StickerEntity): Promise<StickerEntity>;
  update(sticker: StickerEntity): Promise<StickerEntity>;
  createResult(sticker: StickerEntity, result: StickerResultData): Promise<void>;
  delete(id: number): Promise<void>;
  count(options?: FindStickersOptions): Promise<number>;
}

export const STICKER_CLIENT_REPOSITORY = 'STICKER_CLIENT_REPOSITORY';
export const STICKER_OWN_REPOSITORY = 'STICKER_OWN_REPOSITORY';
