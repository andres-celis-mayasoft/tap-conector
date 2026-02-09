import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/services/prisma.service';
import { StickerEntity } from './domain/sticker.entity';
import { StickerStatus } from './domain/sticker.types';
import { DateTime } from 'luxon';
import { StickerClientRepository } from './repositories/sticker-client.repo';
import { StickerOwnRepository } from './repositories/sticker-own.repo';

export interface StickerFieldDto {
  id?: number;
  type: string;
  text: string;
  confidence: number;
}

@Injectable()
export class StickerService {
  private readonly logger = new Logger(StickerService.name);

  constructor(
    private readonly clientRepo: StickerClientRepository,
    private readonly ownRepo: StickerOwnRepository,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== EXTRACTION (from Meiko) ====================

  async extractPendingFromClient(limit = 100): Promise<StickerEntity[]> {
    this.logger.log(`Extracting pending stickers from client DB (limit: ${limit})`);

    // Get max externalId from our DB to only fetch new stickers
    const maxExternalId = await this.ownRepo.getMaxExternalId();
    this.logger.log(`Max externalId in our DB: ${maxExternalId}`);

    // Fetch stickers from client DB with id > maxExternalId
    const newFromClient = await this.clientRepo.findByIdGreaterThan(maxExternalId, limit);
    this.logger.log(`Found ${newFromClient.length} new stickers from client DB`);

    if (newFromClient.length === 0) {
      return [];
    }

    for (const sticker of newFromClient) {
      sticker.status = StickerStatus.PENDING;
    }

    const extracted = await this.ownRepo.saveMany(newFromClient);

    for (const sticker of extracted) {
      this.logger.log(`Extracted sticker ${sticker.externalId} (submissionId: ${sticker.submissionId})`);
    }

    this.logger.log(`Extracted ${extracted.length} new stickers from client DB`);
    return extracted;
  }

  // ==================== DELIVERY (to Meiko) ====================

  async deliverCompletedToClient(): Promise<number> {
    this.logger.log('Delivering completed stickers to client DB');

    const needsDelivery = await this.ownRepo.findNeedsDelivery();
    let deliveredCount = 0;

    for (const sticker of needsDelivery) {
      try {
        // Fetch fields from local DB
        const fields = await this.prisma.stickerField.findMany({
          where: { stickerId: sticker.id },
        });

        const valueField = fields.find((f) => f.type === 'value');
        const observationField = fields.find((f) => f.type === 'observations');

        const result = {
          digitalizedValue: valueField?.corrected_value || valueField?.value || null,
          observations: observationField?.corrected_value || observationField?.value || null,
        };

        await this.clientRepo.createResult(sticker, result);

        // Mark as delivered in own DB
        sticker.status = StickerStatus.COMPLETED;
        await this.ownRepo.update(sticker);

        deliveredCount++;
        this.logger.log(`Delivered sticker ${sticker.externalId} to client DB`);
      } catch (error) {
        this.logger.error(`Failed to deliver sticker ${sticker.externalId}: ${error.message}`);
        sticker.markAsError(error.message);
        await this.ownRepo.update(sticker);
      }
    }

    this.logger.log(`Delivered ${deliveredCount} stickers to client DB`);
    return deliveredCount;
  }

  // ==================== BUSINESS LOGIC ====================

  async findById(id: number): Promise<StickerEntity> {
    const sticker = await this.ownRepo.findById(id);
    if (!sticker) {
      throw new NotFoundException(`Sticker with id ${id} not found`);
    }
    return sticker;
  }

  async findByExternalId(externalId: number): Promise<StickerEntity> {
    const sticker = await this.ownRepo.findByExternalId(externalId);
    if (!sticker) {
      throw new NotFoundException(`Sticker with externalId ${externalId} not found`);
    }
    return sticker;
  }

  async findAll(options?: {
    submissionId?: string;
    photoType?: string;
    status?: StickerStatus;
    limit?: number;
    offset?: number;
  }): Promise<StickerEntity[]> {
    return this.ownRepo.findAll(options);
  }

  async findPending(limit?: number): Promise<StickerEntity[]> {
    return this.ownRepo.findPending(limit);
  }

  async findBySubmissionId(submissionId: string): Promise<StickerEntity[]> {
    return this.ownRepo.findBySubmissionId(submissionId);
  }

  async count(options?: {
    submissionId?: string;
    photoType?: string;
    status?: StickerStatus;
  }): Promise<number> {
    return this.ownRepo.count(options);
  }

  // ==================== VALIDATION WORKFLOW ====================

  /**
   * Assigns the next available sticker to a user.
   * If user already has an active sticker, returns that one.
   * Returns null if no stickers are available.
   */
  async assignNextToUser(userId: number): Promise<StickerEntity | null> {
    this.logger.log(`Assigning next available sticker to user ${userId}`);

    // Check if user already has an assigned sticker
    const existingAssignments = await this.ownRepo.findByAssignedUser(userId);
    if (existingAssignments.length > 0) {
      this.logger.log(`User ${userId} already has sticker ${existingAssignments[0].id} assigned`);
      return existingAssignments[0];
    }

    // Find next unassigned sticker
    const unassigned = await this.ownRepo.findUnassigned(1);
    if (unassigned.length === 0) {
      this.logger.log(`No unassigned stickers available for user ${userId}`);
      return null;
    }

    // Assign it
    const sticker = unassigned[0];
    sticker.assignTo(userId);
    sticker.status = StickerStatus.IN_CAPTURE;
    const updated = await this.ownRepo.update(sticker);

    this.logger.log(`Assigned sticker ${updated.id} to user ${userId}`);
    return updated;
  }

  async assignToUser(stickerId: number, userId: number): Promise<StickerEntity> {
    const sticker = await this.findById(stickerId);
    sticker.assignTo(userId);
    return this.ownRepo.update(sticker);
  }

  async unassign(stickerId: number): Promise<StickerEntity> {
    const sticker = await this.findById(stickerId);
    sticker.unassign();
    return this.ownRepo.update(sticker);
  }

  async findUnassigned(limit?: number): Promise<StickerEntity[]> {
    return this.ownRepo.findUnassigned(limit);
  }

  async findByAssignedUser(userId: number): Promise<StickerEntity[]> {
    return this.ownRepo.findByAssignedUser(userId);
  }

  async startProcessing(stickerId: number): Promise<StickerEntity> {
    const sticker = await this.findById(stickerId);
    sticker.markAsProcessing();
    return this.ownRepo.update(sticker);
  }

  async completeValidation(
    stickerId: number,
    fields?: StickerFieldDto[],
  ): Promise<StickerEntity> {
    const sticker = await this.findById(stickerId);

    // Save fields if provided
    if (fields && fields.length > 0) {
      await this.saveFields(sticker.id, fields);
    }

    sticker.markAsCompleted();
    return this.ownRepo.update(sticker);
  }

  async saveFields(
    stickerId: number,
    fields: StickerFieldDto[],
  ): Promise<void> {
    this.logger.log(`Saving ${fields.length} fields for sticker ${stickerId}`);

    for (const field of fields) {
      if (field.id) {
        // Update existing field
        await this.prisma.stickerField.update({
          where: { id: field.id },
          data: {
            corrected_value: field.text,
            confidence: field.confidence,
            validated: true,
          },
        });
      } else {
        // Create new field
        await this.prisma.stickerField.create({
          data: {
            stickerId,
            name: field.type,
            type: field.type,
            value: '',
            corrected_value: field.text,
            confidence: field.confidence,
            extracted: false,
            validated: true,
          },
        });
      }
    }

    this.logger.log(`Saved fields for sticker ${stickerId}`);
  }

  /**
   * Save corrected sticker data from manual validation
   * Similar to saveCorrectedInvoice but for stickers
   *
   * @param dto - Sticker data with corrections
   * @returns Result with success status
   */
  async saveCorrectedSticker(dto: {
    userId: number;
    stickerId: number; // This is the externalId
    fields: StickerFieldDto[];
  }): Promise<{ success: boolean; stickerId: number }> {
    const { userId, stickerId, fields } = dto;

    try {
      this.logger.log(`Saving corrected sticker ${stickerId} by user ${userId}`);

      // Find sticker by externalId and verify assignment
      const sticker = await this.prisma.sticker.findFirst({
        where: {
          externalId: stickerId,
          assignedUserId: userId,
        },
      });

      if (!sticker) {
        throw new Error(`Sticker ${stickerId} is not assigned to user ${userId}`);
      }

      // Get existing fields for this sticker
      const existingFields = await this.prisma.stickerField.findMany({
        where: { stickerId: sticker.id },
        select: { id: true, value: true },
      });

      const incomingIds = fields.filter((f) => f.id).map((f) => f.id);
      const existingIds = existingFields.map((f) => f.id);
      const idsToDelete = existingIds.filter((id) => !incomingIds.includes(id));

      // Delete removed fields
      if (idsToDelete.length > 0) {
        this.logger.log(
          `Deleting ${idsToDelete.length} fields no longer present, stickerId = ${sticker.id}`,
        );
        await this.prisma.stickerField.deleteMany({
          where: { id: { in: idsToDelete } },
        });
      }

      // Save/update fields
      await this.saveFields(sticker.id, fields);

      // Mark sticker as completed
      await this.prisma.sticker.update({
        where: { id: sticker.id },
        data: {
          status: StickerStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Sticker ${stickerId} marked as COMPLETED`);
      return { success: true, stickerId };

    } catch (error) {
      this.logger.error(
        `Error saving corrected sticker ${stickerId}: ${error.message}`,
        error.stack,
      );

      // Try to mark sticker as having an error
      try {
        const sticker = await this.prisma.sticker.findFirst({
          where: { externalId: stickerId, assignedUserId: userId },
        });
        if (sticker) {
          await this.prisma.sticker.update({
            where: { id: sticker.id },
            data: {
              status: StickerStatus.ERROR,
              errors: `SAVE_ERROR: ${error.message}`,
            },
          });
        }
      } catch (updateError) {
        this.logger.error(`Failed to update sticker error status: ${updateError.message}`);
      }

      throw new NotFoundException(
        'Error al guardar el sticker. Por favor, comuníquese con soporte.',
      );
    }
  }

  async markAsError(stickerId: number, error: string): Promise<StickerEntity> {
    const sticker = await this.findById(stickerId);
    sticker.markAsError(error);
    return this.ownRepo.update(sticker);
  }

  async markAsNoProcesable(stickerId: number): Promise<StickerEntity> {
    const sticker = await this.findById(stickerId);
    sticker.status = StickerStatus.NO_PROCESABLE;
    return this.ownRepo.update(sticker);
  }

  // ==================== CRUD (Own DB) ====================

  async update(
    id: number,
    data: Partial<{
      status: StickerStatus;
    }>,
  ): Promise<StickerEntity> {
    const sticker = await this.findById(id);

    if (data.status !== undefined) {
      sticker.status = data.status;
    }

    return this.ownRepo.update(sticker);
  }

  async delete(id: number): Promise<void> {
    await this.findById(id); // Verify exists
    await this.ownRepo.delete(id);
  }

  // ==================== PROCESSING (Cron job entry point) ====================

  async processPending(): Promise<void> {
    this.logger.log('Processing pending stickers');

    // 1. Extract new stickers from client DB
    await this.extractPendingFromClient();

    // 2. Deliver completed stickers to client DB
    await this.deliverCompletedToClient();

    this.logger.log('Finished processing pending stickers');
  }

  // ==================== RELEASE UNRESOLVED ====================

  /**
   * Release stickers that have been assigned for too long without resolution.
   * Similar to releaseUnresolvedInvoices in InvoiceService.
   * @param minutesThreshold - Minutes after which a sticker is considered unresolved (default: 40)
   * @returns Number of stickers released
   */
  async releaseUnresolvedStickers(minutesThreshold = 40): Promise<number> {
    try {
      const thresholdTime = DateTime.now().minus({ minutes: minutesThreshold }).toJSDate();

      const unresolvedStickers = await this.prisma.sticker.findMany({
        where: {
          status: StickerStatus.IN_CAPTURE,
          assignedAt: {
            lt: thresholdTime,
          },
          completedAt: null,
        },
      });

      if (unresolvedStickers.length === 0) {
        return 0;
      }

      this.logger.log(
        `Found ${unresolvedStickers.length} stickers to release`,
      );

      // Release all unresolved stickers
      const result = await this.prisma.sticker.updateMany({
        where: {
          status: StickerStatus.IN_CAPTURE,
          assignedAt: {
            lt: thresholdTime,
          },
          completedAt: null,
        },
        data: {
          status: StickerStatus.PENDING,
          assignedUserId: null,
          assignedAt: null,
        },
      });

      this.logger.log(`Released ${result.count} stickers`);
      return result.count;
    } catch (error) {
      this.logger.error(
        `Error releasing unresolved stickers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
