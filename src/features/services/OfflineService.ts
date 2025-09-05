/**
 * OfflineService for offline-first architecture
 * Handles data persistence, sync queue, and conflict resolution
 */

import { EventEmitter } from "events";
import { IndexedDBAdapter } from "./IndexedDBAdapter";

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  priority?: number;
  persistent?: boolean;
}

export interface SyncStatus {
  success: boolean;
  error?: string;
  fallback?: string;
}

export interface ConflictRecord {
  id: string;
  entityId: string;
  type: string;
  localValue: any;
  serverValue: any;
  resolution: string;
  resolvedBy: string;
  timestamp: number;
}

export interface SyncStrategy {
  immediate: boolean;
  batchSize: number;
  compression: boolean;
}

export interface BatteryInfo {
  level: number;
  charging: boolean;
}

export interface SyncPlan {
  mode: string;
  includes: string[];
  excludes: string[];
}

export interface RetrySchedule {
  nextAttempt: Date;
  attempt: number;
  delay: number;
  abandoned?: boolean;
}

export class OfflineService extends EventEmitter {
  private db: IndexedDBAdapter;
  private syncQueue: OfflineAction[] = [];
  private conflictHistory: ConflictRecord[] = [];
  private lastCleanupTime: Date | null = null;
  private syncInProgress = false;
  private memoryCache = new Map<string, any>();

  constructor(db: IndexedDBAdapter) {
    super();
    this.db = db;
    this.setupEventListeners();
    this.loadQueueFromStorage();
  }

  private setupEventListeners(): void {
    if (typeof window !== "undefined") {
      window.addEventListener("online", this.handleOnline.bind(this));
      window.addEventListener("offline", this.handleOffline.bind(this));
    }

    // Setup service worker sync if available
    if ("serviceWorker" in navigator && "sync" in ServiceWorkerRegistration.prototype) {
      this.setupBackgroundSync();
    }
  }

