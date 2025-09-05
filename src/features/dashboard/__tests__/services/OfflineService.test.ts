import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import "fake-indexeddb/auto";

// Use existing test utilities
import { DashboardTestProvider } from "../../../../../tests/utils/dashboard-providers";
import { DashboardMockDataGenerator } from "../../../../../tests/utils/dashboard-mocks";

// Import the implemented services and hooks
import { OfflineService } from "../../services/OfflineService";
import { useOfflineSync } from "../../hooks/useOfflineSync";
import { useOfflineQueue } from "../../hooks/useOfflineQueue";
import { IndexedDBAdapter } from "../../services/IndexedDBAdapter";
import type { OfflineAction, SyncStatus } from "../../types/offline";

describe("Offline-First Architecture Tests", () => {
  let offlineService: OfflineService;
  let indexedDB: IndexedDBAdapter;
  let mockGenerator: DashboardMockDataGenerator;

  beforeEach(async () => {
    // Initialize IndexedDB
    indexedDB = new IndexedDBAdapter("okaeri-resort-offline");
    await indexedDB.initialize();

    offlineService = new OfflineService(indexedDB);
    mockGenerator = new DashboardMockDataGenerator();

    // Reset network status
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  afterEach(async () => {
    await indexedDB.clear();
    vi.clearAllMocks();
  });

  describe("IndexedDB Storage (5 tests)", () => {
    it("should initialize IndexedDB with proper schema", async () => {
      const stores = await indexedDB.getStores();

      expect(stores).toContain("bookings");
      expect(stores).toContain("expenses");
      expect(stores).toContain("metrics");
      expect(stores).toContain("syncQueue");
      expect(stores).toContain("conflicts");

      // Verify indexes
      const bookingIndexes = await indexedDB.getIndexes("bookings");
      expect(bookingIndexes).toContain("guestName");
      expect(bookingIndexes).toContain("checkInDate");
      expect(bookingIndexes).toContain("syncStatus");
    });

    it("should persist dashboard data to IndexedDB", async () => {
      const metrics = mockGenerator.createDashboardMetrics({
        occupancyRate: 85,
        checkInsToday: 10,
        revenue: 125000,
      });

      await offlineService.persistMetrics(metrics);

      const retrieved = await offlineService.getPersistedMetrics();

      expect(retrieved).toMatchObject({
        occupancyRate: 85,
        checkInsToday: 10,
        revenue: 125000,
      });
      expect(retrieved._localId).toBeDefined();
      expect(retrieved._timestamp).toBeDefined();
    });

    it("should handle IndexedDB quota exceeded errors", async () => {
      // Mock quota exceeded
      const originalAdd = indexedDB.add;
      indexedDB.add = vi.fn().mockRejectedValue(new DOMException("QuotaExceededError"));

      const largeData = Array.from({ length: 1000 }, (_, i) =>
        mockGenerator.createBooking({ id: `booking-${i}` })
      );

      const result = await offlineService.persistBatch(largeData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("QUOTA_EXCEEDED");
      expect(result.fallback).toBe("memory");

      // Should attempt cleanup
      expect(offlineService.getLastCleanupTime()).toBeDefined();

      indexedDB.add = originalAdd;
    });

    it("should implement data expiration and cleanup", async () => {
      // Add old data
      const oldBooking = {
        ...mockGenerator.createBooking(),
        _timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days old
        _syncStatus: "synced",
      };

      const recentBooking = {
        ...mockGenerator.createBooking(),
        _timestamp: Date.now() - 1 * 60 * 60 * 1000, // 1 hour old
        _syncStatus: "synced",
      };

      await indexedDB.add("bookings", oldBooking);
      await indexedDB.add("bookings", recentBooking);

      // Run cleanup (7 day retention for synced data)
      await offlineService.cleanupOldData({
        retentionDays: 7,
        keepUnsynced: true,
      });

      const remaining = await indexedDB.getAll("bookings");

      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(recentBooking.id);
    });

    it("should support database migrations", async () => {
      // Simulate version upgrade
      const oldVersion = 1;
      const newVersion = 2;

      const migrationResult = await indexedDB.migrate(oldVersion, newVersion, {
        migrations: {
          2: async (db) => {
            // Add new index for Philippine tax compliance
            await db.createIndex("expenses", "birCategory", "birCategory");
            await db.createObjectStore("compliance", { keyPath: "id" });
          },
        },
      });

      expect(migrationResult.success).toBe(true);
      expect(migrationResult.version).toBe(2);

      const stores = await indexedDB.getStores();
      expect(stores).toContain("compliance");

      const expenseIndexes = await indexedDB.getIndexes("expenses");
      expect(expenseIndexes).toContain("birCategory");
    });
  });

  describe("Offline Queue Management (6 tests)", () => {
    it("should queue actions when offline", async () => {
      const { result } = renderHook(() => useOfflineQueue());

      // Go offline
      act(() => {
        Object.defineProperty(navigator, "onLine", {
          writable: true,
          value: false,
        });
        window.dispatchEvent(new Event("offline"));
      });

      const booking = mockGenerator.createBooking();

      await act(async () => {
        await result.current.queueAction({
          type: "CREATE_BOOKING",
          payload: booking,
          timestamp: Date.now(),
        });
      });

      expect(result.current.queueSize).toBe(1);
      expect(result.current.isOffline).toBe(true);

      const queue = await result.current.getQueue();
      expect(queue[0]).toMatchObject({
        type: "CREATE_BOOKING",
        payload: expect.objectContaining({ id: booking.id }),
        status: "pending",
      });
    });

    it("should process queue when coming online", async () => {
      const processFn = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(() => useOfflineQueue({ processor: processFn }));

      // Add items while offline
      act(() => {
        Object.defineProperty(navigator, "onLine", { value: false });
      });

      await act(async () => {
        await result.current.queueAction({
          type: "UPDATE_METRICS",
          payload: { occupancyRate: 90 },
        });
        await result.current.queueAction({
          type: "LOG_EXPENSE",
          payload: { amount: 5000, category: "utilities" },
        });
      });

      expect(result.current.queueSize).toBe(2);

      // Come back online
      act(() => {
        Object.defineProperty(navigator, "onLine", { value: true });
        window.dispatchEvent(new Event("online"));
      });

      await waitFor(() => {
        expect(processFn).toHaveBeenCalledTimes(2);
        expect(result.current.queueSize).toBe(0);
      });
    });

    it("should handle queue processing failures with retry", async () => {
      let attempts = 0;
      const processFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Server error"));
        }
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(() =>
        useOfflineQueue({
          processor: processFn,
          maxRetries: 3,
          retryDelay: 100,
        })
      );

      await act(async () => {
        await result.current.queueAction({
          type: "CREATE_BOOKING",
          payload: { id: "123" },
        });
      });

      // Process with retries
      await act(async () => {
        await result.current.processQueue();
      });

      expect(processFn).toHaveBeenCalledTimes(3);
      expect(result.current.queueSize).toBe(0);
    });

    it("should prioritize critical actions in queue", async () => {
      const processOrder: string[] = [];
      const processFn = vi.fn().mockImplementation((action) => {
        processOrder.push(action.type);
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(() => useOfflineQueue({ processor: processFn }));

      await act(async () => {
        await result.current.queueAction({
          type: "UPDATE_SETTINGS",
          priority: 1,
          payload: {},
        });
        await result.current.queueAction({
          type: "EMERGENCY_CONTACT",
          priority: 10, // Highest priority
          payload: { emergency: true },
        });
        await result.current.queueAction({
          type: "LOG_EXPENSE",
          priority: 5,
          payload: {},
        });
      });

      await act(async () => {
        await result.current.processQueue();
      });

      // Should process in priority order
      expect(processOrder).toEqual(["EMERGENCY_CONTACT", "LOG_EXPENSE", "UPDATE_SETTINGS"]);
    });

    it("should implement queue persistence across sessions", async () => {
      const { result, unmount } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.queueAction({
          type: "CREATE_BOOKING",
          payload: { id: "persist-123" },
          persistent: true,
        });
      });

      expect(result.current.queueSize).toBe(1);

      // Simulate app restart
      unmount();

      // Create new instance
      const { result: newResult } = renderHook(() => useOfflineQueue());

      await waitFor(() => {
        expect(newResult.current.queueSize).toBe(1);
      });

      const queue = await newResult.current.getQueue();
      expect(queue[0].payload.id).toBe("persist-123");
    });

    it("should handle typhoon mode queue batching", async () => {
      const { result } = renderHook(() =>
        useOfflineQueue({
          typhoonMode: true,
          batchSize: 5,
          batchDelay: 1000,
        })
      );

      // Simulate typhoon conditions (intermittent connectivity)
      act(() => {
        Object.defineProperty(navigator, "onLine", { value: false });
      });

      // Queue many actions
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          await result.current.queueAction({
            type: "LOG_EXPENSE",
            payload: { amount: 100 * i },
          });
        });
      }

      expect(result.current.queueSize).toBe(20);

      // Brief connectivity window
      act(() => {
        Object.defineProperty(navigator, "onLine", { value: true });
      });

      const processBatch = vi.fn().mockResolvedValue({ success: true });
      result.current.setProcessor(processBatch);

      await act(async () => {
        await result.current.processQueue();
      });

      // Should process in batches
      expect(processBatch).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ type: "LOG_EXPENSE" })])
      );
      expect(processBatch.mock.calls[0][0]).toHaveLength(5); // Batch size
    });
  });

  describe("Conflict Resolution (5 tests)", () => {
    it("should detect conflicts between local and server data", async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Set local data
      await act(async () => {
        await result.current.saveLocal({
          id: "booking-123",
          version: 1,
          guest: "Juan Dela Cruz",
          nights: 3,
        });
      });

      // Simulate server response with different data
      const serverData = {
        id: "booking-123",
        version: 2,
        guest: "Juan Dela Cruz",
        nights: 2, // Different value
      };

      const conflict = await result.current.detectConflict("booking-123", serverData);

      expect(conflict).toBeDefined();
      expect(conflict.type).toBe("VERSION_MISMATCH");
      expect(conflict.localValue).toMatchObject({ nights: 3 });
      expect(conflict.serverValue).toMatchObject({ nights: 2 });
    });

    it("should apply conflict resolution strategies", async () => {
      const { result } = renderHook(() =>
        useOfflineSync({
          conflictStrategy: "client-wins",
        })
      );

      const localData = {
        id: "expense-456",
        amount: 5000,
        category: "supplies",
        version: 1,
      };

      const serverData = {
        id: "expense-456",
        amount: 4500,
        category: "utilities",
        version: 2,
      };

      const resolved = await result.current.resolveConflict(localData, serverData);

      // Client wins strategy
      expect(resolved).toMatchObject({
        amount: 5000,
        category: "supplies",
        version: 3, // New version after resolution
      });
    });

    it("should implement three-way merge for complex conflicts", async () => {
      const { result } = renderHook(() =>
        useOfflineSync({
          conflictStrategy: "three-way-merge",
        })
      );

      const baseData = {
        booking: {
          id: "789",
          guest: "Maria Santos",
          room: "201",
          nights: 2,
          breakfast: false,
        },
      };

      const localChanges = {
        booking: {
          ...baseData.booking,
          nights: 3, // Changed locally
          breakfast: true, // Changed locally
        },
      };

      const serverChanges = {
        booking: {
          ...baseData.booking,
          room: "202", // Changed on server
          breakfast: true, // Same change as local
        },
      };

      const merged = await result.current.threeWayMerge(baseData, localChanges, serverChanges);

      expect(merged.booking).toMatchObject({
        nights: 3, // Local change preserved
        room: "202", // Server change preserved
        breakfast: true, // Both agreed
        guest: "Maria Santos", // Unchanged
      });
    });

    it("should track and display conflict history", async () => {
      const { result } = renderHook(() => useOfflineSync());

      await act(async () => {
        await result.current.recordConflict({
          id: "conflict-1",
          entityId: "booking-999",
          type: "UPDATE",
          localValue: { status: "confirmed" },
          serverValue: { status: "cancelled" },
          resolution: "manual",
          resolvedBy: "user",
          timestamp: Date.now(),
        });
      });

      const history = await result.current.getConflictHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        entityId: "booking-999",
        resolution: "manual",
        resolvedBy: "user",
      });

      // Should provide conflict metrics
      const metrics = result.current.getConflictMetrics();
      expect(metrics).toMatchObject({
        total: 1,
        byType: { UPDATE: 1 },
        resolutionMethods: { manual: 1 },
      });
    });

    it("should handle Philippine-specific conflict scenarios", async () => {
      const { result } = renderHook(() =>
        useOfflineSync({
          locale: "ph-PH",
          timezone: "Asia/Manila",
        })
      );

      // Conflict: BIR receipt numbering
      const localReceipt = {
        id: "receipt-001",
        orNumber: "OR-2024-00123",
        amount: 5500,
        timestamp: "2024-03-15T10:00:00+08:00",
      };

      const serverReceipt = {
        id: "receipt-001",
        orNumber: "OR-2024-00124", // Different OR number
        amount: 5500,
        timestamp: "2024-03-15T10:00:00+08:00",
      };

      const resolved = await result.current.resolveConflict(localReceipt, serverReceipt, {
        type: "BIR_COMPLIANCE",
      });

      // Should use server's OR number (sequential requirement)
      expect(resolved.orNumber).toBe("OR-2024-00124");
      expect(resolved._conflictNote).toContain("BIR sequential numbering");
    });
  });

  describe("Background Sync (5 tests)", () => {
    it("should register background sync for deferred actions", async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Check if service worker is available
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;

        await act(async () => {
          await result.current.registerBackgroundSync("sync-bookings");
        });

        expect(result.current.hasPendingSync("sync-bookings")).toBe(true);
      }
    });

    it("should handle periodic background sync", async () => {
      const { result } = renderHook(() =>
        useOfflineSync({
          periodicSync: true,
          syncInterval: 5 * 60 * 1000, // 5 minutes
        })
      );

      if ("serviceWorker" in navigator && "periodicSync" in ServiceWorkerRegistration.prototype) {
        await act(async () => {
          await result.current.registerPeriodicSync("metrics-update", {
            minInterval: 5 * 60 * 1000,
          });
        });

        const tags = await result.current.getPeriodicSyncTags();
        expect(tags).toContain("metrics-update");
      }
    });

    it("should implement smart sync based on network quality", async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Mock different network conditions
      const networkConditions = [
        { type: "4g", downlink: 10, rtt: 50 },
        { type: "3g", downlink: 2, rtt: 200 },
        { type: "2g", downlink: 0.5, rtt: 500 },
      ];

      for (const condition of networkConditions) {
        Object.defineProperty(navigator, "connection", {
          writable: true,
          value: condition,
        });

        const syncStrategy = result.current.getSyncStrategy();

        if (condition.type === "4g") {
          expect(syncStrategy).toMatchObject({
            immediate: true,
            batchSize: 50,
            compression: false,
          });
        } else if (condition.type === "2g") {
          expect(syncStrategy).toMatchObject({
            immediate: false,
            batchSize: 5,
            compression: true,
          });
        }
      }
    });

    it("should sync only critical data during low battery", async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Mock battery status
      const batteryStatus = {
        level: 0.15, // 15% battery
        charging: false,
      };

      Object.defineProperty(navigator, "getBattery", {
        value: () => Promise.resolve(batteryStatus),
      });

      const battery = await navigator.getBattery();

      const syncPlan = await result.current.planSync();

      expect(syncPlan.mode).toBe("critical-only");
      expect(syncPlan.includes).toContain("emergency-contacts");
      expect(syncPlan.includes).toContain("current-bookings");
      expect(syncPlan.excludes).toContain("historical-data");
      expect(syncPlan.excludes).toContain("analytics");
    });

    it("should handle sync failures and schedule retry", async () => {
      const { result } = renderHook(() => useOfflineSync());

      const syncAttempt = {
        id: "sync-attempt-1",
        type: "bookings",
        attempt: 1,
        lastError: "Network timeout",
      };

      await act(async () => {
        await result.current.recordSyncFailure(syncAttempt);
      });

      const retrySchedule = result.current.getRetrySchedule("sync-attempt-1");

      expect(retrySchedule).toMatchObject({
        nextAttempt: expect.any(Date),
        attempt: 2,
        delay: 5000, // Exponential backoff
      });

      // After multiple failures
      for (let i = 2; i <= 5; i++) {
        await act(async () => {
          await result.current.recordSyncFailure({
            ...syncAttempt,
            attempt: i,
          });
        });
      }

      // Should eventually give up
      const finalSchedule = result.current.getRetrySchedule("sync-attempt-1");
      expect(finalSchedule.abandoned).toBe(true);
    });
  });

  describe("Data Consistency and Versioning (4 tests)", () => {
    it("should maintain data version history", async () => {
      const { result } = renderHook(() => useOfflineSync());

      const booking = mockGenerator.createBooking();

      // Initial version
      await act(async () => {
        await result.current.saveWithVersion(booking);
      });

      // Update creates new version
      await act(async () => {
        await result.current.saveWithVersion({
          ...booking,
          nights: booking.nights + 1,
        });
      });

      const history = await result.current.getVersionHistory(booking.id);

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[1].data.nights).toBe(booking.nights + 1);
    });

    it("should implement optimistic locking", async () => {
      const { result } = renderHook(() => useOfflineSync());

      const expense = {
        id: "expense-123",
        amount: 5000,
        version: 1,
      };

      await act(async () => {
        await result.current.save(expense);
      });

      // Attempt update with wrong version
      const updateResult = await result.current.updateWithLock({
        ...expense,
        amount: 6000,
        version: 0, // Wrong version
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toBe("VERSION_MISMATCH");

      // Update with correct version
      const correctUpdate = await result.current.updateWithLock({
        ...expense,
        amount: 6000,
        version: 1,
      });

      expect(correctUpdate.success).toBe(true);
      expect(correctUpdate.data.version).toBe(2);
    });

    it("should handle data migrations during sync", async () => {
      const { result } = renderHook(() =>
        useOfflineSync({
          schemaVersion: 2,
          migrations: {
            2: (data) => ({
              ...data,
              taxRate: data.taxRate || 0.12, // Add Philippine VAT
              currency: data.currency || "PHP",
            }),
          },
        })
      );

      // Old format data
      const oldBooking = {
        id: "old-booking",
        amount: 5000,
        schemaVersion: 1,
      };

      const migrated = await result.current.migrateAndSync(oldBooking);

      expect(migrated).toMatchObject({
        amount: 5000,
        taxRate: 0.12,
        currency: "PHP",
        schemaVersion: 2,
      });
    });

    it("should ensure eventual consistency across devices", async () => {
      const { result } = renderHook(() => useOfflineSync());

      // Simulate multiple devices with different states
      const device1State = {
        bookings: [{ id: "1", guest: "Device 1 Guest", timestamp: Date.now() - 1000 }],
      };

      const device2State = {
        bookings: [{ id: "2", guest: "Device 2 Guest", timestamp: Date.now() }],
      };

      // Merge states using CRDT-like approach
      const merged = await result.current.mergeDeviceStates([device1State, device2State]);

      expect(merged.bookings).toHaveLength(2);
      expect(merged.bookings).toContainEqual(expect.objectContaining({ id: "1" }));
      expect(merged.bookings).toContainEqual(expect.objectContaining({ id: "2" }));

      // Should maintain causal ordering
      expect(merged.bookings[0].id).toBe("2"); // More recent first
    });
  });
});
