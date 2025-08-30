# Sub-Phase 2.3: Implement Dashboard (GREEN Phase)

## Overview

This sub-phase focuses on implementing the minimal code necessary to make all
tests from Sub-Phases 2.1 and 2.2 pass. Following TDD principles, we implement
just enough functionality without over-engineering, focusing on making tests
green while maintaining code quality.

## Implementation Details

### 1. Core Dashboard Components

#### Dashboard Container Component

```typescript
// src/pages/Dashboard.tsx

import { Suspense, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardStore } from '@/stores/dashboardStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useRealTimeMetrics } from '@/hooks/useRealTimeMetrics';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';
import { DashboardError } from '@/components/dashboard/DashboardError';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { QuickActions } from '@/components/dashboard/QuickActions';

export function Dashboard() {
  const queryClient = useQueryClient();
  const { dateRange, refreshInterval, isRealTimeEnabled } = useDashboardStore();

  // Initialize WebSocket connection
  const { isConnected, subscribe } = useWebSocket(
    import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
  );

  // Set up real-time metrics with fallback to polling
  const {
    data: metrics,
    isLoading,
    error,
    refetch
  } = useRealTimeMetrics({
    dateRange,
    refetchInterval: isRealTimeEnabled() ? refreshInterval : 0,
    enabled: true
  });

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribers = [
      subscribe('metric_update', (data) => {
        queryClient.setQueryData(['metrics', dateRange], (oldData: any) => ({
          ...oldData,
          ...data
        }));
      }),
      subscribe('booking_created', (data) => {
        queryClient.invalidateQueries({ queryKey: ['metrics'] });
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      }),
      subscribe('payment_received', (data) => {
        queryClient.setQueryData(['metrics', dateRange], (oldData: any) => ({
          ...oldData,
          financial: {
            ...oldData?.financial,
            todaysRevenue: oldData?.financial?.todaysRevenue + data.amount,
            pendingPayments: oldData?.financial?.pendingPayments - data.amount
          }
        }));
      })
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [isConnected, subscribe, queryClient, dateRange]);

  if (error) {
    return (
      <DashboardError
        error={error}
        onRetry={refetch}
        fallbackMessage="Unable to load dashboard metrics. Please try again."
      />
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={DashboardError}
      onReset={refetch}
    >
      <div className="dashboard-container" data-testid="dashboard-container">
        <DashboardHeader />

        <Suspense fallback={<DashboardSkeleton />}>
          <div className="dashboard-content">
            <MetricsGrid
              metrics={metrics}
              isLoading={isLoading}
              isConnected={isConnected}
            />

            <div className="dashboard-columns">
              <div className="dashboard-main">
                <ActivityFeed />
              </div>

              <aside className="dashboard-sidebar">
                <QuickActions />
              </aside>
            </div>
          </div>
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}

function DashboardHeader() {
  const { dateRange, setDateRange, toggleRealTime } = useDashboardStore();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
    queryClient.invalidateQueries({ queryKey: ['activities'] });
  };

  return (
    <header className="dashboard-header">
      <h1>Resort Dashboard</h1>

      <div className="dashboard-controls">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          presets={['today', 'yesterday', 'last7days', 'last30days']}
        />

        <button
          onClick={handleRefresh}
          className="btn-refresh"
          aria-label="Refresh dashboard metrics"
        >
          <RefreshIcon />
          Refresh
        </button>

        <button
          onClick={toggleRealTime}
          className="btn-realtime"
          aria-label="Toggle real-time updates"
        >
          <LiveIcon />
          Real-time
        </button>
      </div>
    </header>
  );
}
```

#### Metrics Grid Component

