import { Injectable, Logger } from '@nestjs/common';
import {
  IAssignable,
  AssignmentResult,
  FindUnassignedOptions,
  FindByUserOptions,
} from './assignment.types';

/**
 * Generic Assignment Service
 *
 * Provides shared assignment logic for any entity that implements IAssignable.
 * Used by both InvoiceService (for Documents) and StickerService (for Stickers).
 *
 * This service doesn't interact with the database directly - instead, it receives
 * callback functions for finding and updating entities, making it database-agnostic.
 */
@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  /**
   * Assigns an entity to a user
   *
   * @param entityId - The ID of the entity to assign
   * @param userId - The ID of the user to assign to
   * @param findById - Function to find entity by ID
   * @param update - Function to update the entity
   * @param newStatus - Optional new status to set (e.g., 'IN_CAPTURE')
   */
  async assignToUser<T extends IAssignable>(
    entityId: number,
    userId: number,
    findById: (id: number) => Promise<T | null>,
    update: (id: number, data: Partial<T>) => Promise<T>,
    newStatus?: string,
  ): Promise<AssignmentResult<T>> {
    this.logger.log(`Assigning entity ${entityId} to user ${userId}`);

    const entity = await findById(entityId);
    if (!entity) {
      return {
        success: false,
        entity: null,
        message: `Entity with id ${entityId} not found`,
      };
    }

    if (entity.assignedUserId !== null) {
      return {
        success: false,
        entity: entity,
        message: `Entity ${entityId} is already assigned to user ${entity.assignedUserId}`,
      };
    }

    const updateData: Partial<IAssignable> = {
      assignedUserId: userId,
      assignedAt: new Date(),
    };

    if (newStatus) {
      updateData.status = newStatus;
    }

    const updated = await update(entityId, updateData as Partial<T>);

    this.logger.log(`Entity ${entityId} assigned to user ${userId}`);

    return {
      success: true,
      entity: updated,
    };
  }

  /**
   * Unassigns an entity from its current user
   *
   * @param entityId - The ID of the entity to unassign
   * @param findById - Function to find entity by ID
   * @param update - Function to update the entity
   * @param revertStatus - Optional status to revert to (e.g., 'PENDING_VALIDATION')
   */
  async unassign<T extends IAssignable>(
    entityId: number,
    findById: (id: number) => Promise<T | null>,
    update: (id: number, data: Partial<T>) => Promise<T>,
    revertStatus?: string,
  ): Promise<AssignmentResult<T>> {
    this.logger.log(`Unassigning entity ${entityId}`);

    const entity = await findById(entityId);
    if (!entity) {
      return {
        success: false,
        entity: null,
        message: `Entity with id ${entityId} not found`,
      };
    }

    if (entity.assignedUserId === null) {
      return {
        success: false,
        entity: entity,
        message: `Entity ${entityId} is not assigned to any user`,
      };
    }

    const updateData: Partial<IAssignable> = {
      assignedUserId: null,
      assignedAt: null,
    };

    if (revertStatus) {
      updateData.status = revertStatus;
    }

    const updated = await update(entityId, updateData as Partial<T>);

    this.logger.log(`Entity ${entityId} unassigned`);

    return {
      success: true,
      entity: updated,
    };
  }

  /**
   * Marks an entity as completed by the assigned user
   *
   * @param entityId - The ID of the entity to complete
   * @param findById - Function to find entity by ID
   * @param update - Function to update the entity
   * @param completedStatus - Status to set when completed (e.g., 'COMPLETED')
   */
  async markAsCompleted<T extends IAssignable>(
    entityId: number,
    findById: (id: number) => Promise<T | null>,
    update: (id: number, data: Partial<T>) => Promise<T>,
    completedStatus: string,
  ): Promise<AssignmentResult<T>> {
    this.logger.log(`Marking entity ${entityId} as completed`);

    const entity = await findById(entityId);
    if (!entity) {
      return {
        success: false,
        entity: null,
        message: `Entity with id ${entityId} not found`,
      };
    }

    const updateData: Partial<IAssignable> = {
      completedAt: new Date(),
      status: completedStatus,
    };

    const updated = await update(entityId, updateData as Partial<T>);

    this.logger.log(`Entity ${entityId} marked as completed`);

    return {
      success: true,
      entity: updated,
    };
  }

  /**
   * Gets the next available entity for assignment
   * Returns the first unassigned entity matching the criteria
   *
   * @param findUnassigned - Function to find unassigned entities
   * @param options - Options for filtering
   */
  async getNextAvailable<T extends IAssignable>(
    findUnassigned: (options: FindUnassignedOptions) => Promise<T[]>,
    options: FindUnassignedOptions = {},
  ): Promise<T | null> {
    const entities = await findUnassigned({ ...options, limit: 1 });
    return entities.length > 0 ? entities[0] : null;
  }

  /**
   * Checks if a user already has an assigned entity
   *
   * @param userId - The user ID to check
   * @param findByUser - Function to find entities by assigned user
   * @param activeStatuses - Statuses that count as "active" assignment
   */
  async hasActiveAssignment<T extends IAssignable>(
    userId: number,
    findByUser: (options: FindByUserOptions) => Promise<T[]>,
    activeStatuses: string[] = ['PENDING', 'PROCESSING', 'IN_CAPTURE'],
  ): Promise<{ hasAssignment: boolean; entity: T | null }> {
    const entities = await findByUser({ userId, activeStatuses });

    if (entities.length > 0) {
      return { hasAssignment: true, entity: entities[0] };
    }

    return { hasAssignment: false, entity: null };
  }

  /**
   * Assigns the next available entity to a user
   * First checks if user already has an active assignment
   *
   * @param userId - The user ID to assign to
   * @param findByUser - Function to find entities by assigned user
   * @param findUnassigned - Function to find unassigned entities
   * @param update - Function to update entity
   * @param activeStatuses - Statuses that count as "active" assignment
   * @param newStatus - Status to set when assigned
   */
  async assignNextAvailable<T extends IAssignable>(
    userId: number,
    findByUser: (options: FindByUserOptions) => Promise<T[]>,
    findUnassigned: (options: FindUnassignedOptions) => Promise<T[]>,
    update: (id: number, data: Partial<T>) => Promise<T>,
    activeStatuses: string[] = ['PENDING', 'PROCESSING'],
    newStatus?: string,
  ): Promise<AssignmentResult<T>> {
    // Check if user already has an assignment
    const { hasAssignment, entity: existingEntity } = await this.hasActiveAssignment(
      userId,
      findByUser,
      activeStatuses,
    );

    if (hasAssignment && existingEntity) {
      this.logger.log(`User ${userId} already has entity ${existingEntity.id} assigned`);
      return {
        success: true,
        entity: existingEntity,
        message: 'User already has an active assignment',
      };
    }

    // Get next available entity
    const nextEntity = await this.getNextAvailable(findUnassigned, {
      validStatuses: activeStatuses,
    });

    if (!nextEntity) {
      return {
        success: false,
        entity: null,
        message: 'No entities available for assignment',
      };
    }

    // Assign it
    const updateData: Partial<IAssignable> = {
      assignedUserId: userId,
      assignedAt: new Date(),
    };

    if (newStatus) {
      updateData.status = newStatus;
    }

    const updated = await update(nextEntity.id, updateData as Partial<T>);

    this.logger.log(`Entity ${nextEntity.id} assigned to user ${userId}`);

    return {
      success: true,
      entity: updated,
    };
  }
}
