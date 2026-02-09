import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { StickerEntity } from '../domain/sticker.entity';
import { StickerStatus } from '../domain/sticker.types';
import { IStickerRepository, FindStickersOptions, StickerResultData } from './sticker.repository';
import { StickerOwnMapper } from '../mappers/sticker-own.mapper';

@Injectable()
export class StickerOwnRepository implements IStickerRepository {
  private readonly logger = new Logger(StickerOwnRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: number): Promise<StickerEntity | null> {
    const sticker = await this.prisma.sticker.findUnique({
      where: { id },
    });
    return sticker ? StickerOwnMapper.toDomain(sticker) : null;
  }

  async findByExternalId(externalId: number): Promise<StickerEntity | null> {
    const sticker = await this.prisma.sticker.findUnique({
      where: { externalId },
    });
    return sticker ? StickerOwnMapper.toDomain(sticker) : null;
  }

  async findBySubmissionId(submissionId: string): Promise<StickerEntity[]> {
    const stickers = await this.prisma.sticker.findMany({
      where: { submissionId },
    });
    return stickers.map(StickerOwnMapper.toDomain);
  }

  async findAll(options?: FindStickersOptions): Promise<StickerEntity[]> {
    const stickers = await this.prisma.sticker.findMany({
      where: {
        submissionId: options?.submissionId,
        photoType: options?.photoType,
        status: options?.status,
      },
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    });
    return stickers.map(StickerOwnMapper.toDomain);
  }

  async findPending(limit = 100): Promise<StickerEntity[]> {
    const stickers = await this.prisma.sticker.findMany({
      where: {
        status: StickerStatus.PENDING,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return stickers.map(StickerOwnMapper.toDomain);
  }

  async findNeedsDelivery(limit = 100): Promise<StickerEntity[]> {
    const stickers = await this.prisma.sticker.findMany({
      where: {
        status: StickerStatus.COMPLETED,
      },
      take: limit,
      orderBy: { completedAt: 'asc' },
    });
    return stickers.map(StickerOwnMapper.toDomain);
  }

  async findUnassigned(limit = 100): Promise<StickerEntity[]> {
    const stickers = await this.prisma.sticker.findMany({
      where: {
        status: StickerStatus.PENDING,
        assignedUserId: null,
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    return stickers.map(StickerOwnMapper.toDomain);
  }

  async findByAssignedUser(userId: number): Promise<StickerEntity[]> {
    const stickers = await this.prisma.sticker.findMany({
      where: {
        assignedUserId: userId,
        status: {
          in: [StickerStatus.IN_CAPTURE],
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
    return stickers.map(StickerOwnMapper.toDomain);
  }

  async save(sticker: StickerEntity): Promise<StickerEntity> {
    const data = StickerOwnMapper.toPrismaCreate(sticker);

    const created = await this.prisma.sticker.create({
      data,
    });

    return StickerOwnMapper.toDomain(created);
  }

  async saveMany(stickers: StickerEntity[]): Promise<StickerEntity[]> {
    if (stickers.length === 0) return [];

    const data = stickers.map((s) => StickerOwnMapper.toPrismaCreate(s));
    const externalIds = stickers.map((s) => s.externalId);

    await this.prisma.sticker.createMany({ data });

    const created = await this.prisma.sticker.findMany({
      where: { externalId: { in: externalIds } },
    });

    return created.map(StickerOwnMapper.toDomain);
  }

  async upsertByExternalId(sticker: StickerEntity): Promise<StickerEntity> {
    const data = StickerOwnMapper.toPrismaCreate(sticker);

    const upserted = await this.prisma.sticker.upsert({
      where: { externalId: sticker.externalId },
      create: data,
      update: StickerOwnMapper.toPrismaUpdate(sticker),
    });

    return StickerOwnMapper.toDomain(upserted);
  }

  async update(sticker: StickerEntity): Promise<StickerEntity> {
    const data = StickerOwnMapper.toPrismaUpdate(sticker);

    const updated = await this.prisma.sticker.update({
      where: { id: sticker.id },
      data,
    });

    return StickerOwnMapper.toDomain(updated);
  }

  async createResult(_sticker: StickerEntity, _result: StickerResultData): Promise<void> {
    // Not applicable for own repository - results are created in client DB
  }

  async delete(id: number): Promise<void> {
    await this.prisma.sticker.delete({
      where: { id },
    });
  }

  async count(options?: FindStickersOptions): Promise<number> {
    return this.prisma.sticker.count({
      where: {
        submissionId: options?.submissionId,
        photoType: options?.photoType,
        status: options?.status,
      },
    });
  }

  async getMaxExternalId(): Promise<number> {
    const result = await this.prisma.sticker.aggregate({
      _max: { externalId: true },
    });
    return result._max.externalId ?? 0;
  }
}
