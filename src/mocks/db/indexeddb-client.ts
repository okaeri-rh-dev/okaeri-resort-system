/**
 * IndexedDB Client Wrapper
 * Provides a type-safe interface for IndexedDB operations with PostgreSQL-like querying
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  type MockDBSchema,
  type StoreNames,
  type StoreData,
  type StoreKey,
  type QueryOptions,
  type QueryFilter,
  DB_NAME,
  DB_VERSION,
  storeConfig,
} from "./schema";

/**
 * IndexedDB Database interface extending the IDB schema
 */
interface MockDatabase extends DBSchema {
  users: MockDBSchema["users"];
  projects: MockDBSchema["projects"];
  projectMemberships: MockDBSchema["projectMemberships"];
  properties: MockDBSchema["properties"];
  bookings: MockDBSchema["bookings"];
  expenses: MockDBSchema["expenses"];
  payments: MockDBSchema["payments"];
  guests: MockDBSchema["guests"];
  activityLogs: MockDBSchema["activityLogs"];
  sessions: MockDBSchema["sessions"];
  rateLimits: MockDBSchema["rateLimits"];
  offlineQueue: MockDBSchema["offlineQueue"];
}

/**
 * TypeScript utility for pagination results
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Transaction types for batch operations
 */
export type TransactionMode = "readonly" | "readwrite";

/**
 * IndexedDB Client Class
 */