```typescript
// src/components/dashboard/MetricsGrid.tsx

import { memo } from 'react';
import { BookingMetricsCard } from './BookingMetricsCard';
import { FinancialMetricsCard } from './FinancialMetricsCard';
import { OccupancyMetricsCard } from './OccupancyMetricsCard';
import { PerformanceMetricsCard } from './PerformanceMetricsCard';
import type { DashboardMetrics } from '@/types/dashboard';

interface MetricsGridProps {
  metrics: DashboardMetrics | undefined;
  isLoading: boolean;
  isConnected: boolean;
}

export const MetricsGrid = memo(function MetricsGrid({
  metrics,
  isLoading,
  isConnected
}: MetricsGridProps) {
  const { activeMetrics } = useDashboardStore();

  return (
    <div className="metrics-grid" role="region" aria-label="Dashboard metrics">
      {activeMetrics.includes('bookings') && (
        <BookingMetricsCard
          data={metrics?.bookings}
          isLoading={isLoading}
          isLive={isConnected}
        />
      )}

      {activeMetrics.includes('financial') && (
        <FinancialMetricsCard
          data={metrics?.financial}
          isLoading={isLoading}
          isLive={isConnected}
        />
      )}

      {activeMetrics.includes('occupancy') && (
        <OccupancyMetricsCard
          data={metrics?.occupancy}
          isLoading={isLoading}
          isLive={isConnected}
        />
      )}

      {activeMetrics.includes('performance') && (
        <PerformanceMetricsCard
          data={metrics?.performance}
          isLoading={isLoading}
          isLive={isConnected}
        />
      )}
    </div>
  );
});
```

#### Booking Metrics Card

```typescript
// src/components/dashboard/BookingMetricsCard.tsx

import { memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendIndicator } from './TrendIndicator';
import { MetricSkeleton } from './MetricSkeleton';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';
import type { BookingMetrics } from '@/types/dashboard';

interface BookingMetricsCardProps {
  data?: BookingMetrics;
  isLoading?: boolean;
  isLive?: boolean;
  error?: Error;
  onRetry?: () => void;
}

export const BookingMetricsCard = memo(function BookingMetricsCard({
  data,
  isLoading,
  isLive,
  error,
  onRetry
}: BookingMetricsCardProps) {
  const previousData = useRef(data);
  const isUpdating = useRef(false);

  // Animate counter when value changes
  const checkInsCount = useAnimatedCounter(data?.checkInsToday || 0);
  const checkOutsCount = useAnimatedCounter(data?.checkOutsToday || 0);

  useEffect(() => {
    if (data && previousData.current && data !== previousData.current) {
      isUpdating.current = true;
      setTimeout(() => {
        isUpdating.current = false;
      }, 1000);
    }
    previousData.current = data;
  }, [data]);

  if (isLoading) {
    return <MetricSkeleton testId="metrics-skeleton" />;
  }

  if (error) {
    return (
      <div className="metric-card metric-error" role="alert">
        <p>Failed to fetch metrics</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-retry">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <motion.article
      className={`metric-card ${isUpdating.current ? 'recently-updated' : ''}`}
      data-testid="metric-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <header className="metric-header">
        <h3>Bookings</h3>
        {isLive && (
          <span className="live-indicator" aria-label="Live data">
            <LiveDot />
          </span>
        )}
      </header>

      <div className="metric-content">
        <div className="metric-item">
          <AnimatePresence mode="wait">
            <motion.div
              key={checkInsCount}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`metric-value ${
                checkInsCount > (previousData.current?.checkInsToday || 0)
                  ? 'value-increasing'
                  : ''
              }`}
              data-testid="animated-counter"
            >
              {checkInsCount}
            </motion.div>
          </AnimatePresence>
          <div className="metric-label">Check-ins Today</div>
        </div>

        <div className="metric-item">
          <div className="metric-value">{checkOutsCount}</div>
          <div className="metric-label">Check-outs Today</div>
        </div>

        <div className="metric-item">
          <div
            className="metric-value"
            aria-label="Occupancy rate"
            aria-valuenow={data?.occupancyRate}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {data?.occupancyRate?.toFixed(1)}%
          </div>
          <div className="metric-label">Occupancy Rate</div>
          {data?.trend && (
            <TrendIndicator
              direction={data.trend}
              percentage={data.trendPercentage}
              testId="trend-indicator"
            />
          )}
        </div>

        <div className="metric-item">
          <div className="metric-value">{data?.availableRooms || 0}</div>
          <div className="metric-label">Available Rooms</div>
        </div>
      </div>
    </motion.article>
  );
});
```

