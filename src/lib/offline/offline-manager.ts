/**
 * Phase 5.3: Enhanced Offline Manager
 * Provides comprehensive offline capabilities with background sync
 * Optimized for resort management operations
 */

import { getCache } from "@/lib/cache/multi-layer-cache";

interface QueuedOperation {
  id: string;
  type: "expense" | "booking" | "sync";
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

interface OfflineState {
  isOnline: boolean;
  lastSync: number;
  queuedOperations: QueuedOperation[];
  syncInProgress: boolean;
}

/**
 * Enhanced offline manager with background sync
 */
export class OfflineManager {
  private state: OfflineState = {
    isOnline: navigator.onLine,
    lastSync: Date.now(),
    queuedOperations: [],
    syncInProgress: false,
  };

  private listeners = new Set<(state: OfflineState) => void>();
  private syncWorker: ServiceWorker | null = null;

  constructor() {
    this.initializeOfflineHandling();
    this.setupEventListeners();
    this.loadQueuedOperations();
  }

  /**
   * Initialize offline handling
   */
  private initializeOfflineHandling(): void {
    // Register for background sync if supported
    if ("serviceWorker" in navigator && "sync" in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready
        .then((registration) => {
          this.syncWorker = registration.active;

          // Register for background sync
          return registration.sync.register("background-sync");
        })
        .catch((error) => {
          console.warn("Background sync registration failed:", error);
        });
    }

    // Setup periodic sync for foreground
    this.setupPeriodicSync();
  }

