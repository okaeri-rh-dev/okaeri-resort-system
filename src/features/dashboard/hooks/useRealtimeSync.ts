/**
 * useRealtimeSync Hook - WebSocket coordination with TanStack Query
 * Phase 2.1 - TDD GREEN: Minimal implementation for realtime synchronization
 */

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeStore } from "../stores/realtimeStore";
import { useDashboardStore } from "../stores/dashboardStore";

interface RealtimeSyncOptions {
  projectId: string;
  websocketUrl?: string;
  enableMultiTab?: boolean;
  performanceMonitoring?: boolean;
  autoConnect?: boolean;
}

interface PerformanceMetrics {
  messageLatency: number;
  cacheHitRate: number;
  invalidationCount: number;
  reconnectionCount: number;
}

export function useRealtimeSync(options: RealtimeSyncOptions) {
  const {
    projectId,
    websocketUrl = `wss://api.okaeri.ph/ws/${projectId}`,
    enableMultiTab = true,
    performanceMonitoring = true,
    autoConnect = true,
  } = options;

  const queryClient = useQueryClient();
  const realtimeStore = useRealtimeStore();
  const dashboardStore = useDashboardStore();

  const performanceMetrics = useRef<PerformanceMetrics>({
    messageLatency: 0,
    cacheHitRate: 0,
    invalidationCount: 0,
    reconnectionCount: 0,
  });

  const messageTimestamps = useRef<Map<string, number>>(new Map());

  // Initialize WebSocket connection
  useEffect(() => {
    if (autoConnect) {
      realtimeStore.connect(websocketUrl);
    }

    return () => {
      realtimeStore.disconnect();
    };
  }, [websocketUrl, autoConnect, realtimeStore]);

  // Cache invalidation handler
  const handleCacheInvalidation = useCallback(
    (message: any) => {
      const { type, data, queryKeys } = message;

      if (performanceMonitoring) {
        performanceMetrics.current.invalidationCount++;
      }

      // Specific invalidation based on message type
      switch (type) {
        case "metric_update":
          queryClient.invalidateQueries({
            queryKey: ["dashboard", projectId, "stats"],
          });

          // Update store directly for immediate UI response
          if (data.metrics) {
            dashboardStore.updateMetrics?.(data.metrics);
          }
          break;

        case "booking_update":
          queryClient.invalidateQueries({
            queryKey: ["dashboard", projectId, "bookings"],
          });
          queryClient.invalidateQueries({
            queryKey: ["bookings", projectId],
          });
          break;

        case "financial_update":
          queryClient.invalidateQueries({
            queryKey: ["dashboard", projectId, "revenue"],
          });
          break;

        case "occupancy_update":
          queryClient.invalidateQueries({
            queryKey: ["dashboard", projectId, "occupancy"],
          });
          break;

        case "activity_update":
          queryClient.invalidateQueries({
            queryKey: ["dashboard", projectId, "activities"],
          });
          break;

        case "bulk_invalidation":
          // Handle bulk invalidation for efficiency
          if (queryKeys && Array.isArray(queryKeys)) {
            queryKeys.forEach((key: string[]) => {
              queryClient.invalidateQueries({ queryKey: key });
            });
          }
          break;

        default:
          // Fallback: invalidate all dashboard queries
          queryClient.invalidateQueries({
            queryKey: ["dashboard", projectId],
          });
      }
    },
    [queryClient, projectId, dashboardStore, performanceMonitoring]
  );

  // Multi-tab synchronization
  const handleMultiTabSync = useCallback(
    (message: any) => {
      if (!enableMultiTab) return;

      // Broadcast to other tabs via BroadcastChannel
      const channel = new BroadcastChannel(`dashboard-${projectId}`);
      channel.postMessage(message);

      // Listen for messages from other tabs
      channel.addEventListener("message", (event) => {
        if (event.data.source !== window.location.href) {
          handleCacheInvalidation(event.data);
        }
      });

      return () => {
        channel.close();
      };
    },
    [enableMultiTab, projectId, handleCacheInvalidation]
  );

  // Performance monitoring
  const trackPerformance = useCallback(
    (messageId: string, type: "send" | "receive") => {
      if (!performanceMonitoring) return;

      const now = Date.now();

      if (type === "send") {
        messageTimestamps.current.set(messageId, now);
      } else if (type === "receive") {
        const sentAt = messageTimestamps.current.get(messageId);
        if (sentAt) {
          const latency = now - sentAt;
          performanceMetrics.current.messageLatency =
            (performanceMetrics.current.messageLatency + latency) / 2;
          messageTimestamps.current.delete(messageId);
        }
      }
    },
    [performanceMonitoring]
  );

  // Subscribe to realtime updates
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Subscribe to metric updates
    const unsubMetrics = realtimeStore.subscribe("metric_update", (data) => {
      handleCacheInvalidation({ type: "metric_update", data });
      handleMultiTabSync({ type: "metric_update", data, source: window.location.href });
    });
    unsubscribers.push(unsubMetrics);

    // Subscribe to booking updates
    const unsubBookings = realtimeStore.subscribe("booking_update", (data) => {
      handleCacheInvalidation({ type: "booking_update", data });
      handleMultiTabSync({ type: "booking_update", data, source: window.location.href });
    });
    unsubscribers.push(unsubBookings);

    // Subscribe to financial updates
    const unsubFinancial = realtimeStore.subscribe("financial_update", (data) => {
      handleCacheInvalidation({ type: "financial_update", data });
      handleMultiTabSync({ type: "financial_update", data, source: window.location.href });
    });
    unsubscribers.push(unsubFinancial);

    // Subscribe to occupancy updates
    const unsubOccupancy = realtimeStore.subscribe("occupancy_update", (data) => {
      handleCacheInvalidation({ type: "occupancy_update", data });
      handleMultiTabSync({ type: "occupancy_update", data, source: window.location.href });
    });
    unsubscribers.push(unsubOccupancy);

    // Subscribe to activity updates
    const unsubActivity = realtimeStore.subscribe("activity_update", (data) => {
      handleCacheInvalidation({ type: "activity_update", data });
      handleMultiTabSync({ type: "activity_update", data, source: window.location.href });
    });
    unsubscribers.push(unsubActivity);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [realtimeStore, handleCacheInvalidation, handleMultiTabSync]);

  // Query client configuration based on connection status
  useEffect(() => {
    const isConnected = realtimeStore.ws.status === "connected";

    // Adjust query configurations based on connection status
    queryClient.setDefaultOptions({
      queries: {
        staleTime: isConnected ? Infinity : 5 * 60 * 1000, // 5 minutes if offline
        refetchOnWindowFocus: !isConnected,
        refetchInterval: isConnected ? false : 30 * 1000, // Poll every 30s if offline
      },
    });
  }, [realtimeStore.ws.status, queryClient]);

  // Optimistic cache updates for better perceived performance
  const updateCacheOptimistically = useCallback(
    (key: string[], updater: (oldData: any) => any) => {
      queryClient.setQueryData(key, (oldData) => {
        if (!oldData) return oldData;

        try {
          return updater(oldData);
        } catch (error) {
          console.warn("Optimistic cache update failed:", error);
          return oldData;
        }
      });
    },
    [queryClient]
  );

  // Prefetch related data based on current activity
  const prefetchRelatedData = useCallback(
    async (context: string) => {
      switch (context) {
        case "dashboard_load":
          // Prefetch commonly accessed data
          await Promise.all([
            queryClient.prefetchQuery({
              queryKey: ["dashboard", projectId, "activities"],
              staleTime: 1 * 60 * 1000, // 1 minute
            }),
            queryClient.prefetchQuery({
              queryKey: ["dashboard", projectId, "bookings", "upcoming"],
              staleTime: 5 * 60 * 1000, // 5 minutes
            }),
          ]);
          break;

        case "booking_focus":
          await queryClient.prefetchQuery({
            queryKey: ["bookings", projectId, "details"],
            staleTime: 2 * 60 * 1000, // 2 minutes
          });
          break;

        case "financial_focus":
          await queryClient.prefetchQuery({
            queryKey: ["dashboard", projectId, "revenue", "detailed"],
            staleTime: 10 * 60 * 1000, // 10 minutes
          });
          break;
      }
    },
    [queryClient, projectId]
  );

  // Get performance metrics
  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    if (!performanceMonitoring) {
      return {
        messageLatency: 0,
        cacheHitRate: 0,
        invalidationCount: 0,
        reconnectionCount: 0,
      };
    }

    // Calculate cache hit rate
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();
    const hits = queries.filter((q) => q.state.dataUpdatedAt > 0).length;
    const cacheHitRate = queries.length > 0 ? (hits / queries.length) * 100 : 0;

    return {
      ...performanceMetrics.current,
      cacheHitRate,
      reconnectionCount: realtimeStore.ws.reconnectAttempts,
    };
  }, [performanceMonitoring, queryClient, realtimeStore.ws.reconnectAttempts]);

  // Manual sync trigger for testing/debugging
  const triggerSync = useCallback(
    (type: string, data: any) => {
      handleCacheInvalidation({ type, data });
    },
    [handleCacheInvalidation]
  );

  // Connection health check
  const isHealthy = useCallback(() => {
    const metrics = getPerformanceMetrics();
    return (
      realtimeStore.ws.status === "connected" &&
      metrics.messageLatency < 1000 && // Less than 1 second latency
      metrics.reconnectionCount < 3 // Less than 3 reconnection attempts
    );
  }, [realtimeStore.ws.status, getPerformanceMetrics]);

  return {
    // Connection status
    isConnected: realtimeStore.ws.status === "connected",
    connectionStatus: realtimeStore.ws.status,

    // Performance monitoring
    performanceMetrics: getPerformanceMetrics(),
    isHealthy: isHealthy(),

    // Manual controls
    connect: () => realtimeStore.connect(websocketUrl),
    disconnect: () => realtimeStore.disconnect(),
    triggerSync,

    // Cache management
    updateCacheOptimistically,
    prefetchRelatedData,

    // Utilities
    trackPerformance,
  };
}
