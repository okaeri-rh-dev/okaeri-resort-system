/**
 * Store-Router Integration Layer
 * Provides seamless integration between Zustand stores, TanStack Query, and TanStack Router
 * Implements optimistic updates, cache synchronization, and route-aware state management
 */

import { create } from "zustand";
import { subscribeWithSelector, devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { shallow } from "zustand/shallow";
import { queryClient, queryKeys, invalidateQueries } from "@/lib/query-client";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { apiClient as api } from "@/lib/api-client";
import { ROUTES } from "@/routes/paths";
import type { QueryKey, InfiniteData } from "@tanstack/react-query";
import type { Project, Property, Booking, Expense, PaginatedResponse } from "@/types/common";

/**
 * Navigation State Store
 * Manages navigation-specific state and route transitions
 */
interface NavigationState {
  // Navigation state
  currentRoute: string;
  previousRoute: string | null;
  navigationHistory: string[];
  isNavigating: boolean;
  pendingNavigation: string | null;

  // Prefetch tracking
  prefetchedRoutes: Set<string>;
  prefetchQueue: Array<{ route: string; priority: number }>;

  // Optimistic navigation
  optimisticRoute: string | null;
  navigationError: Error | null;
}

interface NavigationActions {
  // Navigation lifecycle
  startNavigation: (to: string) => void;
  completeNavigation: (route: string) => void;
  failNavigation: (error: Error) => void;

  // Prefetch management
  queuePrefetch: (route: string, priority?: number) => void;
  markPrefetched: (route: string) => void;
  clearPrefetchCache: () => void;

  // History management
  pushToHistory: (route: string) => void;
  clearHistory: () => void;

  // Optimistic navigation
  setOptimisticRoute: (route: string | null) => void;
  rollbackNavigation: () => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        currentRoute: ROUTES.dashboard,
        previousRoute: null,
        navigationHistory: [],
        isNavigating: false,
        pendingNavigation: null,
        prefetchedRoutes: new Set(),
        prefetchQueue: [],
        optimisticRoute: null,
        navigationError: null,

        // Navigation lifecycle methods
        startNavigation: (to: string) => {
          set((state) => {
            state.isNavigating = true;
            state.pendingNavigation = to;
            state.navigationError = null;

            // Set optimistic route for instant UI feedback
            state.optimisticRoute = to;
          });

          // Update UI store for loading state
          useUIStore.getState().setPageTransition(true);
        },

        completeNavigation: (route: string) => {
          set((state) => {
            state.previousRoute = state.currentRoute;
            state.currentRoute = route;
            state.navigationHistory.push(route);

            // Limit history to last 50 entries
            if (state.navigationHistory.length > 50) {
              state.navigationHistory.shift();
            }

            state.isNavigating = false;
            state.pendingNavigation = null;
            state.optimisticRoute = null;
          });

          // Update UI store
          useUIStore.getState().setPageTransition(false);

          // Mark route as visited for prefetch optimization
          get().markPrefetched(route);
        },

        failNavigation: (error: Error) => {
          set((state) => {
            state.isNavigating = false;
            state.pendingNavigation = null;
            state.optimisticRoute = null;
            state.navigationError = error;
          });

          // Update UI store
          useUIStore.getState().setPageTransition(false);
          useUIStore
            .getState()
            .toast.error(
              "Navigation failed",
              error.message || "Unable to navigate to the requested page"
            );
        },

        // Prefetch management
        queuePrefetch: (route: string, priority = 5) => {
          set((state) => {
            // Don't queue if already prefetched
            if (state.prefetchedRoutes.has(route)) return;

            // Check if already in queue
            const existingIndex = state.prefetchQueue.findIndex((item) => item.route === route);

            if (existingIndex >= 0) {
              // Update priority if higher
              if (state.prefetchQueue[existingIndex]!.priority < priority) {
                state.prefetchQueue[existingIndex]!.priority = priority;
              }
            } else {
              // Add to queue
              state.prefetchQueue.push({ route, priority });
            }

            // Sort by priority (higher first)
            state.prefetchQueue.sort((a, b) => b.priority - a.priority);

            // Limit queue size to 10
            if (state.prefetchQueue.length > 10) {
              state.prefetchQueue = state.prefetchQueue.slice(0, 10);
            }
          });
        },

        markPrefetched: (route: string) => {
          set((state) => {
            state.prefetchedRoutes.add(route);

            // Remove from queue if present
            state.prefetchQueue = state.prefetchQueue.filter((item) => item.route !== route);
          });
        },

        clearPrefetchCache: () => {
          set((state) => {
            state.prefetchedRoutes.clear();
            state.prefetchQueue = [];
          });
        },

        // History management
        pushToHistory: (route: string) => {
          set((state) => {
            state.navigationHistory.push(route);

            // Limit history
            if (state.navigationHistory.length > 50) {
              state.navigationHistory.shift();
            }
          });
        },

        clearHistory: () => {
          set((state) => {
            state.navigationHistory = [];
          });
        },

        // Optimistic navigation
        setOptimisticRoute: (route: string | null) => {
          set((state) => {
            state.optimisticRoute = route;
          });
        },

        rollbackNavigation: () => {
          set((state) => {
            state.optimisticRoute = null;
            state.pendingNavigation = null;
            state.isNavigating = false;
          });

          useUIStore.getState().setPageTransition(false);
        },
      }))
    ),
    { name: "NavigationStore" }
  )
);

