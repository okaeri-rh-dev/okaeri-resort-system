/**
 * Custom hooks for integrating Zustand stores with TanStack Query
 * Provides optimistic updates, cache synchronization, and offline support
 */

import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { queryClient, queryKeys, mutationKeys, invalidateQueries } from "@/lib/query-client";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useNavigationStore } from "@/lib/store-router-integration";
import {
  optimisticUpdateManager,
  offlineSyncManager,
  routeStateManager,
} from "@/lib/store-router-integration";
import { apiClient as api } from "@/lib/api-client";
import type { Project, Property, Booking, Expense, PaginatedResponse } from "@/types/common";

/**
 * Enhanced useQuery hook with store integration
 */
export function useStoreQuery<TData = unknown, TError = Error>(
  options: UseQueryOptions<TData, TError> & {
    syncWithStore?: (data: TData) => void;
    offlineEnabled?: boolean;
    prefetchNext?: boolean;
  }
) {
  const { syncWithStore, offlineEnabled = true, prefetchNext, ...queryOptions } = options;

  const query = useQuery<TData, TError>(queryOptions);

  // Sync successful data with store
  useEffect(() => {
    if (query.data && syncWithStore) {
      syncWithStore(query.data);
    }
  }, [query.data, syncWithStore]);

  // Handle offline mode
  useEffect(() => {
    if (offlineEnabled && query.error && !navigator.onLine) {
      // Queue for retry when online
      offlineSyncManager.queueOfflineOperation(
        "query",
        queryOptions.queryKey!,
        queryOptions.queryFn!
      );
    }
  }, [query.error, offlineEnabled, queryOptions.queryKey, queryOptions.queryFn]);

  // Prefetch next page if enabled
  useEffect(() => {
    if (prefetchNext && query.data && "hasNextPage" in (query.data as any)) {
      const paginatedData = query.data as any;
      if (paginatedData.hasNextPage) {
        // Prefetch next page in background
        const nextPageKey = [...queryOptions.queryKey!, { page: paginatedData.page + 1 }];
        queryClient.prefetchQuery({
          queryKey: nextPageKey,
          queryFn: queryOptions.queryFn,
          staleTime: queryOptions.staleTime,
        });
      }
    }
  }, [prefetchNext, query.data, queryOptions]);

  return query;
}

/**
 * Enhanced useMutation hook with optimistic updates
 */
export function useStoreMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    optimisticUpdate?: {
      queryKey: any[];
      updater: (variables: TVariables) => void;
    };
    invalidateKeys?: any[][];
    showToast?: boolean;
    offlineEnabled?: boolean;
  }
) {
  const {
    optimisticUpdate,
    invalidateKeys = [],
    showToast = true,
    offlineEnabled = true,
    ...mutationOptions
  } = options;

  const toast = useUIStore((state) => state.toast);
  const rollbackDataRef = useRef<any>(null);

  const mutation = useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,

    onMutate: async (variables) => {
      // Call original onMutate
      const context = mutationOptions.onMutate
        ? await mutationOptions.onMutate(variables)
        : undefined;

      // Apply optimistic update
      if (optimisticUpdate) {
        // Cancel outgoing queries
        await queryClient.cancelQueries({ queryKey: optimisticUpdate.queryKey });

        // Save current data for rollback
        rollbackDataRef.current = queryClient.getQueryData(optimisticUpdate.queryKey);

        // Apply optimistic update
        optimisticUpdate.updater(variables);
      }

      return context;
    },

    onError: (error, variables, context) => {
      // Rollback optimistic update
      if (optimisticUpdate && rollbackDataRef.current !== undefined) {
        queryClient.setQueryData(optimisticUpdate.queryKey, rollbackDataRef.current);
      }

      // Show error toast
      if (showToast) {
        toast.error("Operation failed", (error as any)?.message || "An unexpected error occurred");
      }

      // Queue for offline sync if applicable
      if (offlineEnabled && !navigator.onLine) {
        offlineSyncManager.queueOfflineOperation("mutation", optimisticUpdate?.queryKey || [], () =>
          mutationOptions.mutationFn!(variables)
        );
      }

      // Call original onError
      mutationOptions.onError?.(error, variables, context);
    },

    onSuccess: (data, variables, context) => {
      // Invalidate specified queries
      invalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Show success toast
      if (showToast) {
        toast.success("Success", "Operation completed successfully");
      }

      // Call original onSuccess
      mutationOptions.onSuccess?.(data, variables, context);
    },

    onSettled: (data, error, variables, context) => {
      // Clean up rollback data
      rollbackDataRef.current = null;

      // Call original onSettled
      mutationOptions.onSettled?.(data, error, variables, context);
    },
  });

  return mutation;
}

