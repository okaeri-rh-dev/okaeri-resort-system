import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Use existing test utilities
import { DashboardTestProvider } from "../../../../../tests/utils/dashboard-providers";
import { DashboardMockDataGenerator } from "../../../../../tests/utils/dashboard-mocks";

// These don't exist yet - RED phase of TDD
import { useOptimisticUpdates } from "../../hooks/useOptimisticUpdates";
import { useOptimisticStore } from "../../stores/optimisticStore";
import type { OptimisticUpdate, ConflictResolution } from "../../types/optimistic";

describe("useOptimisticUpdates Hook", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    // Reset Zustand store
    useOptimisticStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("Basic Optimistic Updates (10 tests)", () => {
    it("should apply updates immediately to UI", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });
      });

      expect(result.current.optimisticData.count).toBe(1);
      expect(result.current.isPending).toBe(true);
    });

    it("should maintain update history", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
          timestamp: Date.now(),
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { count: 2 },
          timestamp: Date.now() + 1000,
        });
      });

      expect(result.current.pendingUpdates).toHaveLength(2);
      expect(result.current.pendingUpdates[0].id).toBe("update-1");
    });

    it("should merge multiple updates correctly", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              user: { name: "John", age: 30 },
              settings: { theme: "light" },
            },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { user: { age: 31 } },
          merge: true,
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { settings: { theme: "dark" } },
          merge: true,
        });
      });

      expect(result.current.optimisticData).toEqual({
        user: { name: "John", age: 31 },
        settings: { theme: "dark" },
      });
    });

    it("should handle nested object updates", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              resort: {
                bookings: {
                  room101: { guest: "Alice", nights: 2 },
                },
              },
            },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: {
            resort: {
              bookings: {
                room101: { guest: "Alice", nights: 3 },
              },
            },
          },
          merge: true,
          deep: true,
        });
      });

      expect(result.current.optimisticData.resort.bookings.room101.nights).toBe(3);
    });

    it("should handle array updates", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              items: [1, 2, 3],
            },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { items: [1, 2, 3, 4] },
        });
      });

      expect(result.current.optimisticData.items).toEqual([1, 2, 3, 4]);
    });

    it("should track update metadata", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0 },
          }),
        { wrapper }
      );

      const now = Date.now();
      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { value: 1 },
          metadata: {
            userId: "user123",
            action: "increment",
            source: "button-click",
          },
        });
      });

      const update = result.current.pendingUpdates[0];
      expect(update.metadata).toEqual({
        userId: "user123",
        action: "increment",
        source: "button-click",
      });
      expect(update.timestamp).toBeGreaterThanOrEqual(now);
    });

    it("should support partial updates", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              booking: {
                id: "123",
                guest: "Alice",
                room: "101",
                status: "pending",
              },
            },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { booking: { status: "confirmed" } },
          partial: true,
        });
      });

      expect(result.current.optimisticData.booking).toEqual({
        id: "123",
        guest: "Alice",
        room: "101",
        status: "confirmed",
      });
    });

    it("should handle concurrent updates on same field", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { counter: 0 },
          }),
        { wrapper }
      );

      act(() => {
        // Simulate rapid concurrent updates
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { counter: 1 },
        });
        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { counter: 2 },
        });
        result.current.applyOptimisticUpdate({
          id: "update-3",
          changes: { counter: 3 },
        });
      });

      expect(result.current.optimisticData.counter).toBe(3);
      expect(result.current.pendingUpdates).toHaveLength(3);
    });

    it("should preserve reference equality for unchanged data", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              unchanged: { value: "constant" },
              changed: { value: "mutable" },
            },
          }),
        { wrapper }
      );

      const originalUnchanged = result.current.optimisticData.unchanged;

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { changed: { value: "updated" } },
          merge: true,
        });
      });

      // Reference should be preserved for unchanged data
      expect(result.current.optimisticData.unchanged).toBe(originalUnchanged);
      expect(result.current.optimisticData.changed.value).toBe("updated");
    });

    it("should handle null and undefined values", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              nullable: "value",
              optional: "value",
            },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: {
            nullable: null,
            optional: undefined,
          },
        });
      });

      expect(result.current.optimisticData.nullable).toBeNull();
      expect(result.current.optimisticData.optional).toBeUndefined();
    });
  });

  describe("Rollback Mechanism (8 tests)", () => {
    it("should rollback single update on failure", async () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      expect(result.current.optimisticData.count).toBe(5);

      act(() => {
        result.current.rollbackUpdate("update-1");
      });

      expect(result.current.optimisticData.count).toBe(0);
      expect(result.current.pendingUpdates).toHaveLength(0);
    });

    it("should rollback updates in correct order", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { values: [] as number[] },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { values: [1] },
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { values: [1, 2] },
        });

        result.current.applyOptimisticUpdate({
          id: "update-3",
          changes: { values: [1, 2, 3] },
        });
      });

      act(() => {
        result.current.rollbackUpdate("update-2");
      });

      // Should rebuild state from remaining updates
      expect(result.current.optimisticData.values).toEqual([1, 2, 3]);
      expect(result.current.pendingUpdates).toHaveLength(2);
    });

    it("should trigger rollback callbacks", () => {
      const onRollback = vi.fn();

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            onRollback,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });

        result.current.rollbackUpdate("update-1");
      });

      expect(onRollback).toHaveBeenCalledWith({
        updateId: "update-1",
        previousData: { count: 0 },
        attemptedData: { count: 5 },
      });
    });

    it("should rollback all updates", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { a: 1, b: 2, c: 3 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { a: 10 },
          merge: true,
        });
        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { b: 20 },
          merge: true,
        });
        result.current.applyOptimisticUpdate({
          id: "update-3",
          changes: { c: 30 },
          merge: true,
        });
      });

      expect(result.current.optimisticData).toEqual({ a: 10, b: 20, c: 30 });

      act(() => {
        result.current.rollbackAll();
      });

      expect(result.current.optimisticData).toEqual({ a: 1, b: 2, c: 3 });
      expect(result.current.pendingUpdates).toHaveLength(0);
    });

    it("should handle cascading rollbacks", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0, dependent: 0 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "parent",
          changes: { value: 10 },
        });
        result.current.applyOptimisticUpdate({
          id: "child",
          changes: { dependent: 100 },
          dependsOn: ["parent"],
        });
      });

      act(() => {
        result.current.rollbackUpdate("parent", { cascade: true });
      });

      // Both parent and dependent should be rolled back
      expect(result.current.optimisticData).toEqual({ value: 0, dependent: 0 });
      expect(result.current.pendingUpdates).toHaveLength(0);
    });

    it("should maintain rollback history", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            trackHistory: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
        result.current.rollbackUpdate("update-1");
      });

      expect(result.current.rollbackHistory).toHaveLength(1);
      expect(result.current.rollbackHistory[0]).toMatchObject({
        updateId: "update-1",
        rolledBackAt: expect.any(Number),
      });
    });

    it("should support selective field rollback", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              field1: "original1",
              field2: "original2",
              field3: "original3",
            },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: {
            field1: "updated1",
            field2: "updated2",
            field3: "updated3",
          },
        });
      });

      act(() => {
        result.current.rollbackUpdate("update-1", {
          fields: ["field1", "field3"],
        });
      });

      // Only specified fields should be rolled back
      expect(result.current.optimisticData).toEqual({
        field1: "original1",
        field2: "updated2",
        field3: "original3",
      });
    });

    it("should handle rollback with state snapshots", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0 },
            enableSnapshots: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.createSnapshot("before-changes");

        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { value: 5 },
        });
        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { value: 10 },
        });
      });

      act(() => {
        result.current.restoreSnapshot("before-changes");
      });

      expect(result.current.optimisticData.value).toBe(0);
      expect(result.current.pendingUpdates).toHaveLength(0);
    });
  });

  describe("Conflict Resolution (10 tests)", () => {
    it("should detect conflicts with server state", async () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0, version: 1 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5, version: 2 },
        });
      });

      // Simulate server response with different version
      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 3, version: 3 },
          conflict: true,
        });
      });

      expect(result.current.hasConflicts).toBe(true);
      expect(result.current.conflicts).toHaveLength(1);
    });

    it("should apply server-wins conflict resolution", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            conflictResolution: "server-wins",
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 3 },
          conflict: true,
        });
      });

      expect(result.current.optimisticData.count).toBe(3);
    });

    it("should apply client-wins conflict resolution", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            conflictResolution: "client-wins",
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 3 },
          conflict: true,
        });
      });

      expect(result.current.optimisticData.count).toBe(5);
    });

    it("should merge conflicts with custom resolver", () => {
      const customResolver = vi.fn((local, server) => ({
        count: Math.max(local.count, server.count),
      }));

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            conflictResolver: customResolver,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { count: 7 },
          conflict: true,
        });
      });

      expect(customResolver).toHaveBeenCalled();
      expect(result.current.optimisticData.count).toBe(7);
    });

    it("should handle field-level conflicts", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              booking: {
                guest: "Alice",
                nights: 2,
                room: "101",
              },
            },
            fieldLevelConflictResolution: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: {
            booking: {
              guest: "Alice",
              nights: 3,
              room: "101",
            },
          },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: {
            booking: {
              guest: "Bob",
              nights: 2,
              room: "102",
            },
          },
          conflict: true,
          conflictedFields: ["guest", "room"],
        });
      });

      // Only non-conflicted field (nights) should keep client value
      expect(result.current.optimisticData.booking).toEqual({
        guest: "Bob", // Server wins for conflicted field
        nights: 3, // Client wins for non-conflicted field
        room: "102", // Server wins for conflicted field
      });
    });

    it("should track conflict resolution history", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0 },
            trackConflicts: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { value: 5 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { value: 3 },
          conflict: true,
        });
      });

      expect(result.current.conflictHistory).toHaveLength(1);
      expect(result.current.conflictHistory[0]).toMatchObject({
        updateId: "update-1",
        clientValue: { value: 5 },
        serverValue: { value: 3 },
        resolution: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it("should handle three-way merge conflicts", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0, baseVersion: 1 },
            threeWayMerge: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { value: 5 },
          baseState: { value: 0, baseVersion: 1 },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { value: 3, baseVersion: 2 },
          conflict: true,
          baseState: { value: 0, baseVersion: 1 },
        });
      });

      // Three-way merge should detect both changed from base
      expect(result.current.conflicts[0].type).toBe("three-way");
    });

    it("should auto-retry with exponential backoff on conflicts", async () => {
      const retryAttempts: number[] = [];
      const mutationFn = vi.fn().mockImplementation(() => {
        retryAttempts.push(Date.now());
        return Promise.reject({ conflict: true });
      });

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0 },
            autoRetryOnConflict: true,
            maxRetries: 3,
            mutationFn,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { value: 5 },
        });
      });

      await waitFor(() => {
        expect(retryAttempts.length).toBe(3);
      });

      // Verify exponential backoff
      if (retryAttempts.length >= 2) {
        const delay1 = retryAttempts[1] - retryAttempts[0];
        const delay2 = retryAttempts[2] - retryAttempts[1];
        expect(delay2).toBeGreaterThan(delay1);
      }
    });

    it("should handle optimistic locking with version numbers", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { value: 0, version: 1 },
            optimisticLocking: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { value: 5 },
          expectedVersion: 1,
        });
      });

      // Should increment version optimistically
      expect(result.current.optimisticData.version).toBe(2);

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: { value: 3, version: 3 },
          conflict: true,
          reason: "version-mismatch",
        });
      });

      expect(result.current.conflicts[0].reason).toBe("version-mismatch");
    });

    it("should provide conflict resolution UI hints", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              booking: { guest: "Alice", nights: 2 },
            },
            provideResolutionHints: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: {
            booking: { guest: "Alice", nights: 3 },
          },
        });
      });

      act(() => {
        result.current.resolveUpdate("update-1", {
          success: false,
          serverData: {
            booking: { guest: "Bob", nights: 2 },
          },
          conflict: true,
        });
      });

      const hints = result.current.getResolutionHints("update-1");
      expect(hints).toMatchObject({
        conflictedFields: expect.any(Array),
        suggestedActions: expect.any(Array),
        userPrompt: expect.any(String),
      });
    });
  });

  describe("Queue Management (10 tests)", () => {
    it("should queue updates when offline", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            isOnline: false,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });

        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { count: 2 },
        });
      });

      expect(result.current.queuedUpdates).toHaveLength(2);
      expect(result.current.optimisticData.count).toBe(2);
    });

    it("should process queue when coming online", async () => {
      const processFn = vi.fn().mockResolvedValue({ success: true });

      const { result, rerender } = renderHook(
        ({ isOnline }) =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            isOnline,
            processUpdate: processFn,
          }),
        {
          wrapper,
          initialProps: { isOnline: false },
        }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });
      });

      expect(processFn).not.toHaveBeenCalled();

      rerender({ isOnline: true });

      await waitFor(() => {
        expect(processFn).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "update-1",
          })
        );
      });
    });

    it("should respect queue order during processing", async () => {
      const processOrder: string[] = [];
      const processFn = vi.fn().mockImplementation((update) => {
        processOrder.push(update.id);
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            processUpdate: processFn,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({ id: "A", changes: { count: 1 } });
        result.current.applyOptimisticUpdate({ id: "B", changes: { count: 2 } });
        result.current.applyOptimisticUpdate({ id: "C", changes: { count: 3 } });
      });

      await waitFor(() => {
        expect(processOrder).toEqual(["A", "B", "C"]);
      });
    });

    it("should handle queue persistence", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            persistQueue: true,
            storageKey: "test-queue",
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
        });
      });

      // Simulate page reload by creating new hook instance
      const { result: newResult } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            persistQueue: true,
            storageKey: "test-queue",
          }),
        { wrapper }
      );

      expect(newResult.current.queuedUpdates).toHaveLength(1);
      expect(newResult.current.queuedUpdates[0].id).toBe("update-1");
    });

    it("should implement queue size limits", () => {
      const onQueueFull = vi.fn();

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            maxQueueSize: 3,
            onQueueFull,
          }),
        { wrapper }
      );

      act(() => {
        for (let i = 1; i <= 5; i++) {
          result.current.applyOptimisticUpdate({
            id: `update-${i}`,
            changes: { count: i },
          });
        }
      });

      expect(result.current.queuedUpdates).toHaveLength(3);
      expect(onQueueFull).toHaveBeenCalled();
    });

    it("should deduplicate queued updates", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            deduplicateQueue: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
          dedupeKey: "increment",
        });
        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { count: 2 },
          dedupeKey: "increment",
        });
      });

      // Should only keep the latest update with same dedupeKey
      expect(result.current.queuedUpdates).toHaveLength(1);
      expect(result.current.queuedUpdates[0].id).toBe("update-2");
    });

    it("should prioritize certain updates in queue", async () => {
      const processOrder: string[] = [];
      const processFn = vi.fn().mockImplementation((update) => {
        processOrder.push(update.id);
        return Promise.resolve({ success: true });
      });

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            processUpdate: processFn,
            priorityQueue: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "low-priority",
          changes: { count: 1 },
          priority: 1,
        });
        result.current.applyOptimisticUpdate({
          id: "high-priority",
          changes: { count: 2 },
          priority: 10,
        });
        result.current.applyOptimisticUpdate({
          id: "medium-priority",
          changes: { count: 3 },
          priority: 5,
        });
      });

      await waitFor(() => {
        expect(processOrder).toEqual(["high-priority", "medium-priority", "low-priority"]);
      });
    });

    it("should batch queue processing", async () => {
      const batchSpy = vi.fn().mockResolvedValue({ success: true });

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            batchProcess: true,
            batchSize: 3,
            processBatch: batchSpy,
          }),
        { wrapper }
      );

      act(() => {
        for (let i = 1; i <= 5; i++) {
          result.current.applyOptimisticUpdate({
            id: `update-${i}`,
            changes: { count: i },
          });
        }
      });

      await waitFor(() => {
        // Should be called twice: batch of 3, then batch of 2
        expect(batchSpy).toHaveBeenCalledTimes(2);
      });

      expect(batchSpy).toHaveBeenNthCalledWith(
        1,
        expect.arrayContaining([
          expect.objectContaining({ id: "update-1" }),
          expect.objectContaining({ id: "update-2" }),
          expect.objectContaining({ id: "update-3" }),
        ])
      );
    });

    it("should expire old queued updates", () => {
      const onExpire = vi.fn();

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            queueTTL: 100, // 100ms TTL
            onUpdateExpired: onExpire,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 1 },
          timestamp: Date.now() - 200, // Already expired
        });
      });

      act(() => {
        result.current.processQueue();
      });

      expect(onExpire).toHaveBeenCalledWith("update-1");
      expect(result.current.queuedUpdates).toHaveLength(0);
    });

    it("should handle queue overflow strategies", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            maxQueueSize: 3,
            overflowStrategy: "drop-oldest",
          }),
        { wrapper }
      );

      act(() => {
        for (let i = 1; i <= 5; i++) {
          result.current.applyOptimisticUpdate({
            id: `update-${i}`,
            changes: { count: i },
          });
        }
      });

      // Should keep the 3 most recent updates
      expect(result.current.queuedUpdates.map((u) => u.id)).toEqual([
        "update-3",
        "update-4",
        "update-5",
      ]);
    });
  });

  describe("Zustand Integration (10 tests)", () => {
    it("should sync with Zustand store", () => {
      const { result } = renderHook(
        () => {
          const optimistic = useOptimisticUpdates({
            initialData: { count: 0 },
            syncWithStore: true,
          });
          const storeState = useOptimisticStore();
          return { optimistic, storeState };
        },
        { wrapper }
      );

      act(() => {
        result.current.optimistic.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      // Both hook and store should be in sync
      expect(result.current.optimistic.optimisticData.count).toBe(5);
      expect(result.current.storeState.data.count).toBe(5);
    });

    it("should use Zustand middleware for persistence", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            persist: true,
            persistKey: "optimistic-state",
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      // Check localStorage
      const persisted = localStorage.getItem("optimistic-state");
      expect(persisted).toBeTruthy();
      const parsed = JSON.parse(persisted!);
      expect(parsed.state.data.count).toBe(5);
    });

    it("should handle Zustand subscriptions efficiently", () => {
      const subscriber = vi.fn();

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0, other: "value" },
          }),
        { wrapper }
      );

      // Subscribe only to count changes
      const unsubscribe = useOptimisticStore.subscribe((state) => state.data.count, subscriber);

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { other: "changed" },
          merge: true,
        });
      });

      // Should not trigger subscriber for other field
      expect(subscriber).not.toHaveBeenCalled();

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-2",
          changes: { count: 5 },
          merge: true,
        });
      });

      // Should trigger for count change
      expect(subscriber).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("should integrate with Zustand devtools", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            devtools: true,
            name: "OptimisticUpdates",
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
          actionName: "INCREMENT_COUNT",
        });
      });

      // Check if devtools received the action
      const devtools = (window as any).__REDUX_DEVTOOLS_EXTENSION__;
      if (devtools) {
        expect(devtools.send).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "INCREMENT_COUNT",
          }),
          expect.any(Object)
        );
      }
    });

    it("should handle Zustand store resets", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { count: 5 },
        });
      });

      act(() => {
        useOptimisticStore.getState().reset();
      });

      expect(result.current.optimisticData.count).toBe(0);
      expect(result.current.pendingUpdates).toHaveLength(0);
    });

    it("should support Zustand computed values", () => {
      const { result } = renderHook(
        () => {
          const optimistic = useOptimisticUpdates({
            initialData: {
              nights: 3,
              pricePerNight: 5000, // PHP
            },
          });

          const total = useOptimisticStore((state) => state.data.nights * state.data.pricePerNight);

          return { optimistic, total };
        },
        { wrapper }
      );

      expect(result.current.total).toBe(15000);

      act(() => {
        result.current.optimistic.applyOptimisticUpdate({
          id: "update-1",
          changes: { nights: 5 },
          merge: true,
        });
      });

      expect(result.current.total).toBe(25000);
    });

    it("should handle Zustand store composition", () => {
      const { result } = renderHook(
        () => {
          const optimistic = useOptimisticUpdates({
            initialData: { booking: { id: "123" } },
          });

          // Compose with another store
          const userStore = useOptimisticStore.getState().composeWith("user", {
            name: "Alice",
            role: "guest",
          });

          return { optimistic, userStore };
        },
        { wrapper }
      );

      act(() => {
        result.current.optimistic.applyOptimisticUpdate({
          id: "update-1",
          changes: {
            booking: { id: "456" },
            user: { name: "Bob" },
          },
          merge: true,
        });
      });

      expect(result.current.optimistic.optimisticData.booking.id).toBe("456");
      expect(result.current.userStore.name).toBe("Bob");
    });

    it("should support Zustand immer middleware", () => {
      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: {
              bookings: [
                { id: "1", guest: "Alice" },
                { id: "2", guest: "Bob" },
              ],
            },
            immer: true,
          }),
        { wrapper }
      );

      act(() => {
        result.current.applyOptimisticUpdate({
          id: "update-1",
          changes: (draft: any) => {
            const booking = draft.bookings.find((b: any) => b.id === "2");
            if (booking) {
              booking.guest = "Charlie";
            }
          },
          immerUpdate: true,
        });
      });

      expect(result.current.optimisticData.bookings[1].guest).toBe("Charlie");
    });

    it("should handle Zustand async actions", async () => {
      const fetchData = vi.fn().mockResolvedValue({ count: 10 });

      const { result } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
            asyncActions: {
              fetchAndUpdate: async () => {
                const data = await fetchData();
                return { count: data.count };
              },
            },
          }),
        { wrapper }
      );

      await act(async () => {
        await result.current.asyncActions.fetchAndUpdate();
      });

      expect(result.current.optimisticData.count).toBe(10);
    });

    it("should cleanup Zustand subscriptions on unmount", () => {
      const { result, unmount } = renderHook(
        () =>
          useOptimisticUpdates({
            initialData: { count: 0 },
          }),
        { wrapper }
      );

      const subscriptionCount = useOptimisticStore.getState().getSubscriptionCount();

      unmount();

      expect(useOptimisticStore.getState().getSubscriptionCount()).toBeLessThan(subscriptionCount);
    });
  });
});
