import { Injectable, Logger } from '@nestjs/common';
import { PrismaDigMatchService } from 'src/database/services/prisma-digmatch.service';
import { StickerEntity } from '../domain/sticker.entity';
import { IStickerRepository, FindStickersOptions, StickerResultData } from './sticker.repository';
import { StickerClientMapper } from '../mappers/sticker-client.mapper';

@Injectable()
export class StickerClientRepository implements IStickerRepository {
  private readonly logger = new Logger(StickerClientRepository.name);

  constructor(private readonly prismaDigMatch: PrismaDigMatchService) {}

  async findById(id: number): Promise<StickerEntity | null> {
    const sticker = await this.prismaDigMatch.sticker.findUnique({
      where: { id },
      include: { result: true },
    });
    return sticker ? StickerClientMapper.toDomain(sticker) : null;
  }

  async findByExternalId(externalId: number): Promise<StickerEntity | null> {
    return this.findById(externalId);
  }

  async findBySubmissionId(submissionId: string): Promise<StickerEntity[]> {
    const stickers = await this.prismaDigMatch.sticker.findMany({
      where: { submissionId },
      include: { result: true },
    });
    return stickers.map(StickerClientMapper.toDomain);
  }

  async findAll(options?: FindStickersOptions): Promise<StickerEntity[]> {
    const stickers = await this.prismaDigMatch.sticker.findMany({
      where: {
        submissionId: options?.submissionId,
        photoType: options?.photoType,
      },
      include: { result: true },
      take: options?.limit,
      skip: options?.offset,
    });
    return stickers.map(StickerClientMapper.toDomain);
  }

  async findPending(): Promise<StickerEntity[]> {
    this.logger.warn(
      'findPending not applicable for client repository - use findByIdGreaterThan instead',
    );
    return [];
  }

  async findByIdGreaterThan(
    minId: number,
    limit = 100,
  ): Promise<StickerEntity[]> {
    const stickers = await this.prismaDigMatch.sticker.findMany({
      where: {
        id: { gt: minId },
      },
      include: { result: true },
      take: limit,
      orderBy: { id: 'asc' },
    });
    return stickers.map(StickerClientMapper.toDomain);
  }

  async findNeedsDelivery(limit = 100): Promise<StickerEntity[]> {
    this.logger.warn('findNeedsDelivery not applicable for client repository');
    return [];
  }

  async save(sticker: StickerEntity): Promise<StickerEntity> {
    this.logger.warn(
      'save not applicable for client repository - use update instead',
    );
    return sticker;
  }

  async update(sticker: StickerEntity): Promise<StickerEntity> {
    // Not applicable for client repository
    return sticker;
  }

  async createResult(sticker: StickerEntity, result: StickerResultData): Promise<void> {
    this.logger.log(`Creating result for sticker ${sticker.externalId}`);
    // COMENTADO TEMPORALMENTE POR AMBIENTE
    // Create or update the result in DigMatch DB
    // await this.prismaDigMatch.stickerResult.upsert({
    //   where: { requestId: sticker.externalId },
    //   create: {
    //     requestId: sticker.externalId,
    //     digitalizedValue: result.digitalizedValue,
    //     observations: result.observations,
    //   },
    //   update: {
    //     digitalizedValue: result.digitalizedValue,
    //     observations: result.observations,
    //   },
    // });

    this.logger.log(`Result created for sticker ${sticker.externalId}`);
  }

  async delete(id: number): Promise<void> {
    this.logger.warn('delete not applicable for client repository');
  }

  async count(options?: FindStickersOptions): Promise<number> {
    return this.prismaDigMatch.sticker.count({
      where: {
        submissionId: options?.submissionId,
        photoType: options?.photoType,
      },
    });
  }
}