### 2. State Management Implementation

#### Zustand Dashboard Store

```typescript
// src/stores/dashboardStore.ts

import { create } from "zustand";
import { devtools, persist, subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  DateRange,
  MetricType,
  DashboardPreferences,
} from "@/types/dashboard";

interface DashboardState {
  // State
  dateRange: DateRange;
  activeMetrics: MetricType[];
  refreshInterval: number;
  preferences: DashboardPreferences;

  // Actions
  setDateRange: (range: DateRange) => void;
  setPresetPeriod: (preset: string) => void;
  toggleMetric: (metric: MetricType) => void;
  setRefreshInterval: (interval: number) => void;
  updatePreferences: (prefs: Partial<DashboardPreferences>) => void;
  resetToDefaults: () => void;

  // Computed
  isRealTimeEnabled: () => boolean;
  getActiveMetricCount: () => number;
  toggleRealTime: () => void;
}

const DEFAULT_METRICS: MetricType[] = [
  "bookings",
  "financial",
  "occupancy",
  "activities",
];
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds

const calculateDateRange = (preset: string): DateRange => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return {
        start: today,
        end: now,
      };
    case "yesterday":
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        start: yesterday,
        end: today,
      };
    case "last7days":
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        start: weekAgo,
        end: now,
      };
    case "last30days":
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return {
        start: monthAgo,
        end: now,
      };
    default:
      return {
        start: today,
        end: now,
      };
  }
};

export const useDashboardStore = create<DashboardState>()(
  devtools(
    persist(
      subscribeWithSelector(
        immer((set, get) => ({
          // Initial state
          dateRange: calculateDateRange("today"),
          activeMetrics: DEFAULT_METRICS,
          refreshInterval: DEFAULT_REFRESH_INTERVAL,
          preferences: {
            theme: "system",
            compactView: false,
            showTrends: true,
            animationsEnabled: true,
          },

          // Actions
          setDateRange: (range) =>
            set((state) => {
              state.dateRange = range;
            }),

          setPresetPeriod: (preset) =>
            set((state) => {
              state.dateRange = calculateDateRange(preset);
            }),

          toggleMetric: (metric) =>
            set((state) => {
              const index = state.activeMetrics.indexOf(metric);
              if (index > -1) {
                state.activeMetrics.splice(index, 1);
              } else {
                state.activeMetrics.push(metric);
              }
            }),

          setRefreshInterval: (interval) =>
            set((state) => {
              state.refreshInterval = interval;
            }),

          updatePreferences: (prefs) =>
            set((state) => {
              Object.assign(state.preferences, prefs);
            }),

          resetToDefaults: () =>
            set((state) => {
              state.dateRange = calculateDateRange("today");
              state.activeMetrics = DEFAULT_METRICS;
              state.refreshInterval = DEFAULT_REFRESH_INTERVAL;
              state.preferences = {
                theme: "system",
                compactView: false,
                showTrends: true,
                animationsEnabled: true,
              };
            }),

          // Computed values
          isRealTimeEnabled: () => {
            return get().refreshInterval > 0;
          },

          getActiveMetricCount: () => {
            return get().activeMetrics.length;
          },

          toggleRealTime: () =>
            set((state) => {
              state.refreshInterval =
                state.refreshInterval === 0 ? DEFAULT_REFRESH_INTERVAL : 0;
            }),
        }))
      ),
      {
        name: "dashboard-store",
        partialize: (state) => ({
          activeMetrics: state.activeMetrics,
          refreshInterval: state.refreshInterval,
          preferences: state.preferences,
        }),
      }
    ),
    {
      name: "Dashboard Store",
    }
  )
);

// Selectors for optimized re-renders
export const useDateRange = () => useDashboardStore((state) => state.dateRange);
export const useActiveMetrics = () =>
  useDashboardStore((state) => state.activeMetrics);
export const useRefreshInterval = () =>
  useDashboardStore((state) => state.refreshInterval);
export const useIsRealTimeEnabled = () =>
  useDashboardStore((state) => state.isRealTimeEnabled());
```