/**
 * Hook for managing paginated queries with store sync
 */
export function usePaginatedStoreQuery<TData extends { id: string }>(
  key: any[],
  fetchFn: (params: any) => Promise<PaginatedResponse<TData>>,
  options?: {
    pageSize?: number;
    initialPage?: number;
    syncWithStore?: (items: TData[]) => void;
    prefetchPages?: number;
  }
) {
  const { pageSize = 20, initialPage = 1, syncWithStore, prefetchPages = 1 } = options || {};

  const [page, setPage] = useState(initialPage);
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const query = useStoreQuery({
    queryKey: [...key, { page, pageSize, ...searchParams }],
    queryFn: () => fetchFn({ page, pageSize, ...searchParams }),
    keepPreviousData: true,
    syncWithStore: (data) => {
      if (syncWithStore) {
        syncWithStore(data.items);
      }
    },
  });

  // Prefetch adjacent pages
  useEffect(() => {
    if (query.data && prefetchPages > 0) {
      const { page: currentPage, totalPages } = query.data;

      // Prefetch next pages
      for (let i = 1; i <= prefetchPages; i++) {
        const nextPage = currentPage + i;
        if (nextPage <= totalPages) {
          queryClient.prefetchQuery({
            queryKey: [...key, { page: nextPage, pageSize, ...searchParams }],
            queryFn: () => fetchFn({ page: nextPage, pageSize, ...searchParams }),
          });
        }
      }
    }
  }, [query.data, prefetchPages, key, pageSize, searchParams]);

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const updateSearchParams = useCallback((params: Record<string, any>) => {
    setSearchParams(params);
    setPage(1); // Reset to first page on search
  }, []);

  return {
    ...query,
    page,
    goToPage,
    updateSearchParams,
    hasNextPage: query.data ? query.data.page < query.data.totalPages : false,
    hasPreviousPage: page > 1,
  };
}

/**
 * Hook for infinite scroll queries with store sync
 */
