/**
 * Base Repository Interface and Implementation
 * Provides generic CRUD operations and transaction support for all entities
 */

import { eq, and, or, desc, asc, sql, SQL } from "drizzle-orm";
import type { PgTable, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { drizzleDb, transaction as dbTransaction } from "../db/connection";

/**
 * Generic filter conditions for queries
 */
export interface FilterCondition<T = any> {
  field: keyof T;
  operator:
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "like"
    | "in"
    | "notIn"
    | "isNull"
    | "isNotNull";
  value?: any;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Transaction context for multi-operation consistency
 */
export type TransactionContext = PgTransaction<any, any, any>;

/**
 * Base repository interface defining common operations
 */
export interface IBaseRepository<T, TInsert = T, TUpdate = Partial<T>> {
  // Basic CRUD operations
  findById(id: string, tx?: TransactionContext): Promise<T | null>;
  findOne(filters: FilterCondition<T>[], tx?: TransactionContext): Promise<T | null>;
  findMany(filters?: FilterCondition<T>[], tx?: TransactionContext): Promise<T[]>;
  findPaginated(
    options: PaginationOptions,
    filters?: FilterCondition<T>[],
    tx?: TransactionContext
  ): Promise<PaginatedResult<T>>;

  create(data: TInsert, tx?: TransactionContext): Promise<T>;
  createMany(data: TInsert[], tx?: TransactionContext): Promise<T[]>;

  update(id: string, data: TUpdate, tx?: TransactionContext): Promise<T | null>;
  updateMany(
    filters: FilterCondition<T>[],
    data: TUpdate,
    tx?: TransactionContext
  ): Promise<number>;

  delete(id: string, tx?: TransactionContext): Promise<boolean>;
  deleteMany(filters: FilterCondition<T>[], tx?: TransactionContext): Promise<number>;

  // Utility methods
  exists(filters: FilterCondition<T>[], tx?: TransactionContext): Promise<boolean>;
  count(filters?: FilterCondition<T>[], tx?: TransactionContext): Promise<number>;

  // Transaction support
  transaction<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R>;
}

/**
 * Abstract base repository implementation with common logic
 */
export abstract class BaseRepository<T, TInsert = T, TUpdate = Partial<T>>
  implements IBaseRepository<T, TInsert, TUpdate>
{
  protected abstract table: PgTable;
  protected abstract schemaName?: string;
  protected db = drizzleDb;

  /**
   * Build SQL conditions from filter array
   */
  protected buildConditions(filters: FilterCondition<T>[]): SQL | undefined {
    if (!filters || filters.length === 0) return undefined;

    const conditions = filters.map((filter) => {
      const column = (this.table as any)[filter.field as string];

      switch (filter.operator) {
        case "eq":
          return eq(column, filter.value);
        case "ne":
          return sql`${column} != ${filter.value}`;
        case "gt":
          return sql`${column} > ${filter.value}`;
        case "gte":
          return sql`${column} >= ${filter.value}`;
        case "lt":
          return sql`${column} < ${filter.value}`;
        case "lte":
          return sql`${column} <= ${filter.value}`;
        case "like":
          return sql`${column} LIKE ${filter.value}`;
        case "in":
          return sql`${column} = ANY(${filter.value})`;
        case "notIn":
          return sql`${column} != ALL(${filter.value})`;
        case "isNull":
          return sql`${column} IS NULL`;
        case "isNotNull":
          return sql`${column} IS NOT NULL`;
        default:
          throw new Error(`Unsupported operator: ${filter.operator}`);
      }
    });

    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /**
   * Get database connection with schema context if needed
   */
  protected getDb(tx?: TransactionContext) {
    if (tx) return tx;

    // If schema-specific, we need to set search_path
    if (this.schemaName) {
      // This is a simplified version - in production, you'd want to handle this more elegantly
      // For now, we'll use the base db and rely on fully qualified table names
      return this.db;
    }

    return this.db;
  }

  /**
   * Find entity by ID
   */
  async findById(id: string, tx?: TransactionContext): Promise<T | null> {
    const db = this.getDb(tx);
    const result = await db
      .select()
      .from(this.table)
      .where(eq((this.table as any).id, id))
      .limit(1);

    return (result[0] as T) || null;
  }

  /**
   * Find single entity matching filters
   */
  async findOne(filters: FilterCondition<T>[], tx?: TransactionContext): Promise<T | null> {
    const db = this.getDb(tx);
    const conditions = this.buildConditions(filters);

    const query = db.select().from(this.table);
    if (conditions) {
      query.where(conditions);
    }

    const result = await query.limit(1);
    return (result[0] as T) || null;
  }

  /**
   * Find multiple entities matching filters
   */
  async findMany(filters?: FilterCondition<T>[], tx?: TransactionContext): Promise<T[]> {
    const db = this.getDb(tx);
    const conditions = filters ? this.buildConditions(filters) : undefined;

    const query = db.select().from(this.table);
    if (conditions) {
      query.where(conditions);
    }

    return (await query) as T[];
  }

  /**
   * Find paginated results
   */
  async findPaginated(
    options: PaginationOptions,
    filters?: FilterCondition<T>[],
    tx?: TransactionContext
  ): Promise<PaginatedResult<T>> {
    const db = this.getDb(tx);
    const conditions = filters ? this.buildConditions(filters) : undefined;

    // Count total records
    const countQuery = db.select({ count: sql`count(*)::int` }).from(this.table);
    if (conditions) {
      countQuery.where(conditions);
    }
    const [{ count: total }] = await countQuery;

    // Get paginated data
    const query = db.select().from(this.table);
    if (conditions) {
      query.where(conditions);
    }

    // Apply ordering
    if (options.orderBy) {
      const column = (this.table as any)[options.orderBy];
      if (options.orderDirection === "desc") {
        query.orderBy(desc(column));
      } else {
        query.orderBy(asc(column));
      }
    }

    // Apply pagination
    const offset = (options.page - 1) * options.pageSize;
    query.limit(options.pageSize).offset(offset);

    const data = (await query) as T[];

    return {
      data,
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
    };
  }

  /**
   * Create new entity
   */
  async create(data: TInsert, tx?: TransactionContext): Promise<T> {
    const db = this.getDb(tx);
    const result = await db
      .insert(this.table)
      .values(data as any)
      .returning();
    return result[0] as T;
  }

  /**
   * Create multiple entities
   */
  async createMany(data: TInsert[], tx?: TransactionContext): Promise<T[]> {
    if (data.length === 0) return [];

    const db = this.getDb(tx);
    const result = await db
      .insert(this.table)
      .values(data as any)
      .returning();
    return result as T[];
  }

  /**
   * Update entity by ID
   */
  async update(id: string, data: TUpdate, tx?: TransactionContext): Promise<T | null> {
    const db = this.getDb(tx);
    const result = await db
      .update(this.table)
      .set(data as any)
      .where(eq((this.table as any).id, id))
      .returning();

    return (result[0] as T) || null;
  }

  /**
   * Update multiple entities matching filters
   */
  async updateMany(
    filters: FilterCondition<T>[],
    data: TUpdate,
    tx?: TransactionContext
  ): Promise<number> {
    const db = this.getDb(tx);
    const conditions = this.buildConditions(filters);

    const query = db.update(this.table).set(data as any);
    if (conditions) {
      query.where(conditions);
    }

    const result = await query;
    return result.length;
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string, tx?: TransactionContext): Promise<boolean> {
    const db = this.getDb(tx);
    const result = await db
      .delete(this.table)
      .where(eq((this.table as any).id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Delete multiple entities matching filters
   */
  async deleteMany(filters: FilterCondition<T>[], tx?: TransactionContext): Promise<number> {
    const db = this.getDb(tx);
    const conditions = this.buildConditions(filters);

    const query = db.delete(this.table);
    if (conditions) {
      query.where(conditions);
    }

    const result = await query.returning();
    return result.length;
  }

  /**
   * Check if entity exists matching filters
   */
  async exists(filters: FilterCondition<T>[], tx?: TransactionContext): Promise<boolean> {
    const db = this.getDb(tx);
    const conditions = this.buildConditions(filters);

    const query = db.select({ exists: sql`1` }).from(this.table);
    if (conditions) {
      query.where(conditions);
    }

    const result = await query.limit(1);
    return result.length > 0;
  }

  /**
   * Count entities matching filters
   */
  async count(filters?: FilterCondition<T>[], tx?: TransactionContext): Promise<number> {
    const db = this.getDb(tx);
    const conditions = filters ? this.buildConditions(filters) : undefined;

    const query = db.select({ count: sql`count(*)::int` }).from(this.table);
    if (conditions) {
      query.where(conditions);
    }

    const [{ count }] = await query;
    return count;
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<R>(callback: (tx: TransactionContext) => Promise<R>): Promise<R> {
    return dbTransaction(callback);
  }
}

/**
 * Multi-tenant repository base for project-specific schemas
 */
export abstract class MultiTenantRepository<
  T,
  TInsert = T,
  TUpdate = Partial<T>,
> extends BaseRepository<T, TInsert, TUpdate> {
  protected projectId: string;

  constructor(projectId: string) {
    super();
    this.projectId = projectId;
    this.schemaName = `project_${projectId}`;
  }

  /**
   * Override to handle schema-specific queries
   */
  protected getDb(tx?: TransactionContext) {
    if (tx) return tx;

    // In a real implementation, we'd set the search_path here
    // For now, we'll rely on fully qualified table names
    return this.db;
  }

  /**
   * Get the fully qualified table name
   */
  protected getQualifiedTableName(): string {
    return `${this.schemaName}.${(this.table as any).name}`;
  }
}
