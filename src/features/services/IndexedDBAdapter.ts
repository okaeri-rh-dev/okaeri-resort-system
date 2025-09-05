/**
 * IndexedDBAdapter for offline storage using Dexie.js
 * Provides a simple interface for IndexedDB operations
 */

import Dexie, { Table } from "dexie";

export interface StoredEntity {
  id?: string;
  _localId?: string;
  _timestamp?: number;
  _syncStatus?: "pending" | "syncing" | "synced" | "failed";
  [key: string]: any;
}

export interface MigrationOptions {
  migrations: {
    [version: number]: (db: Dexie) => Promise<void>;
  };
}

export class IndexedDBAdapter extends Dexie {
  // Define tables
  bookings!: Table<StoredEntity>;
  expenses!: Table<StoredEntity>;
  metrics!: Table<StoredEntity>;
  syncQueue!: Table<StoredEntity>;
  conflicts!: Table<StoredEntity>;
  compliance!: Table<StoredEntity>;

  constructor(dbName: string) {
    super(dbName);

    // Define schema
    this.version(1).stores({
      bookings: "++_localId, id, guestName, checkInDate, syncStatus, _timestamp",
      expenses: "++_localId, id, category, amount, syncStatus, _timestamp",
      metrics: "++_localId, type, projectId, _timestamp",
      syncQueue: "++_localId, type, priority, _timestamp",
      conflicts: "++_localId, entityId, type, _timestamp",
    });

    // Version 2 - Add compliance store and BIR category index
    this.version(2).stores({
      bookings: "++_localId, id, guestName, checkInDate, syncStatus, _timestamp",
      expenses: "++_localId, id, category, amount, syncStatus, _timestamp, birCategory",
      metrics: "++_localId, type, projectId, _timestamp",
      syncQueue: "++_localId, type, priority, _timestamp",
      conflicts: "++_localId, entityId, type, _timestamp",
      compliance: "++_localId, id, type, _timestamp",
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.open();
    } catch (error) {
      console.error("Failed to open IndexedDB:", error);
      throw error;
    }
  }

  async getStores(): Promise<string[]> {
    return this.tables.map((table) => table.name);
  }

  async getIndexes(storeName: string): Promise<string[]> {
    const table = this.table(storeName);
    if (!table) return [];

    return table.schema.indexes.map((index) => index.name);
  }

  async add(storeName: string, data: any): Promise<string> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    const entity: StoredEntity = {
      ...data,
      _timestamp: data._timestamp || Date.now(),
      _syncStatus: data._syncStatus || "pending",
    };

    const id = await table.add(entity);
    return String(id);
  }

  async get(storeName: string, id: string): Promise<any> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    return await table.get(id);
  }

  async getAll(storeName: string): Promise<any[]> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    return await table.toArray();
  }

  async update(storeName: string, id: string, data: any): Promise<void> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    await table.update(id, {
      ...data,
      _timestamp: Date.now(),
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    await table.delete(id);
  }

  async clear(storeName?: string): Promise<void> {
    if (storeName) {
      const table = this.table(storeName);
      if (table) await table.clear();
    } else {
      // Clear all stores
      await Promise.all(this.tables.map((table) => table.clear()));
    }
  }

  async bulkAdd(storeName: string, items: any[]): Promise<void> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    const entities = items.map((item) => ({
      ...item,
      _timestamp: item._timestamp || Date.now(),
      _syncStatus: item._syncStatus || "pending",
    }));

    await table.bulkAdd(entities);
  }

  async query(storeName: string, filter: any): Promise<any[]> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    let collection = table.toCollection();

    // Apply filters
    Object.keys(filter).forEach((key) => {
      collection = collection.filter((item) => item[key] === filter[key]);
    });

    return await collection.toArray();
  }

  async count(storeName: string): Promise<number> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    return await table.count();
  }

  async getOldData(storeName: string, daysOld: number): Promise<any[]> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    return await table.where("_timestamp").below(cutoffTime).toArray();
  }

  async deleteOldData(
    storeName: string,
    daysOld: number,
    keepUnsynced: boolean = true
  ): Promise<number> {
    const table = this.table(storeName);
    if (!table) throw new Error(`Store ${storeName} does not exist`);

    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    let collection = table.where("_timestamp").below(cutoffTime);

    if (keepUnsynced) {
      collection = collection.filter((item) => item._syncStatus === "synced");
    }

    return await collection.delete();
  }

  async getUsageInfo(): Promise<{ usage: number; quota: number }> {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0,
      };
    }

    // Fallback for browsers that don't support storage API
    return {
      usage: 0,
      quota: 0,
    };
  }

  async migrate(
    oldVersion: number,
    newVersion: number,
    options: MigrationOptions
  ): Promise<{ success: boolean; version: number }> {
    try {
      // Dexie handles migrations automatically based on version definitions
      // This method is for additional custom migration logic

      for (let v = oldVersion + 1; v <= newVersion; v++) {
        if (options.migrations[v]) {
          await options.migrations[v](this);
        }
      }

      return {
        success: true,
        version: newVersion,
      };
    } catch (error) {
      console.error("Migration failed:", error);
      return {
        success: false,
        version: oldVersion,
      };
    }
  }

  async transaction<T>(
    storeNames: string[],
    mode: "readonly" | "readwrite",
    callback: (tx: Dexie.Transaction) => Promise<T>
  ): Promise<T> {
    return await this.transaction(mode, ...storeNames.map((name) => this.table(name)), callback);
  }

  async createIndex(storeName: string, indexName: string, keyPath: string): Promise<void> {
    // Note: In Dexie, indexes are defined in the schema during version upgrades
    // This would require a new version to be defined
    console.warn("Dynamic index creation requires a version upgrade in Dexie");
  }

  async createObjectStore(storeName: string, options: { keyPath: string }): Promise<void> {
    // Note: In Dexie, stores are defined in the schema during version upgrades
    // This would require a new version to be defined
    console.warn("Dynamic store creation requires a version upgrade in Dexie");
  }
}