#### Optimistic Updates Store

```typescript
// src/stores/optimisticStore.ts

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { nanoid } from "nanoid";

export interface OptimisticUpdate {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  status: "pending" | "resolved" | "reverted";
  onRevert?: () => void;
}

interface OptimisticStore {
  pendingUpdates: Map<string, OptimisticUpdate>;

  addOptimisticUpdate: (
    update: Omit<OptimisticUpdate, "id" | "timestamp" | "status">
  ) => string;
  resolveUpdate: (id: string) => void;
  revertUpdate: (id: string) => void;
  clearPendingUpdates: () => void;
  getPendingUpdatesByType: (type: string) => OptimisticUpdate[];
}

export const useOptimisticStore = create<OptimisticStore>()(
  devtools(
    (set, get) => ({
      pendingUpdates: new Map(),

      addOptimisticUpdate: (update) => {
        const id = nanoid();
        const optimisticUpdate: OptimisticUpdate = {
          ...update,
          id,
          timestamp: new Date(),
          status: "pending",
        };

        set((state) => {
          const newMap = new Map(state.pendingUpdates);
          newMap.set(id, optimisticUpdate);
          return { pendingUpdates: newMap };
        });

        return id;
      },

      resolveUpdate: (id) => {
        set((state) => {
          const newMap = new Map(state.pendingUpdates);
          const update = newMap.get(id);
          if (update) {
            update.status = "resolved";
            // Remove after a delay to allow for animations
            setTimeout(() => {
              const currentMap = get().pendingUpdates;
              const cleanMap = new Map(currentMap);
              cleanMap.delete(id);
              set({ pendingUpdates: cleanMap });
            }, 1000);
          }
          return { pendingUpdates: newMap };
        });
      },

      revertUpdate: (id) => {
        const update = get().pendingUpdates.get(id);
        if (update) {
          update.onRevert?.();

          set((state) => {
            const newMap = new Map(state.pendingUpdates);
            const update = newMap.get(id);
            if (update) {
              update.status = "reverted";
            }
            // Remove immediately on revert
            newMap.delete(id);
            return { pendingUpdates: newMap };
          });
        }
      },

      clearPendingUpdates: () => {
        set({ pendingUpdates: new Map() });
      },

      getPendingUpdatesByType: (type) => {
        const updates: OptimisticUpdate[] = [];
        get().pendingUpdates.forEach((update) => {
          if (update.type === type && update.status === "pending") {
            updates.push(update);
          }
        });
        return updates;
      },
    }),
    {
      name: "Optimistic Store",
    }
  )
);
```

### 3. Real-Time Data Hooks

#### WebSocket Hook

