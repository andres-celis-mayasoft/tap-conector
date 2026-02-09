/**
 * Interface for entities that can be assigned to users
 * Both Document and Sticker implement these fields
 */
export interface IAssignable {
  id: number;
  assignedUserId: number | null;
  assignedAt: Date | null;
  completedAt: Date | null;
  status: string;
}

/**
 * Result of an assignment operation
 */
export interface AssignmentResult<T> {
  success: boolean;
  entity: T | null;
  message?: string;
}

/**
 * Options for finding unassigned entities
 */
export interface FindUnassignedOptions {
  limit?: number;
  validStatuses?: string[];
}

/**
 * Options for finding entities by assigned user
 */
export interface FindByUserOptions {
  userId: number;
  activeStatuses?: string[];
}
