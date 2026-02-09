import { Sticker as OwnSticker } from '@generated/client';
import { StickerEntity } from '../domain/sticker.entity';
import { StickerStatus } from '../domain/sticker.types';

export class StickerOwnMapper {
  static toDomain(own: OwnSticker): StickerEntity {
    return new StickerEntity({
      id: own.id,
      externalId: own.externalId,
      submissionId: own.submissionId,
      photoType: own.photoType,
      photoLink: own.photoLink,
      status: own.status as StickerStatus,
      errors: own.errors,
      assignedUserId: own.assignedUserId,
      assignedAt: own.assignedAt,
      completedAt: own.completedAt,
      createdAt: own.createdAt,
      updatedAt: own.updatedAt,
    });
  }

  static toPrismaCreate(entity: StickerEntity): {
    externalId: number;
    submissionId: string;
    photoType: string | null;
    photoLink: string | null;
    status: string;
    errors: string | null;
    assignedUserId: number | null;
    assignedAt: Date | null;
    completedAt: Date | null;
  } {
    return {
      externalId: entity.externalId,
      submissionId: entity.submissionId,
      photoType: entity.photoType,
      photoLink: entity.photoLink,
      status: entity.status,
      errors: entity.errors,
      assignedUserId: entity.assignedUserId,
      assignedAt: entity.assignedAt,
      completedAt: entity.completedAt,
    };
  }

  static toPrismaUpdate(entity: StickerEntity): {
    status?: string;
    errors?: string | null;
    assignedUserId?: number | null;
    assignedAt?: Date | null;
    completedAt?: Date | null;
  } {
    return {
      status: entity.status,
      errors: entity.errors,
      assignedUserId: entity.assignedUserId,
      assignedAt: entity.assignedAt,
      completedAt: entity.completedAt,
    };
  }
}