export function useInfiniteStoreQuery<TData extends { id: string }>(
  key: any[],
  fetchFn: (params: any) => Promise<PaginatedResponse<TData>>,
  options?: {
    pageSize?: number;
    syncWithStore?: (items: TData[]) => void;
  }
) {
  const { pageSize = 20, syncWithStore } = options || {};

  const query = useInfiniteQuery({
    queryKey: [...key, { pageSize }],
    queryFn: ({ pageParam = 1 }) => fetchFn({ page: pageParam, pageSize }),
    getNextPageParam: (lastPage) => {
      return lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined;
    },
    getPreviousPageParam: (firstPage) => {
      return firstPage.page > 1 ? firstPage.page - 1 : undefined;
    },
  });

  // Sync all items with store when data changes
  useEffect(() => {
    if (query.data && syncWithStore) {
      const allItems = query.data.pages.flatMap((page) => page.items);
      syncWithStore(allItems);
    }
  }, [query.data, syncWithStore]);

  // Auto-fetch next page when near bottom
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback(
    (node: HTMLElement | null) => {
      if (query.isLoading) return;

      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage) {
          query.fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [query.isLoading, query.hasNextPage, query.fetchNextPage]
  );

  return {
    ...query,
    loadMoreRef,
    items: query.data?.pages.flatMap((page) => page.items) || [],
    totalItems: query.data?.pages[0]?.total || 0,
  };
}

/**
 * Hook for managing bookings with store integration
 */
export function useBookingManagement(projectId: string) {
  const activeProject = useProjectStore((state) => state.activeProject);
  const toast = useUIStore((state) => state.toast);

  // Query for bookings list
  const bookingsQuery = usePaginatedStoreQuery(
    queryKeys.bookings.list(projectId),
    (params) => api.get<PaginatedResponse<Booking>>(`/projects/${projectId}/bookings`, { params }),
    {
      pageSize: 20,
      prefetchPages: 2,
    }
  );

  // Create booking mutation with optimistic update
  const createBooking = useStoreMutation({
    mutationFn: (data: Partial<Booking>) =>
      api.post<Booking>(`/projects/${projectId}/bookings`, data),
    optimisticUpdate: {
      queryKey: queryKeys.bookings.list(projectId),
      updater: (variables) => {
        optimisticUpdateManager.applyOptimisticListUpdate(
          queryKeys.bookings.list(projectId),
          { ...variables, id: `temp-${Date.now()}` } as Booking,
          "add"
        );
      },
    },
    invalidateKeys: [queryKeys.bookings.all(projectId), queryKeys.dashboard.all(projectId)],
    onSuccess: (data) => {
      toast.success("Booking created", `Booking ${data.id} has been created successfully`);
    },
  });

  // Update booking mutation
  const updateBooking = useStoreMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Booking> }) =>
      api.patch<Booking>(`/projects/${projectId}/bookings/${id}`, data),
    optimisticUpdate: {
      queryKey: queryKeys.bookings.list(projectId),
      updater: (variables) => {
        optimisticUpdateManager.applyOptimisticListUpdate(
          queryKeys.bookings.list(projectId),
          { ...variables.data, id: variables.id } as Booking,
          "update"
        );
      },
    },
    invalidateKeys: [queryKeys.bookings.all(projectId), queryKeys.dashboard.all(projectId)],
  });

  // Cancel booking mutation
  const cancelBooking = useStoreMutation({
    mutationFn: (bookingId: string) =>
      api.post(`/projects/${projectId}/bookings/${bookingId}/cancel`),
    optimisticUpdate: {
      queryKey: queryKeys.bookings.list(projectId),
      updater: (bookingId) => {
        optimisticUpdateManager.applyOptimisticListUpdate(
          queryKeys.bookings.list(projectId),
          { id: bookingId } as Booking,
          "remove"
        );
      },
    },
    invalidateKeys: [
      queryKeys.bookings.all(projectId),
      queryKeys.dashboard.all(projectId),
      queryKeys.properties.all(projectId),
    ],
    onSuccess: () => {
      toast.success("Booking cancelled", "The booking has been cancelled successfully");
    },
  });

  return {
    bookings: bookingsQuery,
    createBooking,
    updateBooking,
    cancelBooking,
  };
}

/**
 * Hook for managing expenses with store integration
 */
export function useExpenseManagement(projectId: string) {
  const toast = useUIStore((state) => state.toast);

  // Query for expenses list
  const expensesQuery = usePaginatedStoreQuery(
    queryKeys.expenses.list(projectId),
    (params) => api.get<PaginatedResponse<Expense>>(`/projects/${projectId}/expenses`, { params }),
    {
      pageSize: 20,
      prefetchPages: 1,
    }
  );

  // Create expense mutation with optimistic update
  const createExpense = useStoreMutation({
    mutationFn: (data: Partial<Expense>) =>
      api.post<Expense>(`/projects/${projectId}/expenses`, data),
    optimisticUpdate: {
      queryKey: queryKeys.expenses.list(projectId),
      updater: (variables) => {
        optimisticUpdateManager.applyOptimisticListUpdate(
          queryKeys.expenses.list(projectId),
          { ...variables, id: `temp-${Date.now()}`, status: "PENDING" } as Expense,
          "add"
        );
      },
    },
    invalidateKeys: [
      queryKeys.expenses.all(projectId),
      queryKeys.dashboard.all(projectId),
      queryKeys.reports.all(projectId),
    ],
    onSuccess: (data) => {
      toast.success("Expense created", `Expense ${data.id} has been created successfully`);
    },
  });

  // Approve expense mutation
  const approveExpense = useStoreMutation({
    mutationFn: (expenseId: string) =>
      api.post(`/projects/${projectId}/expenses/${expenseId}/approve`),
    optimisticUpdate: {
      queryKey: queryKeys.expenses.detail(projectId, expenseId),
      updater: () => {
        optimisticUpdateManager.applyOptimisticDetailUpdate(
          queryKeys.expenses.detail(projectId, expenseId),
          (old: Expense) => ({ ...old, status: "APPROVED" })
        );
      },
    },
    invalidateKeys: [
      queryKeys.expenses.all(projectId),
      queryKeys.dashboard.all(projectId),
      queryKeys.reports.financial(projectId),
    ],
    onSuccess: () => {
      toast.success("Expense approved", "The expense has been approved successfully");
    },
  });

  // Reject expense mutation
  const rejectExpense = useStoreMutation({
    mutationFn: ({ expenseId, reason }: { expenseId: string; reason: string }) =>
      api.post(`/projects/${projectId}/expenses/${expenseId}/reject`, { reason }),
    invalidateKeys: [queryKeys.expenses.all(projectId), queryKeys.dashboard.all(projectId)],
    onSuccess: () => {
      toast.warning("Expense rejected", "The expense has been rejected");
    },
  });

  return {
    expenses: expensesQuery,
    createExpense,
    approveExpense,
    rejectExpense,
  };
}