// Stable selectors for navigation store to prevent re-renders
export const useNavigation = () =>
  useNavigationStore(
    (state) => ({
      currentRoute: state.currentRoute,
      isNavigating: state.isNavigating,
      startNavigation: state.startNavigation,
      completeNavigation: state.completeNavigation,
    }),
    shallow
  );

export const usePrefetch = () =>
  useNavigationStore(
    (state) => ({
      prefetchedRoutes: state.prefetchedRoutes,
      queuePrefetch: state.queuePrefetch,
      markPrefetched: state.markPrefetched,
    }),
    shallow
  );

/**
 * Cache Synchronization Manager
 * Ensures consistency between Zustand stores and TanStack Query cache
 */
export class CacheSyncManager {
  private subscriptions: Array<() => void> = [];

  /**
   * Initialize cache synchronization
   */
  initialize() {
    // Sync auth state changes with query cache
    this.subscriptions.push(
      useAuthStore.subscribe(
        (state) => state.isAuthenticated,
        (isAuthenticated) => {
          if (!isAuthenticated) {
            // Clear all queries on logout
            queryClient.clear();

            // Clear navigation history
            useNavigationStore.getState().clearHistory();
            useNavigationStore.getState().clearPrefetchCache();
          }
        }
      )
    );

    // Sync project changes with query cache
    this.subscriptions.push(
      useProjectStore.subscribe(
        (state) => state.activeProjectId,
        (projectId, previousProjectId) => {
          if (projectId !== previousProjectId) {
            // Invalidate previous project's cache
            if (previousProjectId) {
              this.invalidateProjectCache(previousProjectId);
            }

            // Prefetch new project's essential data
            if (projectId) {
              this.prefetchProjectEssentials(projectId);
            }

            // Clear navigation prefetch cache as context changed
            useNavigationStore.getState().clearPrefetchCache();
          }
        }
      )
    );

    // Sync route changes with stores
    this.subscriptions.push(
      useNavigationStore.subscribe(
        (state) => state.currentRoute,
        (route) => {
          // Update breadcrumbs based on route
          this.updateBreadcrumbs(route);

          // Process prefetch queue
          this.processPrefetchQueue();
        }
      )
    );
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions = [];
  }

  /**
   * Invalidate all cache for a project
   */
  private invalidateProjectCache(projectId: string) {
    const queriesToInvalidate = [
      queryKeys.properties.all(projectId),
      queryKeys.bookings.all(projectId),
      queryKeys.expenses.all(projectId),
      queryKeys.dashboard.all(projectId),
      queryKeys.reports.all(projectId),
      queryKeys.analytics.all(projectId),
    ];

    queriesToInvalidate.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }

  /**
   * Prefetch essential project data
   */
  private async prefetchProjectEssentials(projectId: string) {
    const essentialQueries = [
      // Dashboard stats
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboard.stats(projectId),
        queryFn: () => api.get(`/projects/${projectId}/dashboard/stats`),
        staleTime: 5 * 60 * 1000,
      }),