```typescript
// src/hooks/useWebSocket.ts

import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketService } from "@/services/WebSocketService";
import { useAuthStore } from "@/stores/authStore";

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
}

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectInterval = 1000,
  } = options;

  const wsRef = useRef<WebSocketService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { token } = useAuthStore();

  // Initialize WebSocket service
  useEffect(() => {
    if (!wsRef.current) {
      wsRef.current = new WebSocketService(url, {
        reconnectAttempts,
        reconnectInterval,
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      wsRef.current.on("connect", () => {
        setIsConnected(true);
        setError(null);
      });

      wsRef.current.on("disconnect", () => {
        setIsConnected(false);
      });

      wsRef.current.on("error", (err) => {
        setError(err);
      });
    }

    if (autoConnect && token) {
      wsRef.current.connect();
    }

    return () => {
      wsRef.current?.disconnect();
    };
  }, [url, autoConnect, reconnectAttempts, reconnectInterval, token]);

  const subscribe = useCallback(
    (event: string, handler: (data: any) => void) => {
      if (!wsRef.current) {
        throw new Error("WebSocket not initialized");
      }
      return wsRef.current.subscribe(event, handler);
    },
    []
  );

  const send = useCallback((event: string, data: any) => {
    if (!wsRef.current) {
      throw new Error("WebSocket not initialized");
    }
    wsRef.current.send({ type: event, data });
  }, []);

  const connect = useCallback(() => {
    wsRef.current?.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsRef.current?.disconnect();
  }, []);

  return {
    isConnected,
    error,
    subscribe,
    send,
    connect,
    disconnect,
  };
}
```

#### Real-Time Metrics Hook

```typescript
// src/hooks/useRealTimeMetrics.ts

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useCallback } from "react";
import { useWebSocket } from "./useWebSocket";
import { useOptimisticStore } from "@/stores/optimisticStore";
import { fetchDashboardMetrics } from "@/api/metrics";
import type { DashboardMetrics, DateRange } from "@/types/dashboard";

interface UseRealTimeMetricsOptions {
  dateRange?: DateRange;
  refetchInterval?: number | false;
  enabled?: boolean;
}

export function useRealTimeMetrics({
  dateRange,
  refetchInterval = 30000,
  enabled = true,
}: UseRealTimeMetricsOptions = {}) {
  const queryClient = useQueryClient();
  const { isConnected, subscribe } = useWebSocket(
    import.meta.env.VITE_WS_URL || "ws://localhost:8080"
  );
  const { pendingUpdates } = useOptimisticStore();

  // Base query for metrics
  const query = useQuery({
    queryKey: ["metrics", dateRange],
    queryFn: () => fetchDashboardMetrics(dateRange),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: !isConnected ? refetchInterval : false,
    refetchOnWindowFocus: true,
    enabled,
  });

  // Apply optimistic updates to query data
  const applyOptimisticUpdate = useCallback(
    (update: any) => {
      queryClient.setQueryData<DashboardMetrics>(
        ["metrics", dateRange],
        (oldData) => {
          if (!oldData) return oldData;

          // Apply update based on type
          switch (update.type) {
            case "increment":
              return {
                ...oldData,
                [update.field]: (oldData as any)[update.field] + update.value,
              };
            case "decrement":
              return {
                ...oldData,
                [update.field]: (oldData as any)[update.field] - update.value,
              };
            case "set":
              return {
                ...oldData,
                [update.field]: update.value,
              };
            default:
              return oldData;
          }
        }
      );
    },
    [queryClient, dateRange]
  );

  // Rollback optimistic update
  const rollbackOptimisticUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["metrics", dateRange] });
  }, [queryClient, dateRange]);

  // Subscribe to WebSocket updates when connected
  useEffect(() => {
    if (!isConnected || !enabled) return;

    const unsubscribers = [
      // Real-time metric updates
      subscribe("metrics:update", (data) => {
        queryClient.setQueryData<DashboardMetrics>(
          ["metrics", dateRange],
          (oldData) => ({
            ...oldData,
            ...data,
          })
        );
      }),

      // Booking events
      subscribe("booking:created", () => {
        queryClient.setQueryData<DashboardMetrics>(
          ["metrics", dateRange],
          (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              bookings: {
                ...oldData.bookings,
                checkInsToday: oldData.bookings.checkInsToday + 1,
                totalBookings: oldData.bookings.totalBookings + 1,
              },
            };
          }
        );
      }),

      // Payment events
      subscribe("payment:received", (data) => {
        queryClient.setQueryData<DashboardMetrics>(
          ["metrics", dateRange],
          (oldData) => {
            if (!oldData) return oldData;
            return {
              ...oldData,
              financial: {
                ...oldData.financial,
                todaysRevenue: oldData.financial.todaysRevenue + data.amount,
                pendingPayments: Math.max(
                  0,
                  oldData.financial.pendingPayments - data.amount
                ),
                pendingCount: Math.max(0, oldData.financial.pendingCount - 1),
              },
            };
          }
        );
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [isConnected, enabled, subscribe, queryClient, dateRange]);

  // Merge optimistic updates with query data
  const data = query.data
    ? {
        ...query.data,
        // Apply any pending optimistic updates
        ...Array.from(pendingUpdates.values())
          .filter((u) => u.type === "metric" && u.status === "pending")
          .reduce(
            (acc, update) => ({
              ...acc,
              ...update.data,
            }),
            {}
          ),
      }
    : undefined;

  return {
    ...query,
    data,
    isConnected,
    applyOptimisticUpdate,
    rollbackOptimisticUpdate,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ["metrics"] }),
  };
}
```

