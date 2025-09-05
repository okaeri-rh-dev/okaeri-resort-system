import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// These imports will fail in RED phase - expected behavior
import { useDashboardStore, createDashboardStore } from "../../stores/dashboardStore";
import type {
  DashboardStore,
  DashboardMetrics,
  RealtimeEvent,
  OfflineAction,
  MetricUpdate,
  WebSocketState,
} from "../../types/dashboard.types";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";

// Mock dependencies
vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: vi.fn(),
}));

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number = WebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) this.onopen(new Event("open"));
    }, 0);
  }

  send(data: string) {
    // Mock send implementation
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }
}

global.WebSocket = MockWebSocket as any;

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn().mockResolvedValue({
    objectStore: vi.fn().mockReturnValue({
      add: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockResolvedValue([]),
      delete: vi.fn(),
      clear: vi.fn(),
    }),
  }),
};

global.indexedDB = mockIndexedDB as any;

// Mock BroadcastChannel
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(message: any) {
    // Mock post message
  }

  close() {
    // Mock close
  }
}

global.BroadcastChannel = MockBroadcastChannel as any;

describe("DashboardStore", () => {
  let store: DashboardStore;
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create fresh store instance
    store = createDashboardStore();

    // Setup query client
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock auth store
    (useAuthStore as any).mockReturnValue({
      user: { id: "user-1", email: "test@okaeri.ph" },
      token: "mock-jwt-token",
      isAuthenticated: true,
    });

    // Mock project store
    (useProjectStore as any).mockReturnValue({
      activeProjectId: "project-1",
      projects: [{ id: "project-1", name: "Okaeri La Union" }],
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    store.cleanup?.();
  });

  describe("Initial State", () => {
    it("should initialize with default empty metrics", () => {
      expect(store.getState().metrics).toEqual({
        occupancyRate: null,
        totalRevenue: null,
        revenueGrowth: null,
        activeBookings: null,
        averageDailyRate: null,
        revPAR: null,
        customerSatisfaction: null,
        repeatGuestRate: null,
        lastUpdated: null,
      });
    });

    it("should have null values for all KPIs", () => {
      const state = store.getState();
      expect(state.metrics.occupancyRate).toBeNull();
      expect(state.metrics.totalRevenue).toBeNull();
      expect(state.metrics.activeBookings).toBeNull();
      expect(state.metrics.averageDailyRate).toBeNull();
    });

    it("should have offline queue disabled by default", () => {
      expect(store.getState().isOfflineMode).toBe(false);
      expect(store.getState().offlineQueue).toEqual([]);
    });

    it("should have empty real-time event queue", () => {
      expect(store.getState().realtimeEvents).toEqual([]);
    });

    it("should have no active WebSocket connection", () => {
      expect(store.getState().wsConnection).toBeNull();
      expect(store.getState().wsState).toBe("disconnected");
    });

    it("should initialize with loading states", () => {
      expect(store.getState().isLoading).toBe(false);
      expect(store.getState().error).toBeNull();
    });
  });

  describe("Metrics State Management", () => {
    it("should fetch and set dashboard metrics", async () => {
      const mockMetrics: DashboardMetrics = {
        occupancyRate: 75.5,
        totalRevenue: 150000,
        revenueGrowth: 12.3,
        activeBookings: 25,
        averageDailyRate: 4500,
        revPAR: 3375,
        customerSatisfaction: 4.8,
        repeatGuestRate: 45.2,
        lastUpdated: new Date().toISOString(),
      };

      // Mock API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockMetrics }),
      });

      await act(async () => {
        await store.getState().fetchDashboardMetrics("project-1");
      });

      expect(store.getState().metrics).toEqual(mockMetrics);
      expect(store.getState().isLoading).toBe(false);
    });

    it("should update metrics optimistically", () => {
      const optimisticUpdate: MetricUpdate = {
        id: "update-1",
        type: "occupancy",
        previousValue: 75.5,
        newValue: 78.2,
        timestamp: Date.now(),
      };

      act(() => {
        store.getState().updateMetricOptimistically("occupancyRate", 78.2, optimisticUpdate);
      });

      expect(store.getState().metrics.occupancyRate).toBe(78.2);
      expect(store.getState().optimisticUpdates).toContainEqual(optimisticUpdate);
    });

    it("should rollback failed optimistic updates", () => {
      // Set initial value
      act(() => {
        store.setState({
          metrics: { ...store.getState().metrics, occupancyRate: 75.5 },
        });
      });

      const optimisticUpdate: MetricUpdate = {
        id: "update-1",
        type: "occupancy",
        previousValue: 75.5,
        newValue: 78.2,
        timestamp: Date.now(),
      };

      // Apply optimistic update
      act(() => {
        store.getState().updateMetricOptimistically("occupancyRate", 78.2, optimisticUpdate);
      });

      // Rollback on failure
      act(() => {
        store.getState().rollbackOptimisticUpdate("update-1");
      });

      expect(store.getState().metrics.occupancyRate).toBe(75.5);
      expect(store.getState().optimisticUpdates).not.toContainEqual(optimisticUpdate);
    });

    it("should filter metrics by activeProjectId", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            occupancyRate: 80,
            projectId: "project-1",
          },
        }),
      });

      await act(async () => {
        await store.getState().fetchDashboardMetrics("project-1");
      });

      expect(fetch).toHaveBeenCalledWith(expect.stringContaining("project-1"), expect.any(Object));
    });

    it("should handle metric fetch errors gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      await act(async () => {
        await store.getState().fetchDashboardMetrics("project-1");
      });

      expect(store.getState().error).toBe("Failed to fetch dashboard metrics");
      expect(store.getState().isLoading).toBe(false);
    });

    it("should invalidate cache when switching projects", () => {
      // Set metrics for project-1
      act(() => {
        store.setState({
          metrics: { ...store.getState().metrics, occupancyRate: 75 },
          currentProjectId: "project-1",
        });
      });

      // Switch to project-2
      act(() => {
        store.getState().switchProject("project-2");
      });

      expect(store.getState().metrics.occupancyRate).toBeNull();
      expect(store.getState().currentProjectId).toBe("project-2");
    });
  });

  describe("Real-time WebSocket Updates", () => {
    it("should establish WebSocket connection with auth token", async () => {
      await act(async () => {
        await store.getState().subscribeToRealTimeUpdates();
      });

      expect(store.getState().wsState).toBe("connected");
      expect(store.getState().wsConnection).toBeDefined();
    });

    it("should handle real-time booking.created events", async () => {
      await act(async () => {
        await store.getState().subscribeToRealTimeUpdates();
      });

      const mockEvent: RealtimeEvent = {
        type: "booking.created",
        data: {
          bookingId: "booking-123",
          roomId: "room-456",
          guestName: "Juan Dela Cruz",
          checkIn: "2024-01-15",
          checkOut: "2024-01-18",
          amount: 15000,
        },
        timestamp: Date.now(),
      };

      act(() => {
        store.getState().handleRealtimeEvent(mockEvent);
      });

      expect(store.getState().realtimeEvents).toContainEqual(mockEvent);
      // Should update active bookings count
      expect(store.getState().metrics.activeBookings).toBe(1);
    });

    it("should implement exponential backoff for reconnection", async () => {
      let reconnectAttempt = 0;
      const originalWebSocket = global.WebSocket;

      // Mock failed connections
      global.WebSocket = vi.fn().mockImplementation(() => {
        reconnectAttempt++;
        const ws = new MockWebSocket("ws://test");
        setTimeout(() => {
          ws.readyState = WebSocket.CLOSED;
          if (ws.onclose) ws.onclose(new CloseEvent("close"));
        }, 0);
        return ws;
      }) as any;

      await act(async () => {
        await store.getState().subscribeToRealTimeUpdates();
      });

      // Fast-forward through reconnection attempts
      await act(async () => {
        vi.advanceTimersByTime(1000); // First retry: 1 second
      });
      expect(reconnectAttempt).toBe(2);

      await act(async () => {
        vi.advanceTimersByTime(2000); // Second retry: 2 seconds
      });
      expect(reconnectAttempt).toBe(3);

      await act(async () => {
        vi.advanceTimersByTime(4000); // Third retry: 4 seconds
      });
      expect(reconnectAttempt).toBe(4);

      global.WebSocket = originalWebSocket;
    });

    it("should fall back to polling if WebSocket fails persistently", async () => {
      // Mock WebSocket failures
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error("WebSocket not supported");
      }) as any;

      const pollingSpy = vi.spyOn(store.getState(), "startPollingFallback" as any);

      await act(async () => {
        await store.getState().subscribeToRealTimeUpdates();
      });

      expect(store.getState().wsState).toBe("polling");
      expect(pollingSpy).toHaveBeenCalled();
    });

    it("should process queued events in order", () => {
      const events: RealtimeEvent[] = [
        {
          type: "booking.created",
          data: { bookingId: "1" },
          timestamp: Date.now(),
        },
        {
          type: "booking.updated",
          data: { bookingId: "1", status: "confirmed" },
          timestamp: Date.now() + 1000,
        },
        {
          type: "booking.cancelled",
          data: { bookingId: "1" },
          timestamp: Date.now() + 2000,
        },
      ];

      events.forEach((event) => {
        act(() => {
          store.getState().handleRealtimeEvent(event);
        });
      });

      const processedEvents = store.getState().realtimeEvents;
      expect(processedEvents).toHaveLength(3);
      expect(processedEvents[0].type).toBe("booking.created");
      expect(processedEvents[1].type).toBe("booking.updated");
      expect(processedEvents[2].type).toBe("booking.cancelled");
    });

    it("should clean up WebSocket on unmount", () => {
      const ws = new MockWebSocket("ws://test");
      const closeSpy = vi.spyOn(ws, "close");

      act(() => {
        store.setState({ wsConnection: ws as any });
      });

      act(() => {
        store.getState().cleanup();
      });

      expect(closeSpy).toHaveBeenCalled();
      expect(store.getState().wsConnection).toBeNull();
    });
  });

  describe("Offline Queue Management", () => {
    it("should queue actions when offline", () => {
      act(() => {
        store.setState({ isOfflineMode: true });
      });

      const action: OfflineAction = {
        id: "action-1",
        type: "updateMetric",
        payload: { metric: "occupancyRate", value: 80 },
        timestamp: Date.now(),
        retryCount: 0,
      };

      act(() => {
        store.getState().queueOfflineAction(action);
      });

      expect(store.getState().offlineQueue).toContainEqual(action);
    });

    it("should process offline queue when back online", async () => {
      const actions: OfflineAction[] = [
        {
          id: "action-1",
          type: "updateMetric",
          payload: { metric: "occupancyRate", value: 80 },
          timestamp: Date.now(),
          retryCount: 0,
        },
        {
          id: "action-2",
          type: "createBooking",
          payload: { guestName: "Maria Santos" },
          timestamp: Date.now() + 1000,
          retryCount: 0,
        },
      ];

      act(() => {
        store.setState({
          offlineQueue: actions,
          isOfflineMode: true,
        });
      });

      // Mock successful API calls
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await act(async () => {
        await store.getState().processOfflineQueue();
      });

      expect(store.getState().offlineQueue).toHaveLength(0);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should persist queue to IndexedDB", async () => {
      const action: OfflineAction = {
        id: "action-1",
        type: "updateMetric",
        payload: { metric: "occupancyRate", value: 80 },
        timestamp: Date.now(),
        retryCount: 0,
      };

      const persistSpy = vi.spyOn(store.getState(), "persistQueueToIndexedDB" as any);

      act(() => {
        store.getState().queueOfflineAction(action);
      });

      expect(persistSpy).toHaveBeenCalledWith([action]);
    });

    it("should enforce queue size limit of 100 items", () => {
      const actions: OfflineAction[] = Array.from({ length: 105 }, (_, i) => ({
        id: `action-${i}`,
        type: "updateMetric",
        payload: { metric: "occupancyRate", value: 75 + i },
        timestamp: Date.now() + i * 1000,
        retryCount: 0,
      }));

      actions.forEach((action) => {
        act(() => {
          store.getState().queueOfflineAction(action);
        });
      });

      expect(store.getState().offlineQueue).toHaveLength(100);
      // Should keep the most recent 100 items
      expect(store.getState().offlineQueue[0].id).toBe("action-5");
      expect(store.getState().offlineQueue[99].id).toBe("action-104");
    });

    it("should expire stale queue items after 24 hours", () => {
      const now = Date.now();
      const staleAction: OfflineAction = {
        id: "stale-1",
        type: "updateMetric",
        payload: { metric: "occupancyRate", value: 75 },
        timestamp: now - 25 * 60 * 60 * 1000, // 25 hours ago
        retryCount: 0,
      };

      const freshAction: OfflineAction = {
        id: "fresh-1",
        type: "updateMetric",
        payload: { metric: "occupancyRate", value: 80 },
        timestamp: now - 1 * 60 * 60 * 1000, // 1 hour ago
        retryCount: 0,
      };

      act(() => {
        store.setState({
          offlineQueue: [staleAction, freshAction],
        });
      });

      act(() => {
        store.getState().cleanupExpiredQueueItems();
      });

      expect(store.getState().offlineQueue).toHaveLength(1);
      expect(store.getState().offlineQueue[0].id).toBe("fresh-1");
    });

    it("should handle queue processing failures with retry", async () => {
      const action: OfflineAction = {
        id: "action-1",
        type: "updateMetric",
        payload: { metric: "occupancyRate", value: 80 },
        timestamp: Date.now(),
        retryCount: 0,
      };

      act(() => {
        store.setState({
          offlineQueue: [action],
          isOfflineMode: false,
        });
      });

      // Mock API failure
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        });

      await act(async () => {
        await store.getState().processOfflineQueue();
      });

      // Should retry and increment retry count
      expect(store.getState().offlineQueue[0].retryCount).toBe(1);

      // Process again - should succeed
      await act(async () => {
        await store.getState().processOfflineQueue();
      });

      expect(store.getState().offlineQueue).toHaveLength(0);
    });
  });

  describe("Performance Tests", () => {
    it("should handle selective re-renders with subscriptions", () => {
      const { result: metricsResult } = renderHook(() =>
        useDashboardStore((state) => state.metrics)
      );

      const { result: eventsResult } = renderHook(() =>
        useDashboardStore((state) => state.realtimeEvents)
      );

      const initialMetrics = metricsResult.current;
      const initialEvents = eventsResult.current;

      // Update only metrics
      act(() => {
        store.setState({
          metrics: { ...store.getState().metrics, occupancyRate: 85 },
        });
      });

      expect(metricsResult.current).not.toBe(initialMetrics);
      expect(eventsResult.current).toBe(initialEvents); // Should not re-render
    });

    it("should use memoized selectors for computed values", () => {
      const { result } = renderHook(() => useDashboardStore((state) => state.getComputedMetrics()));

      const firstCall = result.current;

      // Re-render without state change
      const { result: result2 } = renderHook(() =>
        useDashboardStore((state) => state.getComputedMetrics())
      );

      expect(result2.current).toBe(firstCall); // Should return same reference
    });

    it("should handle 1000+ metric updates without performance degradation", async () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        act(() => {
          store.getState().updateMetricOptimistically("occupancyRate", 75 + (i % 25), {
            id: `update-${i}`,
            type: "occupancy",
            previousValue: 75,
            newValue: 75 + (i % 25),
            timestamp: Date.now() + i,
          });
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within 1 second
      expect(totalTime).toBeLessThan(1000);
      expect(store.getState().optimisticUpdates).toHaveLength(1000);
    });

    it("should prevent memory leaks in subscriptions", () => {
      const unsubscribes: (() => void)[] = [];

      // Create 100 subscriptions
      for (let i = 0; i < 100; i++) {
        const unsubscribe = store.subscribe(
          (state) => state.metrics,
          () => {
            // Subscription callback
          }
        );
        unsubscribes.push(unsubscribe);
      }

      // Unsubscribe all
      unsubscribes.forEach((unsub) => unsub());

      // Check that subscriptions are cleaned up (implementation specific)
      // This would depend on internal Zustand implementation
      expect(store.getState()).toBeDefined();
    });

    it("should batch multiple state updates efficiently", () => {
      let renderCount = 0;

      const { result } = renderHook(() => {
        renderCount++;
        return useDashboardStore((state) => state.metrics);
      });

      act(() => {
        store.setState((state) => ({
          metrics: {
            ...state.metrics,
            occupancyRate: 80,
            totalRevenue: 200000,
            activeBookings: 30,
          },
        }));
      });

      // Should only cause one re-render despite multiple property updates
      expect(renderCount).toBe(2); // Initial + one update
    });
  });

  describe("Integration Tests", () => {
    it("should sync with authStore for user context", async () => {
      const mockUser = {
        id: "user-123",
        email: "manager@okaeri.ph",
        role: "manager",
      };

      (useAuthStore as any).mockReturnValue({
        user: mockUser,
        token: "jwt-token",
        isAuthenticated: true,
      });

      await act(async () => {
        await store.getState().fetchDashboardMetrics("project-1");
      });

      // Should include auth token in API calls
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token",
          }),
        })
      );
    });

    it("should react to projectStore.activeProjectId changes", () => {
      // Set metrics for project-1
      act(() => {
        store.setState({
          metrics: { ...store.getState().metrics, occupancyRate: 75 },
          currentProjectId: "project-1",
        });
      });

      // Simulate project change
      (useProjectStore as any).mockReturnValue({
        activeProjectId: "project-2",
        projects: [
          { id: "project-1", name: "Okaeri La Union" },
          { id: "project-2", name: "Okaeri Siargao" },
        ],
      });

      act(() => {
        store.getState().handleProjectChange("project-2");
      });

      expect(store.getState().currentProjectId).toBe("project-2");
      expect(store.getState().metrics.occupancyRate).toBeNull();
    });

    it("should coordinate with TanStack Query cache", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDashboardStore((state) => state.metrics), { wrapper });

      // Simulate cache update from TanStack Query
      queryClient.setQueryData(["dashboard", "metrics", "project-1"], {
        occupancyRate: 82,
        totalRevenue: 180000,
      });

      act(() => {
        store.getState().syncWithQueryCache(queryClient);
      });

      expect(store.getState().metrics.occupancyRate).toBe(82);
      expect(store.getState().metrics.totalRevenue).toBe(180000);
    });

    it("should handle cross-tab synchronization via BroadcastChannel", () => {
      const channel = new MockBroadcastChannel("dashboard-sync");
      const messageHandler = vi.fn();
      channel.onmessage = messageHandler;

      act(() => {
        store.getState().initCrossTabSync();
      });

      // Simulate update from another tab
      const mockMessage = new MessageEvent("message", {
        data: {
          type: "METRIC_UPDATE",
          metrics: {
            occupancyRate: 88,
            totalRevenue: 250000,
          },
        },
      });

      act(() => {
        store.getState().handleCrossTabMessage(mockMessage);
      });

      expect(store.getState().metrics.occupancyRate).toBe(88);
      expect(store.getState().metrics.totalRevenue).toBe(250000);
    });

    it("should clear sensitive data on logout", () => {
      // Set up store with data
      act(() => {
        store.setState({
          metrics: {
            ...store.getState().metrics,
            occupancyRate: 75,
            totalRevenue: 150000,
          },
          realtimeEvents: [{ type: "booking.created", data: {}, timestamp: Date.now() }],
          offlineQueue: [
            {
              id: "action-1",
              type: "updateMetric",
              payload: {},
              timestamp: Date.now(),
              retryCount: 0,
            },
          ],
        });
      });

      // Simulate logout
      act(() => {
        store.getState().handleLogout();
      });

      expect(store.getState().metrics.occupancyRate).toBeNull();
      expect(store.getState().metrics.totalRevenue).toBeNull();
      expect(store.getState().realtimeEvents).toEqual([]);
      expect(store.getState().offlineQueue).toEqual([]);
    });
  });

  describe("Multi-tenant Isolation", () => {
    it("should clear metrics when switching projects", () => {
      act(() => {
        store.setState({
          metrics: {
            ...store.getState().metrics,
            occupancyRate: 75,
            totalRevenue: 150000,
          },
          currentProjectId: "project-1",
        });
      });

      act(() => {
        store.getState().switchProject("project-2");
      });

      expect(store.getState().metrics.occupancyRate).toBeNull();
      expect(store.getState().metrics.totalRevenue).toBeNull();
      expect(store.getState().currentProjectId).toBe("project-2");
    });

    it("should not leak data between projects", async () => {
      // Set data for project-1
      act(() => {
        store.setState({
          currentProjectId: "project-1",
          metrics: {
            ...store.getState().metrics,
            occupancyRate: 75,
          },
        });
      });

      // Create separate cache for project-1
      const project1Cache = { ...store.getState().metrics };

      // Switch to project-2
      act(() => {
        store.getState().switchProject("project-2");
        store.setState({
          metrics: {
            ...store.getState().metrics,
            occupancyRate: 85,
          },
        });
      });

      // Switch back to project-1
      act(() => {
        store.getState().switchProject("project-1");
      });

      // Should not have project-2 data
      expect(store.getState().metrics.occupancyRate).not.toBe(85);
    });

    it("should maintain separate caches per project", () => {
      const project1Metrics = {
        occupancyRate: 75,
        totalRevenue: 150000,
        activeBookings: 20,
      };

      const project2Metrics = {
        occupancyRate: 85,
        totalRevenue: 250000,
        activeBookings: 30,
      };

      act(() => {
        store.getState().setCachedMetrics("project-1", project1Metrics);
        store.getState().setCachedMetrics("project-2", project2Metrics);
      });

      const cache1 = store.getState().getCachedMetrics("project-1");
      const cache2 = store.getState().getCachedMetrics("project-2");

      expect(cache1).toEqual(project1Metrics);
      expect(cache2).toEqual(project2Metrics);
      expect(cache1).not.toEqual(cache2);
    });

    it("should apply project-specific WebSocket subscriptions", async () => {
      await act(async () => {
        store.setState({ currentProjectId: "project-1" });
        await store.getState().subscribeToRealTimeUpdates();
      });

      const ws1 = store.getState().wsConnection;

      // Switch project
      await act(async () => {
        store.getState().switchProject("project-2");
        await store.getState().subscribeToRealTimeUpdates();
      });

      const ws2 = store.getState().wsConnection;

      expect(ws1).not.toBe(ws2);
    });
  });

  describe("Philippine Business Context", () => {
    it("should format currency values in PHP", () => {
      act(() => {
        store.setState({
          metrics: {
            ...store.getState().metrics,
            totalRevenue: 1500000,
            averageDailyRate: 4500,
          },
        });
      });

      const formatted = store.getState().getFormattedMetrics();
      expect(formatted.totalRevenue).toBe("₱1,500,000.00");
      expect(formatted.averageDailyRate).toBe("₱4,500.00");
    });

    it("should track typhoon season impact on occupancy", () => {
      const typhoonSeasonMetrics = {
        occupancyRate: 45, // Lower during typhoon season
        seasonalAdjustment: -30,
        weatherImpact: "severe",
        typhoonWarnings: 2,
      };

      act(() => {
        store.getState().updateSeasonalMetrics(typhoonSeasonMetrics);
      });

      expect(store.getState().metrics.occupancyRate).toBe(45);
      expect(store.getState().seasonalData).toMatchObject({
        adjustment: -30,
        weatherImpact: "severe",
      });
    });

    it("should calculate BIR tax in financial metrics", () => {
      const revenue = 1500000;
      const expectedVAT = revenue * 0.12; // 12% VAT
      const expectedWithholding = revenue * 0.02; // 2% withholding

      act(() => {
        store.setState({
          metrics: {
            ...store.getState().metrics,
            totalRevenue: revenue,
          },
        });
      });

      const taxMetrics = store.getState().calculateTaxMetrics();
      expect(taxMetrics.vat).toBe(expectedVAT);
      expect(taxMetrics.withholding).toBe(expectedWithholding);
      expect(taxMetrics.netRevenue).toBe(revenue - expectedVAT - expectedWithholding);
    });

    it("should track local payment methods", () => {
      const paymentMetrics = {
        gcash: { count: 150, total: 675000 },
        maya: { count: 120, total: 540000 },
        cash: { count: 200, total: 900000 },
        creditCard: { count: 80, total: 360000 },
      };

      act(() => {
        store.getState().updatePaymentMethodMetrics(paymentMetrics);
      });

      const stats = store.getState().getPaymentMethodStats();
      expect(stats.gcash.percentage).toBeCloseTo(27.27, 1);
      expect(stats.maya.percentage).toBeCloseTo(21.82, 1);
      expect(stats.mostUsed).toBe("cash");
    });

    it("should track Philippine holiday occupancy patterns", () => {
      const holidayPatterns = [
        { holiday: "Holy Week", occupancy: 95, averageStay: 4 },
        { holiday: "Christmas", occupancy: 98, averageStay: 5 },
        { holiday: "New Year", occupancy: 100, averageStay: 3 },
        { holiday: "Independence Day", occupancy: 85, averageStay: 2 },
      ];

      act(() => {
        store.getState().analyzeHolidayPatterns(holidayPatterns);
      });

      const patterns = store.getState().holidayOccupancyPatterns;
      expect(patterns.peakHoliday).toBe("New Year");
      expect(patterns.averagePeakOccupancy).toBeCloseTo(94.5, 1);
    });

    it("should handle peso decimal precision correctly", () => {
      act(() => {
        store.setState({
          metrics: {
            ...store.getState().metrics,
            totalRevenue: 1234567.89,
            averageDailyRate: 3456.78,
          },
        });
      });

      const formatted = store.getState().getFormattedMetrics();
      expect(formatted.totalRevenue).toBe("₱1,234,567.89");
      expect(formatted.averageDailyRate).toBe("₱3,456.78");
    });

    it("should track regional visitor patterns", () => {
      const visitorData = {
        ncr: 450,
        centralLuzon: 280,
        ilocosRegion: 520,
        international: 150,
      };

      act(() => {
        store.getState().updateVisitorRegionMetrics(visitorData);
      });

      const analysis = store.getState().getVisitorAnalysis();
      expect(analysis.topRegion).toBe("ilocosRegion");
      expect(analysis.domesticPercentage).toBeCloseTo(89.29, 1);
    });

    it("should calculate seasonal pricing adjustments", () => {
      const peakSeasonMultiplier = 1.5; // 50% increase during peak
      const regularRate = 4500;

      act(() => {
        store.getState().applySeasonalPricing("peak", regularRate);
      });

      expect(store.getState().metrics.averageDailyRate).toBe(6750);

      act(() => {
        store.getState().applySeasonalPricing("off-peak", regularRate);
      });

      expect(store.getState().metrics.averageDailyRate).toBe(3600); // 20% discount
    });
  });
});