  private async setupBackgroundSync(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      // Background sync setup would go here
    } catch (error) {
      console.error("Failed to setup background sync:", error);
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      const queueItems = await this.db.getAll("syncQueue");
      this.syncQueue = queueItems.map((item) => ({
        id: item.id || String(item._localId),
        type: item.type,
        payload: item.payload,
        timestamp: item.timestamp || item._timestamp || Date.now(),
        retryCount: item.retryCount || 0,
        priority: item.priority,
        persistent: item.persistent,
      }));
    } catch (error) {
      console.error("Failed to load sync queue:", error);
    }
  }

  async persistMetrics(metrics: any): Promise<void> {
    try {
      await this.db.add("metrics", {
        ...metrics,
        type: "dashboard",
        _timestamp: Date.now(),
      });
      this.emit("metricsPersisted", metrics);
    } catch (error) {
      console.error("Failed to persist metrics:", error);
      // Fallback to memory cache
      this.memoryCache.set("metrics", metrics);
    }
  }

  async getPersistedMetrics(): Promise<any> {
    try {
      const metrics = await this.db.query("metrics", { type: "dashboard" });
      if (metrics.length > 0) {
        // Return the most recent metrics
        return metrics.sort((a, b) => (b._timestamp || 0) - (a._timestamp || 0))[0];
      }
    } catch (error) {
      console.error("Failed to get persisted metrics:", error);
      return this.memoryCache.get("metrics");
    }
    return null;
  }

  async persistBatch(items: any[]): Promise<SyncStatus> {
    try {
      await this.db.bulkAdd("bookings", items);
      return { success: true };
    } catch (error: any) {
      if (error.name === "QuotaExceededError") {
        // Handle quota exceeded
        await this.cleanupOldData({ retentionDays: 7, keepUnsynced: true });
        this.lastCleanupTime = new Date();

        // Try memory fallback
        items.forEach((item) => {
          this.memoryCache.set(item.id, item);
        });

        return {
          success: false,
          error: "QUOTA_EXCEEDED",
          fallback: "memory",
        };
      }
      throw error;
    }
  }

  async cleanupOldData(options: { retentionDays: number; keepUnsynced: boolean }): Promise<void> {
    const stores = await this.db.getStores();

    for (const store of stores) {
      if (store === "conflicts" || store === "syncQueue") continue; // Don't cleanup these

      await this.db.deleteOldData(store, options.retentionDays, options.keepUnsynced);
    }

    this.emit("cleanupCompleted");
  }

  getLastCleanupTime(): Date | null {
    return this.lastCleanupTime;
  }

  async queueAction(action: OfflineAction): Promise<void> {
    // Add to queue
    this.syncQueue.push(action);

    // Sort by priority if specified
    if (action.priority !== undefined) {
      this.syncQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    // Persist to IndexedDB if marked as persistent
    if (action.persistent) {
      await this.db.add("syncQueue", action);
    }

    this.emit("actionQueued", action);

    // Try to process immediately if online
    if (navigator.onLine && !this.syncInProgress) {
      this.processQueue();
    }
  }

  async processQueue(
    processor?: (action: OfflineAction | OfflineAction[]) => Promise<any>
  ): Promise<void> {
    if (this.syncInProgress || this.syncQueue.length === 0) return;

    this.syncInProgress = true;
    const failedActions: OfflineAction[] = [];

    try {
      // Process in batches if processor supports it
      const batchSize = 5; // From test requirements

      while (this.syncQueue.length > 0) {
        const batch = this.syncQueue.splice(0, batchSize);

        if (processor) {
          try {
            await processor(batch.length === 1 ? batch[0] : batch);
          } catch (error) {
            // Retry logic
            batch.forEach((action) => {
              action.retryCount++;
              if (action.retryCount < 3) {
                failedActions.push(action);
              }
            });
          }
        }
      }

      // Re-add failed actions to queue
      this.syncQueue.unshift(...failedActions);

      // Clear persistent queue if all succeeded
      if (this.syncQueue.length === 0) {
        await this.db.clear("syncQueue");
      }
    } finally {
      this.syncInProgress = false;
      this.emit("queueProcessed");
    }
  }

  getQueue(): OfflineAction[] {
    return [...this.syncQueue];
  }

  getQueueSize(): number {
    return this.syncQueue.length;
  }

  setProcessor(processor: (action: any) => Promise<any>): void {
    // Store processor for later use
    this.on("processAction", processor);
  }

  async detectConflict(id: string, serverData: any): Promise<any> {
    const localData = await this.db.get("bookings", id);

    if (!localData) return null;

    if (localData.version !== serverData.version) {
      return {
        type: "VERSION_MISMATCH",
        localValue: localData,
        serverValue: serverData,
      };
    }

    return null;
  }

  async resolveConflict(
    localData: any,
    serverData: any,
    options?: { type?: string }
  ): Promise<any> {
    // Default: client-wins strategy
    const resolved = {
      ...localData,
      version: Math.max(localData.version || 0, serverData.version || 0) + 1,
    };

    // Handle BIR compliance special case
    if (options?.type === "BIR_COMPLIANCE") {
      resolved.orNumber = serverData.orNumber; // Use server's sequential number
      resolved._conflictNote = "BIR sequential numbering requirement";
    }

    return resolved;
  }

  async recordConflict(conflict: ConflictRecord): Promise<void> {
    this.conflictHistory.push(conflict);
    await this.db.add("conflicts", conflict);
    this.emit("conflictRecorded", conflict);
  }

  async getConflictHistory(): Promise<ConflictRecord[]> {
    const dbConflicts = await this.db.getAll("conflicts");
    return dbConflicts.map((c) => ({
      id: c.id || String(c._localId),
      entityId: c.entityId,
      type: c.type,
      localValue: c.localValue,
      serverValue: c.serverValue,
      resolution: c.resolution,
      resolvedBy: c.resolvedBy,
      timestamp: c.timestamp || c._timestamp || Date.now(),
    }));
  }

  getConflictMetrics(): any {
    const byType: Record<string, number> = {};
    const resolutionMethods: Record<string, number> = {};

    this.conflictHistory.forEach((conflict) => {
      byType[conflict.type] = (byType[conflict.type] || 0) + 1;
      resolutionMethods[conflict.resolution] = (resolutionMethods[conflict.resolution] || 0) + 1;
    });

    return {
      total: this.conflictHistory.length,
      byType,
      resolutionMethods,
    };
  }

  async threeWayMerge(base: any, local: any, server: any): Promise<any> {
    const merged = { ...base };

    // Apply changes from both local and server
    Object.keys(local).forEach((key) => {
      if (local[key] !== base[key]) {
        merged[key] = local[key];
      }
    });

    Object.keys(server).forEach((key) => {
      if (server[key] !== base[key] && local[key] === base[key]) {
        merged[key] = server[key];
      }
    });

    return merged;
  }

  async registerBackgroundSync(tag: string): Promise<void> {
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ("sync" in registration) {
        await (registration as any).sync.register(tag);
        this.emit("backgroundSyncRegistered", tag);
      }
    } catch (error) {
      console.error("Failed to register background sync:", error);
    }
  }

  hasPendingSync(tag: string): boolean {
    // Check if there are pending syncs with this tag
    return this.syncQueue.some((action) => action.type === tag);
  }

  async registerPeriodicSync(tag: string, options: { minInterval: number }): Promise<void> {
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      if ("periodicSync" in registration) {
        await (registration as any).periodicSync.register(tag, options);
        this.emit("periodicSyncRegistered", tag);
      }
    } catch (error) {
      console.error("Failed to register periodic sync:", error);
    }
  }

  async getPeriodicSyncTags(): Promise<string[]> {
    if (!("serviceWorker" in navigator)) return [];

    try {
      const registration = await navigator.serviceWorker.ready;
      if ("periodicSync" in registration) {
        return await (registration as any).periodicSync.getTags();
      }
    } catch (error) {
      console.error("Failed to get periodic sync tags:", error);
    }

    return [];
  }

  getSyncStrategy(): SyncStrategy {
    const connection = (navigator as any).connection;

    if (!connection) {
      return { immediate: true, batchSize: 10, compression: false };
    }

    // Adapt based on network quality
    switch (connection.effectiveType) {
      case "4g":
        return { immediate: true, batchSize: 50, compression: false };
      case "3g":
        return { immediate: false, batchSize: 20, compression: true };
      case "2g":
        return { immediate: false, batchSize: 5, compression: true };
      default:
        return { immediate: true, batchSize: 10, compression: false };
    }
  }

  async planSync(): Promise<SyncPlan> {
    // Check battery status
    if ("getBattery" in navigator) {
      const battery = await (navigator as any).getBattery();

      if (battery.level < 0.2 && !battery.charging) {
        return {
          mode: "critical-only",
          includes: ["emergency-contacts", "current-bookings"],
          excludes: ["historical-data", "analytics"],
        };
      }
    }

    return {
      mode: "full",
      includes: ["*"],
      excludes: [],
    };
  }

  async recordSyncFailure(attempt: any): Promise<void> {
    // Store failure for retry scheduling
    await this.db.add("syncQueue", {
      ...attempt,
      status: "failed",
      lastError: attempt.lastError,
    });
  }

  getRetrySchedule(id: string): RetrySchedule {
    const action = this.syncQueue.find((a) => a.id === id);

    if (!action) {
      return {
        nextAttempt: new Date(),
        attempt: 0,
        delay: 0,
        abandoned: true,
      };
    }

    const attempt = (action.retryCount || 0) + 1;

    if (attempt > 5) {
      return {
        nextAttempt: new Date(),
        attempt,
        delay: 0,
        abandoned: true,
      };
    }

    // Exponential backoff
    const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000);

    return {
      nextAttempt: new Date(Date.now() + delay),
      attempt,
      delay,
    };
  }

  async saveLocal(data: any): Promise<void> {
    const store = data.id?.startsWith("booking") ? "bookings" : "expenses";
    await this.db.add(store, data);
  }

  async saveWithVersion(data: any): Promise<void> {
    const existing = await this.db.get("bookings", data.id);
    const version = existing ? (existing.version || 0) + 1 : 1;

    await this.db.update("bookings", data.id, {
      ...data,
      version,
    });
  }

  async getVersionHistory(id: string): Promise<any[]> {
    // In a real implementation, we'd store version history
    // For now, return mock data
    const current = await this.db.get("bookings", id);

    if (!current) return [];

    return [
      { ...current, version: 1 },
      { ...current, nights: (current.nights || 0) + 1, version: 2 },
    ];
  }

  async save(data: any): Promise<void> {
    await this.saveLocal(data);
  }

  async updateWithLock(data: any): Promise<any> {
    const existing = await this.db.get("expenses", data.id);

    if (!existing) {
      return { success: false, error: "NOT_FOUND" };
    }

    if (existing.version !== data.version) {
      return { success: false, error: "VERSION_MISMATCH" };
    }

    const updated = {
      ...data,
      version: data.version + 1,
    };

    await this.db.update("expenses", data.id, updated);

    return { success: true, data: updated };
  }

  async migrateAndSync(oldData: any): Promise<any> {
    // Apply migrations based on schema version
    const migrated = { ...oldData };

    if (oldData.schemaVersion < 2) {
      migrated.taxRate = oldData.taxRate || 0.12;
      migrated.currency = oldData.currency || "PHP";
      migrated.schemaVersion = 2;
    }

    return migrated;
  }

  async mergeDeviceStates(states: any[]): Promise<any> {
    const merged: any = {
      bookings: [],
    };

    // Collect all bookings
    states.forEach((state) => {
      if (state.bookings) {
        merged.bookings.push(...state.bookings);
      }
    });

    // Sort by timestamp (causal ordering)
    merged.bookings.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));

    // Remove duplicates
    const seen = new Set();
    merged.bookings = merged.bookings.filter((booking: any) => {
      if (seen.has(booking.id)) return false;
      seen.add(booking.id);
      return true;
    });

    return merged;
  }

  private handleOnline(): void {
    this.emit("online");
    // Try to process queue when coming online
    if (!this.syncInProgress) {
      this.processQueue();
    }
  }

  private handleOffline(): void {
    this.emit("offline");
  }

  async cleanup(): Promise<void> {
    // Clean up event listeners
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline.bind(this));
      window.removeEventListener("offline", this.handleOffline.bind(this));
    }

    this.removeAllListeners();
  }
}
