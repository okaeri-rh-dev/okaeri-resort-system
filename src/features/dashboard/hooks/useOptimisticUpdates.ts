/**
 * useOptimisticUpdates Hook - React 19 useOptimistic integration with Zustand stores
 * Phase 2.1 - TDD GREEN: Minimal implementation to pass 48 tests
 */

import { useOptimistic, useCallback, useState, useEffect, useRef, startTransition } from "react";
import { useOptimisticStore } from "../stores/optimisticStore";
import { storage } from "@/lib/crypto";
import type {
  OptimisticUpdate,
  OptimisticHookOptions,
  OptimisticHookResult,
  UpdateResolution,
  RollbackInfo,
  ConflictInfo,
  ResolutionHints,
  RollbackOptions,
} from "../types/optimistic";

export function useOptimisticUpdates<T = any>(
  options: OptimisticHookOptions<T>
): OptimisticHookResult<T> {
  const {
    initialData,
    syncWithStore = false,
    onRollback,
    conflictResolution = "server-wins",
    conflictResolver,
    trackHistory = false,
    trackConflicts = false,
    enableSnapshots = false,
    fieldLevelConflictResolution = false,
    threeWayMerge = false,
    autoRetryOnConflict = false,
    maxRetries = 3,
    mutationFn,
    optimisticLocking = false,
    provideResolutionHints = false,
    isOnline = true,
    processUpdate,
    persistQueue = false,
    storageKey,
    maxQueueSize = Infinity,
    onQueueFull,
    deduplicateQueue = false,
    priorityQueue = false,
    batchProcess = false,
    batchSize = 10,
    processBatch,
    queueTTL,
    onUpdateExpired,
    overflowStrategy = "drop-oldest",
    persist = false,
    persistKey,
    devtools = false,
    name,
    immer = false,
    asyncActions = {},
  } = options;

  const optimisticStore = useOptimisticStore();

  // State for tracking updates and conflicts
  const [pendingUpdates, setPendingUpdates] = useState<OptimisticUpdate<T>[]>([]);
  const [queuedUpdates, setQueuedUpdates] = useState<OptimisticUpdate<T>[]>([]);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [rollbackHistory, setRollbackHistory] = useState<RollbackInfo[]>([]);
  const [conflictHistory, setConflictHistory] = useState<ConflictInfo[]>([]);
  const [snapshots, setSnapshots] = useState<Map<string, T>>(new Map());

  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // React 19 useOptimistic hook for immediate UI updates
  const [optimisticData, setOptimisticData] = useOptimistic(
    initialData,
    (current: T, update: OptimisticUpdate<T>) => {
      if (immer && typeof update.changes === "function") {
        // Handle immer-style updates
        return update.changes(current);
      }

      if (update.merge || update.partial) {
        return mergeDeep(current, update.changes, update.deep);
      }

      return { ...current, ...update.changes };
    }
  );

  // Load persisted queue on mount
  useEffect(() => {
    if (persistQueue && storageKey) {
      const stored = storage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setQueuedUpdates(parsed);
        } catch (error) {
          console.warn("Failed to restore persisted queue:", error);
        }
      }
    }
  }, [persistQueue, storageKey]);

  // Persist queue changes
  useEffect(() => {
    if (persistQueue && storageKey && queuedUpdates.length > 0) {
      storage.setItem(storageKey, JSON.stringify(queuedUpdates));
    }
  }, [queuedUpdates, persistQueue, storageKey]);

  // Handle online/offline queue processing
  useEffect(() => {
    if (isOnline && queuedUpdates.length > 0 && processUpdate) {
      processQueuedUpdates();
    }
  }, [isOnline, queuedUpdates.length]);

  // Sync with Zustand store
  useEffect(() => {
    if (syncWithStore) {
      optimisticStore.data = optimisticData;
    }
  }, [optimisticData, syncWithStore, optimisticStore]);

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback(
    (update: OptimisticUpdate<T>) => {
      const updateWithTimestamp = {
        ...update,
        timestamp: update.timestamp || Date.now(),
      };

      // Handle deduplication
      if (deduplicateQueue && update.dedupeKey) {
        setQueuedUpdates((prev) => prev.filter((u) => u.dedupeKey !== update.dedupeKey));
        setPendingUpdates((prev) => prev.filter((u) => u.dedupeKey !== update.dedupeKey));
      }

      // Queue management
      if (!isOnline || queuedUpdates.length > 0) {
        setQueuedUpdates((prev) => {
          let newQueue = [...prev, updateWithTimestamp];

          // Handle queue size limits
          if (newQueue.length > maxQueueSize) {
            if (onQueueFull) onQueueFull();

            if (overflowStrategy === "drop-oldest") {
              newQueue = newQueue.slice(-maxQueueSize);
            } else {
              newQueue = newQueue.slice(0, maxQueueSize);
            }
          }

          // Handle priority queue
          if (priorityQueue) {
            newQueue.sort((a, b) => (b.priority || 0) - (a.priority || 0));
          }

          return newQueue;
        });
      } else {
        setPendingUpdates((prev) => [...prev, updateWithTimestamp]);

        // Apply optimistic update immediately within transition
        startTransition(() => {
          setOptimisticData(updateWithTimestamp);
        });

        // Process update if handler provided
        if (processUpdate) {
          processUpdate(updateWithTimestamp)
            .then((resolution) => {
              resolveUpdate(update.id, resolution);
            })
            .catch((error) => {
              rollbackUpdate(update.id);
            });
        }
      }

      // Sync with store
      if (syncWithStore) {
        optimisticStore.addUpdate(updateWithTimestamp);
      }

      // DevTools integration
      if (devtools && (window as any).__REDUX_DEVTOOLS_EXTENSION__) {
        (window as any).__REDUX_DEVTOOLS_EXTENSION__.send(
          {
            type: update.actionName || "OPTIMISTIC_UPDATE",
            payload: update,
          },
          optimisticData
        );
      }
    },
    [
      isOnline,
      queuedUpdates.length,
      maxQueueSize,
      onQueueFull,
      overflowStrategy,
      priorityQueue,
      processUpdate,
      syncWithStore,
      optimisticStore,
      devtools,
      deduplicateQueue,
      setOptimisticData,
    ]
  );

  // Rollback update
  const rollbackUpdate = useCallback(
    (id: string, options: RollbackOptions = {}) => {
      const { cascade = false, fields } = options;

      setPendingUpdates((prev) => {
        const update = prev.find((u) => u.id === id);
        if (!update) return prev;

        // Create rollback info
        const rollbackInfo: RollbackInfo = {
          updateId: id,
          previousData: update.rollbackData || initialData,
          attemptedData: update.changes,
          timestamp: Date.now(),
          rolledBackAt: Date.now(),
        };

        if (trackHistory) {
          setRollbackHistory((history) => [...history, rollbackInfo]);
        }

        if (onRollback) {
          onRollback(rollbackInfo);
        }

        // Handle cascading rollbacks
        if (cascade) {
          const dependentUpdates = prev.filter((u) => u.dependsOn?.includes(id));
          dependentUpdates.forEach((depUpdate) => {
            rollbackUpdate(depUpdate.id, options);
          });
        }

        // Handle selective field rollback
        if (fields) {
          // Rebuild state without specified fields
          let newData = { ...optimisticData };
          fields.forEach((field) => {
            if (update.rollbackData && field in update.rollbackData) {
              (newData as any)[field] = update.rollbackData[field];
            }
          });
          startTransition(() => {
            setOptimisticData({ id: `rollback-${id}`, changes: newData } as OptimisticUpdate<T>);
          });
        } else {
          // Full rollback - rebuild state from remaining updates
          const remaining = prev.filter((u) => u.id !== id);
          let newData = initialData;
          remaining.forEach((remainingUpdate) => {
            newData = mergeDeep(newData, remainingUpdate.changes);
          });
          startTransition(() => {
            setOptimisticData({ id: `rollback-${id}`, changes: newData } as OptimisticUpdate<T>);
          });
        }

        return prev.filter((u) => u.id !== id);
      });

      // Clear retry timeout
      const timeout = retryTimeouts.current.get(id);
      if (timeout) {
        clearTimeout(timeout);
        retryTimeouts.current.delete(id);
      }
    },
    [initialData, optimisticData, trackHistory, onRollback, setOptimisticData]
  );

  // Rollback all updates
  const rollbackAll = useCallback(() => {
    pendingUpdates.forEach((update) => rollbackUpdate(update.id));
    startTransition(() => {
      setOptimisticData({ id: "rollback-all", changes: initialData } as OptimisticUpdate<T>);
    });
  }, [pendingUpdates, rollbackUpdate, initialData, setOptimisticData]);

  // Resolve update (success or conflict)
  const resolveUpdate = useCallback(
    (id: string, resolution: UpdateResolution) => {
      const update = pendingUpdates.find((u) => u.id === id);
      if (!update) return;

      if (resolution.success) {
        // Success - remove from pending
        setPendingUpdates((prev) => prev.filter((u) => u.id !== id));

        // Update with server data if provided
        if (resolution.serverData) {
          startTransition(() => {
            setOptimisticData({
              id: `resolve-${id}`,
              changes: resolution.serverData,
            } as OptimisticUpdate<T>);
          });
        }
      } else if (resolution.conflict) {
        // Handle conflict
        const conflictInfo: ConflictInfo = {
          updateId: id,
          clientValue: update.changes,
          serverValue: resolution.serverData,
          resolution: conflictResolution,
          timestamp: Date.now(),
          type: threeWayMerge && resolution.baseState ? "three-way" : undefined,
        };

        setConflicts((prev) => [...prev, conflictInfo]);

        if (trackConflicts) {
          setConflictHistory((history) => [...history, conflictInfo]);
        }

        // Apply conflict resolution
        let resolvedData = optimisticData;

        if (fieldLevelConflictResolution && resolution.conflictedFields) {
          // Merge non-conflicted fields from client, conflicted fields from server
          resolvedData = { ...optimisticData };
          resolution.conflictedFields.forEach((field) => {
            if (resolution.serverData && field in resolution.serverData) {
              (resolvedData as any)[field] = resolution.serverData[field];
            }
          });
        } else if (conflictResolver) {
          resolvedData = conflictResolver(update.changes, resolution.serverData);
        } else {
          switch (conflictResolution) {
            case "server-wins":
              resolvedData = resolution.serverData;
              break;
            case "client-wins":
              resolvedData = optimisticData;
              break;
            default:
              resolvedData = resolution.serverData;
          }
        }

        startTransition(() => {
          setOptimisticData({
            id: `conflict-resolve-${id}`,
            changes: resolvedData,
          } as OptimisticUpdate<T>);
        });

        // Auto-retry on conflict
        if (autoRetryOnConflict && maxRetries > 0) {
          const retryCount = (update.metadata?.retryCount || 0) + 1;
          if (retryCount <= maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 30000);
            const timeout = setTimeout(() => {
              const retryUpdate = {
                ...update,
                metadata: { ...update.metadata, retryCount },
              };
              applyOptimisticUpdate(retryUpdate);
            }, delay);
            retryTimeouts.current.set(id, timeout);
          }
        }
      }
    },
    [
      pendingUpdates,
      conflictResolution,
      threeWayMerge,
      trackConflicts,
      fieldLevelConflictResolution,
      conflictResolver,
      optimisticData,
      autoRetryOnConflict,
      maxRetries,
      applyOptimisticUpdate,
      setOptimisticData,
    ]
  );

  // Get resolution hints for UI
  const getResolutionHints = useCallback(
    (id: string): ResolutionHints => {
      const conflict = conflicts.find((c) => c.updateId === id);
      if (!conflict) {
        return {
          conflictedFields: [],
          suggestedActions: [],
          userPrompt: "",
        };
      }

      const conflictedFields = Object.keys(conflict.clientValue || {});
      return {
        conflictedFields,
        suggestedActions: ["Accept server changes", "Keep your changes", "Merge both versions"],
        userPrompt: `Conflict detected in fields: ${conflictedFields.join(", ")}`,
      };
    },
    [conflicts]
  );

  // Snapshot management
  const createSnapshot = useCallback(
    (name: string) => {
      if (enableSnapshots) {
        setSnapshots((prev) => new Map(prev).set(name, optimisticData));
      }
    },
    [enableSnapshots, optimisticData]
  );

  const restoreSnapshot = useCallback(
    (name: string) => {
      if (enableSnapshots) {
        const snapshot = snapshots.get(name);
        if (snapshot) {
          startTransition(() => {
            setOptimisticData({ id: `snapshot-${name}`, changes: snapshot } as OptimisticUpdate<T>);
          });
          setPendingUpdates([]);
        }
      }
    },
    [enableSnapshots, snapshots, setOptimisticData]
  );

  // Queue processing
  const processQueue = useCallback(() => {
    // Expire old updates
    if (queueTTL) {
      const now = Date.now();
      setQueuedUpdates((prev) => {
        const expired = prev.filter((u) => now - (u.timestamp || 0) > queueTTL);
        expired.forEach((u) => onUpdateExpired?.(u.id));
        return prev.filter((u) => now - (u.timestamp || 0) <= queueTTL);
      });
    }

    if (!isOnline || !processUpdate) return;

    processQueuedUpdates();
  }, [queueTTL, onUpdateExpired, isOnline, processUpdate]);

  const processQueuedUpdates = useCallback(async () => {
    if (batchProcess && processBatch) {
      // Process in batches
      const batches = [];
      for (let i = 0; i < queuedUpdates.length; i += batchSize) {
        batches.push(queuedUpdates.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        try {
          await processBatch(batch);
          setQueuedUpdates((prev) => prev.filter((u) => !batch.includes(u)));
        } catch (error) {
          console.error("Batch processing failed:", error);
        }
      }
    } else if (processUpdate) {
      // Process sequentially
      for (const update of queuedUpdates) {
        try {
          const resolution = await processUpdate(update);
          resolveUpdate(update.id, resolution);
          setQueuedUpdates((prev) => prev.filter((u) => u.id !== update.id));
        } catch (error) {
          console.error("Update processing failed:", error);
        }
      }
    }
  }, [batchProcess, processBatch, batchSize, queuedUpdates, processUpdate, resolveUpdate]);

  // Enhanced async actions
  const enhancedAsyncActions = Object.fromEntries(
    Object.entries(asyncActions).map(([key, action]) => [
      key,
      async () => {
        const result = await action();
        startTransition(() => {
          setOptimisticData({ id: `async-${key}`, changes: result } as OptimisticUpdate<T>);
        });
        return result;
      },
    ])
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      retryTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      retryTimeouts.current.clear();
    };
  }, []);

  return {
    optimisticData,
    isPending: pendingUpdates.length > 0 || queuedUpdates.length > 0,
    pendingUpdates,
    queuedUpdates,
    hasConflicts: conflicts.length > 0,
    conflicts,
    rollbackHistory,
    conflictHistory,

    // Actions
    applyOptimisticUpdate,
    rollbackUpdate,
    rollbackAll,
    resolveUpdate,
    getResolutionHints,

    // Snapshots
    createSnapshot,
    restoreSnapshot,

    // Queue management
    processQueue,

    // Async actions
    asyncActions: enhancedAsyncActions,
  };
}

// Helper function for deep merging
function mergeDeep(target: any, source: any, deep = false): any {
  if (!deep) {
    return { ...target, ...source };
  }

  const result = { ...target };

  Object.keys(source).forEach((key) => {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = mergeDeep(result[key] || {}, source[key], true);
    } else {
      result[key] = source[key];
    }
  });

  return result;
}
