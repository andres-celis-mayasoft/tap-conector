import { StickerStatus } from './sticker.types';

export class StickerEntity {
  id: number;
  externalId: number; // ID from DigMatch DB
  submissionId: string;
  photoType: string | null;
  photoLink: string | null;

  // Processing fields
  status: StickerStatus;
  errors: string | null;

  // Manual validation assignment
  assignedUserId: number | null;
  assignedAt: Date | null;
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<StickerEntity>) {
    Object.assign(this, data);
  }

  isPending(): boolean {
    return this.status === StickerStatus.PENDING;
  }

  isProcessing(): boolean {
    return this.status === StickerStatus.PROCESSING;
  }

  isCompleted(): boolean {
    return this.status === StickerStatus.COMPLETED;
  }

  isError(): boolean {
    return this.status === StickerStatus.ERROR;
  }

  isAssigned(): boolean {
    return this.assignedUserId !== null;
  }

  markAsProcessing(): void {
    this.status = StickerStatus.PROCESSING;
  }

  markAsCompleted(): void {
    this.status = StickerStatus.COMPLETED;
    this.completedAt = new Date();
  }

  markAsError(error: string): void {
    this.status = StickerStatus.ERROR;
    this.errors = error;
  }

  assignTo(userId: number): void {
    this.assignedUserId = userId;
    this.assignedAt = new Date();
  }

  unassign(): void {
    this.assignedUserId = null;
    this.assignedAt = null;
  }
}
