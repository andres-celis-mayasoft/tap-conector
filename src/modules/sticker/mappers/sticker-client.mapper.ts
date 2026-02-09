import { Sticker as DigMatchSticker } from '@generated/client-digmatch';
import { StickerEntity } from '../domain/sticker.entity';
import { StickerStatus } from '../domain/sticker.types';

export class StickerClientMapper {
  static toDomain(digmatch: DigMatchSticker): StickerEntity {
    return new StickerEntity({
      id: 0, // Will be set when saved to own DB
      externalId: digmatch.id,
      submissionId: digmatch.submissionId,
      photoType: digmatch.photoType,
      photoLink: digmatch.photoLink,
      status: StickerStatus.PENDING,
      errors: null,
      assignedUserId: null,
      assignedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