      // Properties list (minimal fields)
      queryClient.prefetchQuery({
        queryKey: queryKeys.properties.list(projectId),
        queryFn: () =>
          api.get(`/projects/${projectId}/properties`, {
            params: { fields: ["id", "name", "type", "status"] },
          }),
        staleTime: 10 * 60 * 1000,
      }),
    ];

    await Promise.allSettled(essentialQueries);
  }

  /**
   * Update breadcrumbs based on current route
   */
  private updateBreadcrumbs(route: string) {
    const segments = route.split("/").filter(Boolean);
    const breadcrumbs: Array<{ label: string; href?: string }> = [
      { label: "Home", href: ROUTES.dashboard },
    ];

    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;

      // Skip underscore routes (layout routes)
      if (segment.startsWith("_")) return;

      // Format segment name
      const label = segment
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      breadcrumbs.push({
        label,
        href: index === segments.length - 1 ? undefined : currentPath,
      });
    });

    useUIStore.getState().setBreadcrumbs(breadcrumbs);
  }

  /**
   * Process prefetch queue
   */
  private async processPrefetchQueue() {
    const { prefetchQueue } = useNavigationStore.getState();

    if (prefetchQueue.length === 0) return;

    // Take top priority item
    const item = prefetchQueue[0];
    if (!item) return;

    try {
      // Trigger route prefetching
      await this.prefetchRoute(item.route);

      // Mark as prefetched
      useNavigationStore.getState().markPrefetched(item.route);
    } catch (error) {
      console.error(`Failed to prefetch route ${item.route}:`, error);
    }
  }

  /**
   * Prefetch route data
   */
  private async prefetchRoute(route: string) {
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return;

    // Route-specific prefetching logic
    if (route.includes("/bookings")) {
      await this.prefetchBookingsData(projectId);
    } else if (route.includes("/properties")) {
      await this.prefetchPropertiesData(projectId);
    } else if (route.includes("/expenses")) {
      await this.prefetchExpensesData(projectId);
    } else if (route.includes("/reports")) {
      await this.prefetchReportsData(projectId);
    }
  }

  private async prefetchBookingsData(projectId: string) {
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: queryKeys.bookings.list(projectId),
        queryFn: () => api.get(`/projects/${projectId}/bookings`),
        staleTime: 3 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.properties.list(projectId),
        queryFn: () => api.get(`/projects/${projectId}/properties`),
        staleTime: 10 * 60 * 1000,
      }),
    ]);
  }

  private async prefetchPropertiesData(projectId: string) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.properties.list(projectId),
      queryFn: () => api.get(`/projects/${projectId}/properties`),
      staleTime: 5 * 60 * 1000,
    });
  }

  private async prefetchExpensesData(projectId: string) {
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: queryKeys.expenses.list(projectId),
        queryFn: () => api.get(`/projects/${projectId}/expenses`),
        staleTime: 3 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.expenses.categories(projectId),
        queryFn: () => api.get(`/projects/${projectId}/expenses/categories`),
        staleTime: 15 * 60 * 1000,
      }),
    ]);
  }

  private async prefetchReportsData(projectId: string) {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.reports.financial(projectId),
      queryFn: () => api.get(`/projects/${projectId}/reports/financial`),
      staleTime: 5 * 60 * 1000,
    });
  }
}

/**
 * Optimistic Update Manager
 * Handles optimistic updates across stores and cache
 */
export class OptimisticUpdateManager {
  /**
   * Apply optimistic update to a list query
   */
  applyOptimisticListUpdate<T extends { id: string }>(
    queryKey: QueryKey,
    item: T,
    operation: "add" | "update" | "remove"
  ) {
    queryClient.setQueryData<PaginatedResponse<T>>(queryKey, (old) => {
      if (!old) return old;

      let newItems = [...old.items];

      switch (operation) {
        case "add":
          newItems = [item, ...newItems];
          break;
        case "update":
          newItems = newItems.map((i) => (i.id === item.id ? item : i));
          break;
        case "remove":
          newItems = newItems.filter((i) => i.id !== item.id);
          break;
      }

      return {
        ...old,
        items: newItems,
        total:
          operation === "add" ? old.total + 1 : operation === "remove" ? old.total - 1 : old.total,
      };
    });
  }

  /**
   * Apply optimistic update to a detail query
   */
  applyOptimisticDetailUpdate<T>(queryKey: QueryKey, updater: (old: T) => T) {
    queryClient.setQueryData<T>(queryKey, updater);
  }

  /**
   * Rollback optimistic update
   */
  rollbackOptimisticUpdate(queryKeys: QueryKey[]) {
    queryKeys.forEach((key) => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }

  /**
   * Apply optimistic navigation
   */
  applyOptimisticNavigation(to: string) {
    useNavigationStore.getState().setOptimisticRoute(to);
    useUIStore.getState().setPageTransition(true);
  }

  /**
   * Rollback optimistic navigation
   */
  rollbackOptimisticNavigation() {
    useNavigationStore.getState().rollbackNavigation();
    useUIStore
      .getState()
      .toast.error("Navigation failed", "Unable to navigate to the requested page");
  }
}

/**
 * Offline Sync Manager
 * Handles offline state synchronization and queueing
 */
export class OfflineSyncManager {
  private offlineQueue: Array<{
    id: string;
    type: "mutation" | "query";
    key: QueryKey;
    fn: () => Promise<any>;
    timestamp: number;
  }> = [];