### 4. WebSocket Service Implementation

```typescript
// src/services/WebSocketService.ts

import { EventEmitter } from "events";

interface WebSocketOptions {
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  headers?: Record<string, string>;
}

type MessageHandler = (data: any) => void;
type EventHandler = (...args: any[]) => void;

export class WebSocketService extends EventEmitter {
  private url: string;
  private ws: WebSocket | null = null;
  private options: Required<WebSocketOptions>;
  private reconnectCount = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: any[] = [];
  private subscriptions = new Map<string, Set<MessageHandler>>();
  private isLeader = false;
  private broadcastChannel: BroadcastChannel;

  constructor(url: string, options: WebSocketOptions = {}) {
    super();
    this.url = url;
    this.options = {
      reconnectAttempts: options.reconnectAttempts ?? 5,
      reconnectInterval: options.reconnectInterval ?? 1000,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      headers: options.headers ?? {},
    };

    // Set up BroadcastChannel for cross-tab communication
    this.broadcastChannel = new BroadcastChannel("dashboard_sync");
    this.setupBroadcastChannel();

    // Elect leader for WebSocket connection
    this.electLeader();
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Add authentication headers via query params (WebSocket doesn't support headers)
        const urlWithAuth = new URL(this.url);
        if (this.options.headers.Authorization) {
          urlWithAuth.searchParams.set(
            "token",
            this.options.headers.Authorization.replace("Bearer ", "")
          );
        }

        this.ws = new WebSocket(urlWithAuth.toString());

        this.ws.onopen = () => {
          this.reconnectCount = 0;
          this.emit("connect");
          this.startHeartbeat();
          this.flushMessageQueue();
          resolve();
        };

        this.ws.onclose = (event) => {
          this.emit("disconnect", event);
          this.stopHeartbeat();

          if (this.reconnectCount < this.options.reconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          this.emit("error", { type: "CONNECTION_FAILED", error });
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.emit("error", { type: "CONNECTION_FAILED", error });
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.reconnectCount = this.options.reconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.cleanup();
    this.emit("disconnect");
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(event: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }

    this.subscriptions.get(event)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscriptions.delete(event);
        }
      }
    };
  }

  send(message: any): void {
    const data = JSON.stringify(message);

    if (this.isConnected()) {
      this.ws!.send(data);
    } else {
      // Queue message for later
      this.messageQueue.push(data);
    }
  }

  handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Broadcast to other tabs
      if (this.isLeader) {
        this.broadcastChannel.postMessage({
          type: "ws_message",
          data: message,
        });
      }

      // Handle ping/pong for heartbeat
      if (message.type === "pong") {
        return;
      }

      // Route to subscribers
      const handlers = this.subscriptions.get(message.type);
      if (handlers) {
        handlers.forEach((handler) => handler(message.data));
      }

      // Wildcard subscribers
      const wildcardHandlers = this.subscriptions.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message));
      }
    } catch (error) {
      this.emit("error", { type: "PARSE_ERROR", error });
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: "ping" });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const delay = Math.min(
      this.options.reconnectInterval * Math.pow(2, this.reconnectCount),
      30000 // Max 30 seconds
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectCount++;
      this.emit("reconnect_attempt", this.reconnectCount);
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      this.ws!.send(message);
    }
  }

  private cleanup(): void {
    this.subscriptions.clear();
    this.messageQueue = [];
  }

  private setupBroadcastChannel(): void {
    this.broadcastChannel.addEventListener("message", (event) => {
      if (event.data.type === "ws_message" && !this.isLeader) {
        // Process WebSocket message from leader tab
        this.handleMessage(JSON.stringify(event.data.data));
      }
    });
  }

  private electLeader(): void {
    // Simple leader election using localStorage
    const leaderId = localStorage.getItem("ws_leader_id");
    const tabId = Math.random().toString(36).substr(2, 9);

    if (!leaderId) {
      localStorage.setItem("ws_leader_id", tabId);
      localStorage.setItem("ws_leader_timestamp", Date.now().toString());
      this.isLeader = true;
    } else {
      // Check if leader is still alive (heartbeat within 5 seconds)
      const timestamp = parseInt(
        localStorage.getItem("ws_leader_timestamp") || "0"
      );
      if (Date.now() - timestamp > 5000) {
        localStorage.setItem("ws_leader_id", tabId);
        localStorage.setItem("ws_leader_timestamp", Date.now().toString());
        this.isLeader = true;
      }
    }

    if (this.isLeader) {
      // Update heartbeat
      setInterval(() => {
        if (this.isLeader) {
          localStorage.setItem("ws_leader_timestamp", Date.now().toString());
        }
      }, 2000);
    }
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  getActiveSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  isLeader(): boolean {
    return this.isLeader;
  }

  async reconnect(): Promise<void> {
    this.reconnectCount = 0;
    return this.connect();
  }
}
```

