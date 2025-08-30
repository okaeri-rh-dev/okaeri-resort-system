/**
 * Base Service Interface
 * Defines the standard API for all services in the application
 * Enables seamless switching between mock and real implementations
 */

/**
 * Paginated response wrapper for list operations
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/**
 * Standard filter options for list operations
 */
export interface BaseFilters {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  [key: string]: any;
}

/**
 * Base service interface that all services must implement
 * @template T - The entity type
 * @template CreateDTO - The create data transfer object type
 * @template UpdateDTO - The update data transfer object type
 */
export interface BaseService<T, CreateDTO, UpdateDTO> {
  /**
   * List entities with optional filters and pagination
   */
  list(filters?: BaseFilters): Promise<PaginatedResponse<T>>;

  /**
   * Get a single entity by ID
   */
  get(id: string): Promise<T>;

  /**
   * Search for entities matching a query
   */
  search(query: string, filters?: BaseFilters): Promise<T[]>;

  /**
   * Create a new entity
   */
  create(data: CreateDTO): Promise<T>;

  /**
   * Update an existing entity
   */
  update(id: string, data: UpdateDTO): Promise<T>;

  /**
   * Delete an entity
   */
  delete(id: string): Promise<void>;

  /**
   * Create multiple entities in a batch
   */
  batchCreate(data: CreateDTO[]): Promise<T[]>;

  /**
   * Update multiple entities in a batch
   */
  batchUpdate(updates: { id: string; data: UpdateDTO }[]): Promise<T[]>;

  /**
   * Delete multiple entities in a batch
   */
  batchDelete(ids: string[]): Promise<void>;
}

/**
 * Abstract base class providing common functionality for services
 */
export abstract class AbstractBaseService<T, CreateDTO, UpdateDTO>
  implements BaseService<T, CreateDTO, UpdateDTO>
{
  protected readonly DEFAULT_PAGE = 1;
  protected readonly DEFAULT_LIMIT = 10;
  protected readonly MAX_LIMIT = 100;

  /**
   * Validate and normalize pagination parameters
   */
  protected normalizePagination(filters?: BaseFilters): { page: number; limit: number } {
    const page = Math.max(1, filters?.page || this.DEFAULT_PAGE);
    const limit = Math.min(this.MAX_LIMIT, Math.max(1, filters?.limit || this.DEFAULT_LIMIT));
    return { page, limit };
  }

  /**
   * Calculate pagination metadata
   */
  protected calculatePaginationMeta(
    total: number,
    page: number,
    limit: number
  ): PaginatedResponse<T>["meta"] {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    };
  }

  // Abstract methods that must be implemented by subclasses
  abstract list(filters?: BaseFilters): Promise<PaginatedResponse<T>>;
  abstract get(id: string): Promise<T>;
  abstract search(query: string, filters?: BaseFilters): Promise<T[]>;
  abstract create(data: CreateDTO): Promise<T>;
  abstract update(id: string, data: UpdateDTO): Promise<T>;
  abstract delete(id: string): Promise<void>;
  abstract batchCreate(data: CreateDTO[]): Promise<T[]>;
  abstract batchUpdate(updates: { id: string; data: UpdateDTO }[]): Promise<T[]>;
  abstract batchDelete(ids: string[]): Promise<void>;
}

/**
 * Service error class for consistent error handling
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/**
 * Common service errors
 */
export const ServiceErrors = {
  NotFound: (resource: string, id: string) =>
    new ServiceError(`${resource} with ID ${id} not found`, "NOT_FOUND", 404),

  ValidationFailed: (details: any) =>
    new ServiceError("Validation failed", "VALIDATION_FAILED", 400, details),

  Unauthorized: () => new ServiceError("Unauthorized", "UNAUTHORIZED", 401),

  Forbidden: () => new ServiceError("Forbidden", "FORBIDDEN", 403),

  Conflict: (message: string) => new ServiceError(message, "CONFLICT", 409),

  InternalError: (message: string = "Internal server error") =>
    new ServiceError(message, "INTERNAL_ERROR", 500),
} as const;