  /**
   * Add operation to offline queue
   */
  queueOfflineOperation(type: "mutation" | "query", key: QueryKey, fn: () => Promise<any>) {
    const id = `offline-${Date.now()}-${Math.random()}`;

    this.offlineQueue.push({
      id,
      type,
      key,
      fn,
      timestamp: Date.now(),
    });

    // Store in localStorage for persistence
    this.persistQueue();

    return id;
  }

  /**
   * Process offline queue when online
   */
  async processOfflineQueue() {
    if (!navigator.onLine || this.offlineQueue.length === 0) return;

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    const results = await Promise.allSettled(queue.map((operation) => operation.fn()));

    // Handle failed operations
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        // Re-queue failed operations
        this.offlineQueue.push(queue[index]!);
      }
    });

    // Persist updated queue
    this.persistQueue();

    // Invalidate affected queries
    const uniqueKeys = new Set(queue.map((op) => JSON.stringify(op.key)));
    uniqueKeys.forEach((keyStr) => {
      const key = JSON.parse(keyStr);
      queryClient.invalidateQueries({ queryKey: key });
    });
  }

  /**
   * Persist queue to localStorage
   */
  private persistQueue() {
    try {
      localStorage.setItem(
        "offline-queue",
        JSON.stringify(
          this.offlineQueue.map((op) => ({
            ...op,
            fn: undefined, // Can't serialize functions
          }))
        )
      );
    } catch (error) {
      console.error("Failed to persist offline queue:", error);
    }
  }

  /**
   * Restore queue from localStorage
   */
  restoreQueue() {
    try {
      const stored = localStorage.getItem("offline-queue");
      if (stored) {
        const queue = JSON.parse(stored);
        // Note: Functions need to be re-created based on operation type
        console.log("Restored offline queue:", queue);
      }
    } catch (error) {
      console.error("Failed to restore offline queue:", error);
    }
  }
}

/**
 * Route State Manager
 * Manages route-specific state and cleanup
 */
export class RouteStateManager {
  private routeStates = new Map<string, any>();
  private cleanupFns = new Map<string, () => void>();

  /**
   * Set state for a specific route
   */
  setRouteState(route: string, state: any) {
    this.routeStates.set(route, state);
  }

  /**
   * Get state for a specific route
   */
  getRouteState<T = any>(route: string): T | undefined {
    return this.routeStates.get(route);
  }

  /**
   * Register cleanup function for a route
   */
  registerCleanup(route: string, cleanupFn: () => void) {
    this.cleanupFns.set(route, cleanupFn);
  }

  /**
   * Clean up route state when navigating away
   */
  cleanupRoute(route: string) {
    // Execute cleanup function
    const cleanupFn = this.cleanupFns.get(route);
    if (cleanupFn) {
      cleanupFn();
      this.cleanupFns.delete(route);
    }

    // Remove route state
    this.routeStates.delete(route);

    // Cancel pending queries for this route
    this.cancelRouteQueries(route);
  }

  /**
   * Cancel pending queries for a route
   */
  private cancelRouteQueries(route: string) {
    // Route-specific query cancellation logic
    const projectId = useProjectStore.getState().activeProjectId;
    if (!projectId) return;

    if (route.includes("/bookings")) {
      queryClient.cancelQueries({ queryKey: queryKeys.bookings.all(projectId) });
    } else if (route.includes("/properties")) {
      queryClient.cancelQueries({ queryKey: queryKeys.properties.all(projectId) });
    } else if (route.includes("/expenses")) {
      queryClient.cancelQueries({ queryKey: queryKeys.expenses.all(projectId) });
    }
  }

  /**
   * Clear all route states
   */
  clearAll() {
    // Execute all cleanup functions
    this.cleanupFns.forEach((fn) => fn());

    // Clear maps
    this.routeStates.clear();
    this.cleanupFns.clear();
  }
}

// Create singleton instances
export const cacheSyncManager = new CacheSyncManager();
export const optimisticUpdateManager = new OptimisticUpdateManager();
export const offlineSyncManager = new OfflineSyncManager();
export const routeStateManager = new RouteStateManager();

// Initialize on app start
if (typeof window !== "undefined") {
  // Initialize cache synchronization
  cacheSyncManager.initialize();

  // Restore offline queue
  offlineSyncManager.restoreQueue();

  // Process offline queue when online
  window.addEventListener("online", () => {
    offlineSyncManager.processOfflineQueue();
  });

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    cacheSyncManager.cleanup();
    routeStateManager.clearAll();
  });
}