export class IndexedDBClient {
  private db: IDBPDatabase<MockDatabase> | null = null;
  private isInitialized = false;

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    try {
      console.log("[MockDB] Initializing IndexedDB connection...");

      this.db = await openDB<MockDatabase>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          console.log("[MockDB] Upgrading database schema...");

          // Create all stores with indexes
          Object.entries(storeConfig).forEach(([storeName, config]) => {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, {
                keyPath: config.keyPath,
                autoIncrement: config.autoIncrement,
              });

              // Create indexes
              config.indexes.forEach(({ name, keyPath, unique }) => {
                store.createIndex(name, keyPath as any, { unique });
              });

              console.log(
                `[MockDB] Created store: ${storeName} with ${config.indexes.length} indexes`
              );
            }
          });
        },
        blocked() {
          console.warn("[MockDB] Database upgrade blocked by another connection");
        },
        blocking() {
          console.warn("[MockDB] This connection is blocking a database upgrade");
        },
      });

      this.isInitialized = true;
      console.log("[MockDB] Database initialized successfully");
    } catch (error) {
      console.error("[MockDB] Failed to initialize database:", error);
      throw new Error(`Failed to initialize mock database: ${error}`);
    }
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInitialized(): Promise<IDBPDatabase<MockDatabase>> {
    if (!this.isInitialized || !this.db) {
      await this.initialize();
    }
    return this.db!;
  }

  /**
   * Create a new record
   */
  async create<T extends StoreNames>(storeName: T, data: StoreData<T>): Promise<StoreData<T>> {
    const db = await this.ensureInitialized();
    const tx = db.transaction(storeName, "readwrite");

    try {
      await tx.objectStore(storeName).add(data);
      await tx.done;
      console.log(`[MockDB] Created record in ${storeName}:`, data);
      return data;
    } catch (error) {
      console.error(`[MockDB] Failed to create record in ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Get a record by ID
   */
  async get<T extends StoreNames>(
    storeName: T,
    id: StoreKey<T>
  ): Promise<StoreData<T> | undefined> {
    const db = await this.ensureInitialized();
    const result = await db.get(storeName, id);
    console.log(`[MockDB] Retrieved record from ${storeName}:`, id, result);
    return result;
  }

  /**
   * Update an existing record
   */
  async update<T extends StoreNames>(
    storeName: T,
    id: StoreKey<T>,
    updates: Partial<StoreData<T>>
  ): Promise<StoreData<T> | null> {
    const db = await this.ensureInitialized();
    const tx = db.transaction(storeName, "readwrite");

    try {
      const existing = await tx.objectStore(storeName).get(id);
      if (!existing) {
        return null;
      }

      const updated = { ...existing, ...updates };
      await tx.objectStore(storeName).put(updated);
      await tx.done;

      console.log(`[MockDB] Updated record in ${storeName}:`, id, updates);
      return updated;
    } catch (error) {
      console.error(`[MockDB] Failed to update record in ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   */
  async delete<T extends StoreNames>(storeName: T, id: StoreKey<T>): Promise<boolean> {
    const db = await this.ensureInitialized();
    const tx = db.transaction(storeName, "readwrite");

    try {
      await tx.objectStore(storeName).delete(id);
      await tx.done;
      console.log(`[MockDB] Deleted record from ${storeName}:`, id);
      return true;
    } catch (error) {
      console.error(`[MockDB] Failed to delete record from ${storeName}:`, error);
      return false;
    }
  }

  /**
   * Query records with filters and pagination
   */
  async query<T extends StoreNames>(
    storeName: T,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<StoreData<T>>> {
    const db = await this.ensureInitialized();
    const { limit = 50, offset = 0, orderBy, filters = [] } = options;

    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);

      let cursor;
      let results: StoreData<T>[] = [];

      // Use index if available for first filter
      if (filters.length > 0 && filters[0].operator === "=") {
        const filter = filters[0];
        try {
          const index = store.index(filter.field);
          cursor = await index.openCursor(IDBKeyRange.only(filter.value));
        } catch {
          // Fallback to full scan if index doesn't exist
          cursor = await store.openCursor();
        }
      } else {
        cursor = await store.openCursor();
      }

      // Collect matching records
      while (cursor) {
        const record = cursor.value;

        // Apply all filters
        const matchesFilters = filters.every((filter) => {
          const fieldValue = this.getNestedValue(record, filter.field);
          return this.applyFilter(fieldValue, filter);
        });

        if (matchesFilters) {
          results.push(record);
        }

        cursor = await cursor.continue();
      }

      await tx.done;

      // Apply sorting
      if (orderBy) {
        results.sort((a, b) => {
          const aValue = this.getNestedValue(a, orderBy.field);
          const bValue = this.getNestedValue(b, orderBy.field);

          if (aValue < bValue) return orderBy.direction === "asc" ? -1 : 1;
          if (aValue > bValue) return orderBy.direction === "asc" ? 1 : -1;
          return 0;
        });
      }

      // Apply pagination
      const total = results.length;
      const paginatedResults = results.slice(offset, offset + limit);

      console.log(`[MockDB] Queried ${storeName}: ${paginatedResults.length}/${total} records`);

      return {
        data: paginatedResults,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      };
    } catch (error) {
      console.error(`[MockDB] Failed to query ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Get all records from a store
   */
  async getAll<T extends StoreNames>(storeName: T): Promise<StoreData<T>[]> {
    const db = await this.ensureInitialized();
    const results = await db.getAll(storeName);
    console.log(`[MockDB] Retrieved all records from ${storeName}: ${results.length} records`);
    return results;
  }

  /**
   * Count records in a store with optional filters
   */
  async count<T extends StoreNames>(storeName: T, filters: QueryFilter[] = []): Promise<number> {
    if (filters.length === 0) {
      const db = await this.ensureInitialized();
      return await db.count(storeName);
    }

    // For filtered counts, we need to query and count manually
    const result = await this.query(storeName, { filters, limit: Number.MAX_SAFE_INTEGER });
    return result.total;
  }

  /**
   * Clear all data from a store
   */
  async clear<T extends StoreNames>(storeName: T): Promise<void> {
    const db = await this.ensureInitialized();
    const tx = db.transaction(storeName, "readwrite");
    await tx.objectStore(storeName).clear();
    await tx.done;
    console.log(`[MockDB] Cleared all data from ${storeName}`);
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction<T extends StoreNames[]>(
    storeNames: T,
    mode: TransactionMode,
    operations: (stores: { [K in T[number]]: any }) => Promise<any>
  ): Promise<any> {
    const db = await this.ensureInitialized();
    const tx = db.transaction(storeNames as any, mode);

    try {
      const stores = {} as any;
      storeNames.forEach((name) => {
        stores[name] = tx.objectStore(name);
      });

      const result = await operations(stores);
      await tx.done;

      console.log(`[MockDB] Transaction completed for stores:`, storeNames);
      return result;
    } catch (error) {
      console.error(`[MockDB] Transaction failed for stores:`, storeNames, error);
      throw error;
    }
  }

  /**
   * Check if database has any data
   */
  async isEmpty(): Promise<boolean> {
    const db = await this.ensureInitialized();
    const storeNames = Object.keys(storeConfig) as StoreNames[];

    for (const storeName of storeNames) {
      if (storeName === "sessions" || storeName === "rateLimits" || storeName === "offlineQueue") {
        continue; // Skip utility stores
      }

      const count = await db.count(storeName);
      if (count > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log("[MockDB] Database connection closed");
    }
  }

  /**
   * Helper: Get nested object value by path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  /**
   * Helper: Apply filter to a value
   */
  private applyFilter(value: any, filter: QueryFilter): boolean {
    const { operator, value: filterValue } = filter;

    switch (operator) {
      case "=":
        return value === filterValue;
      case "!=":
        return value !== filterValue;
      case ">":
        return value > filterValue;
      case ">=":
        return value >= filterValue;
      case "<":
        return value < filterValue;
      case "<=":
        return value <= filterValue;
      case "in":
        return Array.isArray(filterValue) && filterValue.includes(value);
      case "like":
        return (
          typeof value === "string" &&
          typeof filterValue === "string" &&
          value.toLowerCase().includes(filterValue.toLowerCase())
        );
      case "between":
        return (
          Array.isArray(filterValue) &&
          filterValue.length === 2 &&
          value >= filterValue[0] &&
          value <= filterValue[1]
        );
      default:
        return true;
    }
  }
}

/**
 * Singleton instance for the application
 */
export const mockDB = new IndexedDBClient();

/**
 * Export types for external use
 */
export type { MockDatabase, PaginatedResult, TransactionMode };
