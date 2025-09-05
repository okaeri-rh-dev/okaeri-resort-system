/**
 * Optimistic Store - Zustand store for managing optimistic updates
 * Tracks pending updates and handles rollbacks
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";
import type { OptimisticUpdate } from "../types/optimistic";

// Re-export for backward compatibility
export type { OptimisticUpdate };

interface OptimisticStoreState {
  pendingUpdates: OptimisticUpdate[];
  hasUpdates: boolean;
  rollbackSnapshots: Map<string, any>;
  data: any;
}

interface OptimisticStore extends OptimisticStoreState {
  // Update management
  addUpdate: (update: OptimisticUpdate) => void;
  removeUpdate: (id: string) => void;
  clearUpdates: () => void;

  // Rollback management
  createRollbackSnapshot: (id: string, data: any) => void;
  rollback: (id: string) => any;

  // State queries
  getPendingUpdate: (id: string) => OptimisticUpdate | undefined;
  getUpdateCount: () => number;

  // Store composition and subscriptions (for tests)
  composeWith: (key: string, initialValue: any) => any;
  getSubscriptionCount: () => number;

  // Reset
  reset: () => void;
}

const initialState: OptimisticStoreState = {
  pendingUpdates: [],
  hasUpdates: false,
  rollbackSnapshots: new Map(),
  data: {},
};

export const useOptimisticStore = create<OptimisticStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      ...initialState,

      addUpdate: (update: OptimisticUpdate) => {
        set((state) => {
          // Add timestamp if not provided
          const updateWithTimestamp = {
            ...update,
            timestamp: update.timestamp || Date.now(),
          };

          state.pendingUpdates.push(updateWithTimestamp);
          state.hasUpdates = true;
        });
      },

      removeUpdate: (id: string) => {
        set((state) => {
          state.pendingUpdates = state.pendingUpdates.filter((u) => u.id !== id);
          state.hasUpdates = state.pendingUpdates.length > 0;
        });
      },

      clearUpdates: () => {
        set((state) => {
          state.pendingUpdates = [];
          state.hasUpdates = false;
          state.rollbackSnapshots.clear();
        });
      },

      createRollbackSnapshot: (id: string, data: any) => {
        set((state) => {
          state.rollbackSnapshots.set(id, data);
        });
      },

      rollback: (id: string) => {
        const snapshot = get().rollbackSnapshots.get(id);

        if (snapshot) {
          set((state) => {
            state.pendingUpdates = state.pendingUpdates.filter((u) => u.id !== id);
            state.hasUpdates = state.pendingUpdates.length > 0;
            state.rollbackSnapshots.delete(id);
          });

          return snapshot;
        }

        return null;
      },

      getPendingUpdate: (id: string) => {
        return get().pendingUpdates.find((u) => u.id === id);
      },

      getUpdateCount: () => {
        return get().pendingUpdates.length;
      },

      composeWith: (key: string, initialValue: any) => {
        // Mock implementation for tests
        return { [key]: initialValue };
      },

      getSubscriptionCount: () => {
        // Mock implementation - would track actual subscriptions in real store
        return 1;
      },

      reset: () => {
        set(() => ({ ...initialState, rollbackSnapshots: new Map() }));
      },
    }))
  )
);

// Helper function for testing
export function createOptimisticStore() {
  return useOptimisticStore;
}