  /**
   * Setup event listeners for online/offline state
   */
  private setupEventListeners(): void {
    window.addEventListener("online", () => {
      this.updateOnlineState(true);
      this.syncQueuedOperations();
    });

    window.addEventListener("offline", () => {
      this.updateOnlineState(false);
    });

    // Listen for visibility change to sync when app becomes visible
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && this.state.isOnline && this.state.queuedOperations.length > 0) {
        this.syncQueuedOperations();
      }
    });

    // Listen for service worker messages
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "SYNC_COMPLETE") {
          this.handleSyncComplete(event.data.results);
        }
      });
    }
  }

  /**
   * Update online state and notify listeners
   */
  private updateOnlineState(isOnline: boolean): void {
    this.state.isOnline = isOnline;
    this.notifyListeners();

    // Show user notification
    if (isOnline) {
      this.showNotification("🟢 Back online! Syncing data...", "success");
    } else {
      this.showNotification("🔴 Working offline. Changes will sync when reconnected.", "warning");
    }
  }

  /**
   * Queue operation for later sync
   */
  public queueOperation(type: QueuedOperation["type"], data: any, maxRetries: number = 3): string {
    const operation: QueuedOperation = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    this.state.queuedOperations.push(operation);
    this.saveQueuedOperations();
    this.notifyListeners();

    // If online, try to sync immediately
    if (this.state.isOnline) {
      setTimeout(() => this.syncQueuedOperations(), 1000);
    }

    return operation.id;
  }

  /**
   * Sync queued operations
   */
  public async syncQueuedOperations(): Promise<void> {
    if (
      !this.state.isOnline ||
      this.state.syncInProgress ||
      this.state.queuedOperations.length === 0
    ) {
      return;
    }

    this.state.syncInProgress = true;
    this.notifyListeners();

    const results = await Promise.allSettled(
      this.state.queuedOperations.map(async (operation) => {
        try {
          await this.syncOperation(operation);
          return { operation, success: true };
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
          operation.retryCount++;
          return { operation, success: false, error };
        }
      })
    );

    // Process results
    const syncedOperations = new Set<string>();
    const failedOperations: QueuedOperation[] = [];

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const { operation, success } = result.value;
        if (success) {
          syncedOperations.add(operation.id);
        } else if (operation.retryCount < operation.maxRetries) {
          failedOperations.push(operation);
        }
      }
    });

    // Remove synced operations and keep failed ones for retry
    this.state.queuedOperations = failedOperations;
    this.state.lastSync = Date.now();
    this.state.syncInProgress = false;

    this.saveQueuedOperations();
    this.notifyListeners();

    if (syncedOperations.size > 0) {
      this.showNotification(`✅ Synced ${syncedOperations.size} offline changes`, "success");
    }

    if (failedOperations.length > 0) {
      this.showNotification(
        `⚠️ ${failedOperations.length} operations failed to sync. Will retry automatically.`,
        "warning"
      );
    }
  }

  /**
   * Sync individual operation
   */
  private async syncOperation(operation: QueuedOperation): Promise<void> {
    const { type, data } = operation;

    switch (type) {
      case "expense":
        await this.syncExpense(data);
        break;
      case "booking":
        await this.syncBooking(data);
        break;
      case "sync":
        await this.syncGenericData(data);
        break;
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  /**
   * Sync expense data
   */
  private async syncExpense(data: any): Promise<void> {
    const response = await fetch("/api/expenses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync expense: ${response.status}`);
    }

    // Invalidate related caches
    const cache = getCache();
    await cache.invalidateByTags(["financial", "expense"]);
  }

  /**
   * Sync booking data
   */
  private async syncBooking(data: any): Promise<void> {
    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync booking: ${response.status}`);
    }

    // Invalidate related caches
    const cache = getCache();
    await cache.invalidateByTags(["booking", "dashboard"]);
  }

  /**
   * Sync generic data
   */
  private async syncGenericData(data: any): Promise<void> {
    const { endpoint, method = "POST", payload } = data;

    const response = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to sync data: ${response.status}`);
    }
  }

  /**
   * Setup periodic sync for foreground operation
   */
  private setupPeriodicSync(): void {
    setInterval(() => {
      if (this.state.isOnline && this.state.queuedOperations.length > 0) {
        this.syncQueuedOperations();
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle sync completion from service worker
   */
  private handleSyncComplete(results: any): void {
    console.log("Background sync completed:", results);
    // Update UI if needed
  }

  /**
   * Save queued operations to localStorage
   */
  private saveQueuedOperations(): void {
    try {
      localStorage.setItem("offline-queue", JSON.stringify(this.state.queuedOperations));
    } catch (error) {
      console.error("Failed to save queued operations:", error);
    }
  }

  /**
   * Load queued operations from localStorage
   */
  private loadQueuedOperations(): void {
    try {
      const saved = localStorage.getItem("offline-queue");
      if (saved) {
        this.state.queuedOperations = JSON.parse(saved);

        // Clean up old operations (older than 7 days)
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        this.state.queuedOperations = this.state.queuedOperations.filter(
          (op) => op.timestamp > weekAgo
        );

        this.saveQueuedOperations();
      }
    } catch (error) {
      console.error("Failed to load queued operations:", error);
      this.state.queuedOperations = [];
    }
  }

  /**
   * Show notification to user
   */
  private showNotification(message: string, type: "success" | "warning" | "error"): void {
    // This would integrate with your notification system
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Create a simple toast notification
    if (typeof window !== "undefined") {
      const toast = document.createElement("div");
      toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
        type === "success"
          ? "bg-green-500 text-white"
          : type === "warning"
            ? "bg-yellow-500 text-black"
            : "bg-red-500 text-white"
      }`;
      toast.textContent = message;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.remove();
      }, 5000);
    }
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get current state
   */
  public getState(): OfflineState {
    return { ...this.state };
  }

  /**
   * Check if specific data type can work offline
   */
  public canWorkOffline(dataType: string): boolean {
    const offlineCapableTypes = ["expense", "booking", "note"];
    return offlineCapableTypes.includes(dataType);
  }

  /**
   * Force sync all operations
   */
  public async forcSync(): Promise<void> {
    if (this.state.isOnline) {
      await this.syncQueuedOperations();
    }
  }

  /**
   * Clear all queued operations (use with caution)
   */
  public clearQueue(): void {
    this.state.queuedOperations = [];
    this.saveQueuedOperations();
    this.notifyListeners();
  }

  /**
   * Get statistics about offline operations
   */
  public getStats(): {
    queuedCount: number;
    oldestOperation: number | null;
    lastSync: number;
    syncInProgress: boolean;
  } {
    const oldestOperation =
      this.state.queuedOperations.length > 0
        ? Math.min(...this.state.queuedOperations.map((op) => op.timestamp))
        : null;

    return {
      queuedCount: this.state.queuedOperations.length,
      oldestOperation,
      lastSync: this.state.lastSync,
      syncInProgress: this.state.syncInProgress,
    };
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error("Error in offline state listener:", error);
      }
    });
  }
}

// Create singleton instance
let offlineManager: OfflineManager | null = null;

export function getOfflineManager(): OfflineManager {
  if (!offlineManager && typeof window !== "undefined") {
    offlineManager = new OfflineManager();
  }
  return offlineManager!;
}

/**
 * React hook for using offline manager
 */
export function useOfflineManager() {
  const [state, setState] = React.useState<OfflineState | null>(null);

  React.useEffect(() => {
    const manager = getOfflineManager();
    if (manager) {
      setState(manager.getState());
      return manager.subscribe(setState);
    }
  }, []);

  return {
    state,
    queueOperation: (type: QueuedOperation["type"], data: any) =>
      getOfflineManager()?.queueOperation(type, data),
    syncNow: () => getOfflineManager()?.forcSync(),
    canWorkOffline: (dataType: string) => getOfflineManager()?.canWorkOffline(dataType),
    getStats: () => getOfflineManager()?.getStats(),
  };
}