/**
 * Hook for managing properties with store integration
 */
export function usePropertyManagement(projectId: string) {
  const properties = useProjectStore((state) => state.properties);
  const setProperties = useProjectStore((state) => state.setProperties);
  const toast = useUIStore((state) => state.toast);

  // Query for properties with store sync
  const propertiesQuery = useStoreQuery({
    queryKey: queryKeys.properties.list(projectId),
    queryFn: () => api.get<Property[]>(`/projects/${projectId}/properties`),
    syncWithStore: setProperties,
    staleTime: 10 * 60 * 1000, // Properties change less frequently
  });

  // Create property mutation
  const createProperty = useStoreMutation({
    mutationFn: (data: Partial<Property>) =>
      api.post<Property>(`/projects/${projectId}/properties`, data),
    invalidateKeys: [queryKeys.properties.all(projectId), queryKeys.dashboard.stats(projectId)],
    onSuccess: (data) => {
      // Update store directly
      setProperties([...properties, data]);
      toast.success("Property created", `${data.name} has been created successfully`);
    },
  });

  // Update property mutation
  const updateProperty = useStoreMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Property> }) =>
      api.patch<Property>(`/projects/${projectId}/properties/${id}`, data),
    invalidateKeys: [queryKeys.properties.all(projectId), queryKeys.bookings.all(projectId)],
    onSuccess: (data) => {
      // Update store directly
      setProperties(properties.map((p) => (p.id === data.id ? data : p)));
      toast.success("Property updated", `${data.name} has been updated successfully`);
    },
  });

  // Delete property mutation
  const deleteProperty = useStoreMutation({
    mutationFn: (propertyId: string) =>
      api.delete(`/projects/${projectId}/properties/${propertyId}`),
    optimisticUpdate: {
      queryKey: queryKeys.properties.list(projectId),
      updater: (propertyId) => {
        // Remove from store immediately
        setProperties(properties.filter((p) => p.id !== propertyId));
      },
    },
    invalidateKeys: [
      queryKeys.properties.all(projectId),
      queryKeys.bookings.all(projectId),
      queryKeys.dashboard.all(projectId),
    ],
    onSuccess: () => {
      toast.success("Property deleted", "The property has been deleted successfully");
    },
  });

  return {
    properties: propertiesQuery,
    createProperty,
    updateProperty,
    deleteProperty,
  };
}

/**
 * Hook for route-aware data fetching
 */
export function useRouteData<TData>(
  route: string,
  fetchFn: () => Promise<TData>,
  options?: {
    staleTime?: number;
    cacheTime?: number;
    enabled?: boolean;
  }
) {
  const currentRoute = useNavigationStore((state) => state.currentRoute);
  const isRouteActive = currentRoute === route;

  // Store route state for persistence
  useEffect(() => {
    if (isRouteActive && data) {
      routeStateManager.setRouteState(route, data);
    }
  }, [isRouteActive, data, route]);

  // Register cleanup
  useEffect(() => {
    return () => {
      if (isRouteActive) {
        routeStateManager.cleanupRoute(route);
      }
    };
  }, [isRouteActive, route]);

  const { data, ...rest } = useStoreQuery({
    queryKey: ["route", route],
    queryFn: fetchFn,
    enabled: isRouteActive && options?.enabled !== false,
    staleTime: options?.staleTime,
    cacheTime: options?.cacheTime,
  });

  // Return cached route state if available
  const cachedData = routeStateManager.getRouteState<TData>(route);

  return {
    data: data || cachedData,
    ...rest,
  };
}

// Re-export for convenience
export { useState, useCallback, useEffect } from "react";