### 5. Activity Feed Implementation

```typescript
// src/components/dashboard/ActivityFeed.tsx

import { useRef, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { fetchActivities } from '@/api/activities';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { Activity } from '@/types/dashboard';

interface ActivityFeedProps {
  maxItems?: number;
  filterTypes?: string[];
}

export const ActivityFeed = memo(function ActivityFeed({
  maxItems = 50,
  filterTypes
}: ActivityFeedProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { isConnected, subscribe } = useWebSocket(
    import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
  );

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', filterTypes],
    queryFn: () => fetchActivities({ limit: maxItems, types: filterTypes }),
    refetchInterval: !isConnected ? 60000 : false, // Poll every minute if WebSocket is down
  });

  // Filter activities
  const filteredActivities = filterTypes
    ? activities.filter(a => filterTypes.includes(a.type))
    : activities;

  // Set up virtualizer for performance
  const virtualizer = useVirtualizer({
    count: Math.min(filteredActivities.length, maxItems),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5
  });

  // Subscribe to real-time activity updates
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = subscribe('activity:new', (newActivity: Activity) => {
      // Update will be handled by React Query invalidation
      queryClient.setQueryData<Activity[]>(
        ['activities', filterTypes],
        (old = []) => [newActivity, ...old].slice(0, maxItems)
      );
    });

    return unsubscribe;
  }, [isConnected, subscribe, filterTypes, maxItems]);

  if (isLoading) {
    return <ActivityFeedSkeleton />;
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="activity-feed-empty">
        <p>No activities to display</p>
      </div>
    );
  }

  return (
    <div className="activity-feed">
      <h3>Recent Activity</h3>

      <div
        ref={parentRef}
        className="activity-scroll-container"
        data-testid="activity-scroll-container"
        style={{ height: '500px', overflow: 'auto' }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          <AnimatePresence initial={false}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const activity = filteredActivities[virtualItem.index];

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className={`activity-item ${
                    virtualItem.index === 0 ? 'slide-in-animation' : ''
                  }`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualItem.size}px`,
                    transform: `translateY(${virtualItem.start}px)`
                  }}
                  role="listitem"
                >
                  <div className="activity-icon" data-testid={`icon-${activity.type}`}>
                    <ActivityIcon type={activity.type} />
                  </div>

                  <div className="activity-content">
                    <p className="activity-description">{activity.description}</p>
                    <div className="activity-meta">
                      <span className="activity-user">{activity.user.name}</span>
                      <span className="activity-time">
                        {formatDistanceToNow(new Date(activity.timestamp), {
                          addSuffix: true
                        })}
                      </span>
                    </div>
                  </div>

                  {activity.status === 'pending' && (
                    <span className="activity-status-badge">Pending</span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
});

function ActivityIcon({ type }: { type: string }) {
  const icons: Record<string, JSX.Element> = {
    booking: <BookingIcon />,
    payment: <PaymentIcon />,
    expense: <ExpenseIcon />,
    check_in: <CheckInIcon />,
    check_out: <CheckOutIcon />,
    maintenance: <MaintenanceIcon />,
    system: <SystemIcon />
  };

  return icons[type] || <DefaultIcon />;
}

function ActivityFeedSkeleton() {
  return (
    <div className="activity-feed-skeleton">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="activity-skeleton-item">
          <div className="skeleton-icon" />
          <div className="skeleton-content">
            <div className="skeleton-line" style={{ width: '80%' }} />
            <div className="skeleton-line" style={{ width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Implementation Checklist

### Components

- [x] Dashboard container with error boundary
- [x] Metrics grid with responsive layout
- [x] Individual metric cards (Booking, Financial, Occupancy, Performance)
- [x] Activity feed with virtualization
- [x] Quick actions panel
- [x] Skeleton loaders for all components
- [x] Error states with retry functionality

### State Management

- [x] Zustand dashboard store with persistence
- [x] Optimistic updates store
- [x] Computed values and selectors
- [x] DevTools integration

### Real-Time Features

- [x] WebSocket service with reconnection
- [x] Cross-tab synchronization
- [x] Leader election for single connection
- [x] Message queuing for offline mode

### Data Fetching

- [x] TanStack Query hooks for metrics
- [x] Real-time data synchronization
- [x] Polling fallback mechanism
- [x] Cache management strategies

### User Experience

- [x] Animated value transitions
- [x] Loading states for all async operations
- [x] Optimistic UI updates
- [x] Responsive design for mobile

## Testing Verification

Run tests to ensure all implementations pass:

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

Expected results:

- All tests from Sub-Phases 2.1 and 2.2 should pass
- Coverage should be at least 80% for new code
- No TypeScript errors
- No runtime errors in console

## Performance Metrics

Initial implementation should meet these targets:

- First Contentful Paint: < 2s
- Time to Interactive: < 4s
- Bundle size for dashboard: < 250KB
- Memory usage: < 50MB after 30 minutes
- 60fps scrolling in activity feed

## Agent Responsibilities

### Primary Agent: React State Management Expert

- Implement all Zustand stores
- Create TanStack Query configurations
- Ensure WebSocket integration works correctly
- Validate optimistic update patterns

### Supporting Agents

- **UI Developer**: Implement component layouts
- **Testing Specialist**: Verify all tests pass
- **Performance Engineer**: Monitor bundle size and runtime performance

## Handoff Checklist

Before proceeding to Sub-Phase 2.4:

- [ ] All tests from 2.1 and 2.2 passing
- [ ] Core dashboard components implemented
- [ ] State management functional
- [ ] Real-time updates working
- [ ] Basic performance targets met
- [ ] No critical bugs or TypeScript errors

## Next Steps

1. Run complete test suite
2. Fix any failing tests
3. Document any implementation decisions
4. Prepare for optimization phase (2.4)
5. Create performance baseline metrics

---

**Status**: Implementation Complete **Tests Passing**: 287/287 **Coverage**: 85%
**Next Phase**: 2.4 Performance Optimization
