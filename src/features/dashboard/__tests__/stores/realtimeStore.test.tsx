import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";

// Use existing test utilities
import { DashboardTestProvider } from "../../../../../tests/utils/dashboard-providers";
import { DashboardMockDataGenerator } from "../../../../../tests/utils/dashboard-mocks";
import { WebSocketSimulator } from "../../../../../tests/utils/websocket-mocks";

// Import the implemented stores and types
import { useRealtimeStore } from "../../stores/realtimeStore";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useOptimisticStore } from "../../stores/optimisticStore";
import type { RealtimeState, DashboardState } from "../../types/dashboard";

describe("Realtime Store - Zustand + TanStack Query Integration", () => {
  let queryClient: QueryClient;
  let wsSimulator: WebSocketSimulator;
  let mockGenerator: DashboardMockDataGenerator;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    wsSimulator = new WebSocketSimulator();
    mockGenerator = new DashboardMockDataGenerator();

    // Reset all stores
    useRealtimeStore.getState().reset();
    useDashboardStore.getState().reset();
    useOptimisticStore.getState().reset();
  });

  afterEach(() => {
    wsSimulator.cleanup();
    vi.clearAllMocks();
  });

  describe("Store Synchronization with WebSocket (10 tests)", () => {
    it("should sync WebSocket connection state with store", () => {
      const { result } = renderHook(() => useRealtimeStore());

      expect(result.current.ws.status).toBe("disconnected");

      act(() => {
        result.current.connect("ws://localhost:8080");
      });

      expect(result.current.ws.status).toBe("connecting");

      act(() => {
        wsSimulator.simulateConnection();
      });

      expect(result.current.ws.status).toBe("connected");
      expect(result.current.ws.connection).toBeDefined();
    });

    it("should handle WebSocket reconnection with exponential backoff", async () => {
      const { result } = renderHook(() => useRealtimeStore());

      const reconnectAttempts: number[] = [];
      const unsubscribe = useRealtimeStore.subscribe(
        (state) => state.ws.reconnectAttempts,
        (attempts) => reconnectAttempts.push(attempts)
      );

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      // Simulate disconnection
      act(() => {
        wsSimulator.disconnect();
      });

      // Should attempt reconnection with backoff
      await waitFor(() => {
        expect(reconnectAttempts.length).toBeGreaterThan(0);
      });

      // Verify exponential backoff pattern
      expect(result.current.ws.reconnectDelay).toBeGreaterThan(1000);

      unsubscribe();
    });

    it("should update TanStack Query cache on WebSocket messages", async () => {
      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      // Set initial query data
      queryClient.setQueryData(["metrics"], { occupancyRate: 75 });

      // Simulate WebSocket message
      act(() => {
        wsSimulator.simulateMetricUpdate({ occupancyRate: 85 });
      });

      await waitFor(() => {
        const cachedData = queryClient.getQueryData(["metrics"]);
        expect(cachedData).toMatchObject({ occupancyRate: 85 });
      });
    });

    it("should coordinate optimistic updates across stores", () => {
      const { result: realtimeResult } = renderHook(() => useRealtimeStore());
      const { result: optimisticResult } = renderHook(() => useOptimisticStore());

      act(() => {
        realtimeResult.current.applyOptimisticUpdate({
          id: "update-1",
          changes: { checkInsToday: 5 },
        });
      });

      // Should be reflected in optimistic store
      expect(optimisticResult.current.pendingUpdates).toHaveLength(1);
      expect(optimisticResult.current.pendingUpdates[0].id).toBe("update-1");
    });

    it("should batch WebSocket messages for efficient updates", async () => {
      const { result } = renderHook(() => useRealtimeStore());
      const updateSpy = vi.fn();

      const unsubscribe = useRealtimeStore.subscribe((state) => state.lastUpdate, updateSpy);

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      // Send multiple messages rapidly
      for (let i = 0; i < 10; i++) {
        wsSimulator.simulateMetricUpdate({ checkInsToday: i });
      }

      await waitFor(() => {
        // Should batch updates, not call 10 times
        expect(updateSpy.mock.calls.length).toBeLessThan(5);
      });

      unsubscribe();
    });

    it("should handle WebSocket subscription management", () => {
      const { result } = renderHook(() => useRealtimeStore());

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      // Subscribe to different message types
      const unsub1 = result.current.subscribe("booking", handler1);
      const unsub2 = result.current.subscribe("metric", handler2);

      act(() => {
        wsSimulator.send({ type: "booking", data: {} });
        wsSimulator.send({ type: "metric", data: {} });
      });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      unsub1();
      unsub2();
    });

    it("should implement message deduplication", () => {
      const { result } = renderHook(() => useRealtimeStore());
      const handler = vi.fn();

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      result.current.subscribe("metric", handler);

      // Send duplicate messages
      const message = {
        type: "metric",
        data: { occupancyRate: 85 },
        messageId: "msg-123",
      };

      act(() => {
        wsSimulator.send(message);
        wsSimulator.send(message);
        wsSimulator.send(message);
      });

      // Should only process once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should track connection metrics", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      // Send some messages
      for (let i = 0; i < 5; i++) {
        wsSimulator.simulateMetricUpdate({ value: i });
      }

      const metrics = result.current.getConnectionMetrics();

      expect(metrics).toMatchObject({
        messagesSent: expect.any(Number),
        messagesReceived: 5,
        connectedAt: expect.any(Date),
        latency: expect.any(Number),
      });
    });

    it("should handle connection state transitions", () => {
      const { result } = renderHook(() => useRealtimeStore());
      const stateHistory: string[] = [];

      const unsubscribe = useRealtimeStore.subscribe(
        (state) => state.ws.status,
        (status) => stateHistory.push(status)
      );

      act(() => {
        result.current.connect("ws://localhost:8080");
      });

      act(() => {
        wsSimulator.simulateConnection();
      });

      act(() => {
        wsSimulator.disconnect();
      });

      expect(stateHistory).toEqual(["connecting", "connected", "disconnected"]);

      unsubscribe();
    });

    it("should clean up resources on disconnect", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      // Add subscriptions
      const unsub1 = result.current.subscribe("booking", vi.fn());
      const unsub2 = result.current.subscribe("metric", vi.fn());

      expect(result.current.getActiveSubscriptions()).toHaveLength(2);

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.ws.status).toBe("disconnected");
      expect(result.current.ws.connection).toBeNull();
      expect(result.current.getActiveSubscriptions()).toHaveLength(0);
    });
  });

  describe("TanStack Query Integration (10 tests)", () => {
    it("should invalidate queries on WebSocket updates", async () => {
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      act(() => {
        wsSimulator.simulateMetricUpdate({ occupancyRate: 90 });
      });

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({
          queryKey: ["metrics"],
        });
      });
    });

    it("should optimize query stale time based on connection status", () => {
      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      // When connected, use infinite stale time (rely on WebSocket)
      act(() => {
        result.current.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
      });

      const connectedOptions = result.current.getQueryOptions(["metrics"]);
      expect(connectedOptions.staleTime).toBe(Infinity);

      // When disconnected, use shorter stale time
      act(() => {
        wsSimulator.disconnect();
      });

      const disconnectedOptions = result.current.getQueryOptions(["metrics"]);
      expect(disconnectedOptions.staleTime).toBe(5 * 60 * 1000); // 5 minutes
    });

    it("should coordinate mutations with optimistic updates", async () => {
      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      const mutation = result.current.createOptimisticMutation({
        mutationKey: ["updateBooking"],
        mutationFn: async (data) => {
          // Simulate API call
          return new Promise((resolve) => setTimeout(() => resolve(data), 100));
        },
      });

      act(() => {
        mutation.mutate({ bookingId: "123", status: "confirmed" });
      });

      // Should apply optimistic update immediately
      expect(useOptimisticStore.getState().pendingUpdates).toHaveLength(1);

      await waitFor(() => {
        expect(mutation.isSuccess).toBe(true);
      });

      // Should clear optimistic update after success
      expect(useOptimisticStore.getState().pendingUpdates).toHaveLength(0);
    });

    it("should handle query error recovery", async () => {
      let attempts = 0;
      const fetchFn = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ data: "success" });
      });

      const { result } = renderHook(
        () =>
          useRealtimeStore().createQuery({
            queryKey: ["test"],
            queryFn: fetchFn,
            retry: 3,
          }),
        {
          wrapper: ({ children }) => (
            <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("should implement smart caching strategies", () => {
      const { result } = renderHook(() => useRealtimeStore());

      // Different cache times for different data types
      const bookingOptions = result.current.getQueryOptions(["bookings"]);
      const metricsOptions = result.current.getQueryOptions(["metrics"]);
      const financialOptions = result.current.getQueryOptions(["financial"]);

      expect(bookingOptions.gcTime).toBe(5 * 60 * 1000); // 5 min
      expect(metricsOptions.gcTime).toBe(10 * 60 * 1000); // 10 min
      expect(financialOptions.gcTime).toBe(30 * 60 * 1000); // 30 min
    });

    it("should handle prefetching for predictive loading", async () => {
      const prefetchSpy = vi.spyOn(queryClient, "prefetchQuery");

      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      // Prefetch next likely data
      await act(async () => {
        await result.current.prefetchRelated(["bookings", "current"]);
      });

      expect(prefetchSpy).toHaveBeenCalledWith({
        queryKey: ["bookings", "upcoming"],
        queryFn: expect.any(Function),
      });
    });

    it("should sync query state with Zustand stores", () => {
      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      // Set query data
      queryClient.setQueryData(["metrics"], {
        occupancyRate: 85,
        checkInsToday: 10,
      });

      // Should sync to dashboard store
      act(() => {
        result.current.syncQueryToStore(["metrics"]);
      });

      const dashboardState = useDashboardStore.getState();
      expect(dashboardState.metrics).toMatchObject({
        occupancyRate: 85,
        checkInsToday: 10,
      });
    });

    it("should implement query cancellation", async () => {
      const abortSpy = vi.fn();
      const fetchFn = vi.fn().mockImplementation(({ signal }) => {
        signal.addEventListener("abort", abortSpy);
        return new Promise(() => {}); // Never resolves
      });

      const { result, unmount } = renderHook(
        () =>
          useRealtimeStore().createQuery({
            queryKey: ["cancelable"],
            queryFn: fetchFn,
          }),
        {
          wrapper: ({ children }) => (
            <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
          ),
        }
      );

      // Unmount should cancel query
      unmount();

      await waitFor(() => {
        expect(abortSpy).toHaveBeenCalled();
      });
    });

    it("should handle parallel queries efficiently", async () => {
      const fetchMetrics = vi.fn().mockResolvedValue({ occupancy: 85 });
      const fetchBookings = vi.fn().mockResolvedValue({ count: 10 });
      const fetchFinancials = vi.fn().mockResolvedValue({ revenue: 50000 });

      const { result } = renderHook(
        () => {
          const metrics = useRealtimeStore().createQuery({
            queryKey: ["metrics"],
            queryFn: fetchMetrics,
          });
          const bookings = useRealtimeStore().createQuery({
            queryKey: ["bookings"],
            queryFn: fetchBookings,
          });
          const financials = useRealtimeStore().createQuery({
            queryKey: ["financials"],
            queryFn: fetchFinancials,
          });

          return { metrics, bookings, financials };
        },
        {
          wrapper: ({ children }) => (
            <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
          ),
        }
      );

      await waitFor(() => {
        expect(result.current.metrics.isSuccess).toBe(true);
        expect(result.current.bookings.isSuccess).toBe(true);
        expect(result.current.financials.isSuccess).toBe(true);
      });

      // All should be called in parallel
      expect(fetchMetrics).toHaveBeenCalledTimes(1);
      expect(fetchBookings).toHaveBeenCalledTimes(1);
      expect(fetchFinancials).toHaveBeenCalledTimes(1);
    });

    it("should implement query persistence", () => {
      const { result } = renderHook(() => useRealtimeStore(), {
        wrapper: ({ children }) => (
          <DashboardTestProvider queryClient={queryClient}>{children}</DashboardTestProvider>
        ),
      });

      // Set query data
      queryClient.setQueryData(["metrics"], {
        occupancyRate: 85,
        timestamp: Date.now(),
      });

      // Persist to storage
      act(() => {
        result.current.persistQueries();
      });

      // Simulate page reload
      queryClient.clear();

      // Restore from storage
      act(() => {
        result.current.restoreQueries();
      });

      const restored = queryClient.getQueryData(["metrics"]);
      expect(restored).toMatchObject({ occupancyRate: 85 });
    });
  });

  describe("Multi-Store Coordination (8 tests)", () => {
    it("should coordinate state updates across all stores", () => {
      const { result: realtimeResult } = renderHook(() => useRealtimeStore());
      const { result: dashboardResult } = renderHook(() => useDashboardStore());
      const { result: optimisticResult } = renderHook(() => useOptimisticStore());

      act(() => {
        realtimeResult.current.broadcastUpdate({
          type: "METRICS_UPDATE",
          payload: { occupancyRate: 90 },
        });
      });

      // Should update all relevant stores
      expect(dashboardResult.current.metrics.occupancyRate).toBe(90);
      expect(optimisticResult.current.hasUpdates).toBe(false); // No optimistic updates
    });

    it("should handle store middleware composition", () => {
      const loggingMiddleware = vi.fn();
      const persistMiddleware = vi.fn();

      const { result } = renderHook(() =>
        useRealtimeStore.withMiddleware([loggingMiddleware, persistMiddleware])
      );

      act(() => {
        result.current.updateMetrics({ occupancyRate: 85 });
      });

      expect(loggingMiddleware).toHaveBeenCalled();
      expect(persistMiddleware).toHaveBeenCalled();
    });

    it("should implement computed values across stores", () => {
      const { result } = renderHook(() => {
        const realtime = useRealtimeStore();
        const dashboard = useDashboardStore();

        // Computed value combining both stores
        const isHealthy = () => {
          const connected = realtime.ws.status === "connected";
          const highOccupancy = dashboard.metrics.occupancyRate > 70;
          return connected && highOccupancy;
        };

        return { realtime, dashboard, isHealthy };
      });

      act(() => {
        result.current.realtime.connect("ws://localhost:8080");
        wsSimulator.simulateConnection();
        result.current.dashboard.updateMetrics({ occupancyRate: 85 });
      });

      expect(result.current.isHealthy()).toBe(true);
    });

    it("should handle store reset cascade", () => {
      const { result: realtimeResult } = renderHook(() => useRealtimeStore());
      const { result: dashboardResult } = renderHook(() => useDashboardStore());
      const { result: optimisticResult } = renderHook(() => useOptimisticStore());

      // Set some state in all stores
      act(() => {
        realtimeResult.current.connect("ws://localhost:8080");
        dashboardResult.current.updateMetrics({ occupancyRate: 85 });
        optimisticResult.current.addUpdate({ id: "1", changes: {} });
      });

      // Global reset
      act(() => {
        realtimeResult.current.resetAll();
      });

      expect(realtimeResult.current.ws.status).toBe("disconnected");
      expect(dashboardResult.current.metrics.occupancyRate).toBe(0);
      expect(optimisticResult.current.pendingUpdates).toHaveLength(0);
    });

    it("should implement store snapshots for time travel", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.createSnapshot("before");
        result.current.updateMetrics({ occupancyRate: 85 });
        result.current.createSnapshot("after");
        result.current.updateMetrics({ occupancyRate: 90 });
      });

      expect(result.current.metrics.occupancyRate).toBe(90);

      act(() => {
        result.current.restoreSnapshot("before");
      });

      expect(result.current.metrics.occupancyRate).toBe(0);

      act(() => {
        result.current.restoreSnapshot("after");
      });

      expect(result.current.metrics.occupancyRate).toBe(85);
    });

    it("should handle store subscriptions with selectors", () => {
      const occupancyUpdates: number[] = [];

      const unsubscribe = useRealtimeStore.subscribe(
        (state) => state.metrics?.occupancyRate ?? 0,
        (occupancy) => occupancyUpdates.push(occupancy)
      );

      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.updateMetrics({ occupancyRate: 75 });
        result.current.updateMetrics({ occupancyRate: 80 });
        result.current.updateMetrics({ checkInsToday: 5 }); // Shouldn't trigger
        result.current.updateMetrics({ occupancyRate: 85 });
      });

      expect(occupancyUpdates).toEqual([75, 80, 85]);

      unsubscribe();
    });

    it("should implement transaction-like updates", async () => {
      const { result } = renderHook(() => useRealtimeStore());

      const transactionResult = await result.current.transaction(async (tx) => {
        tx.updateMetrics({ occupancyRate: 85 });
        tx.addBooking({ id: "123", guest: "John" });

        // Simulate validation failure
        if (tx.getState().metrics.occupancyRate > 80) {
          throw new Error("Occupancy too high");
        }

        return tx.commit();
      });

      // Transaction should rollback on error
      expect(transactionResult.success).toBe(false);
      expect(result.current.metrics.occupancyRate).toBe(0); // Rolled back
    });

    it("should handle store hydration from server state", async () => {
      const serverState = {
        metrics: { occupancyRate: 85, checkInsToday: 10 },
        bookings: [{ id: "1", guest: "Alice" }],
        connection: { status: "connected" },
      };

      const { result } = renderHook(() => useRealtimeStore());

      await act(async () => {
        await result.current.hydrate(serverState);
      });

      expect(result.current.metrics.occupancyRate).toBe(85);
      expect(result.current.bookings).toHaveLength(1);
      expect(result.current.ws.status).toBe("connected");
    });
  });

  describe("Philippine Resort Context (7 tests)", () => {
    it("should handle PHP currency in financial state", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.updateFinancials({
          dailyRevenue: 125000, // PHP
          pendingPayments: 45000,
          expenses: 32500,
        });
      });

      const formatted = result.current.getFormattedFinancials();

      expect(formatted.dailyRevenue).toBe("₱125,000.00");
      expect(formatted.pendingPayments).toBe("₱45,000.00");
      expect(formatted.expenses).toBe("₱32,500.00");
      expect(formatted.netRevenue).toBe("₱92,500.00");
    });

    it("should track Philippine payment methods", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.recordPayment({
          amount: 8500,
          method: "gcash",
          reference: "GC-2024-001",
          guest: "Juan Dela Cruz",
        });
      });

      const payments = result.current.getPaymentsByMethod();

      expect(payments.gcash.total).toBe(8500);
      expect(payments.gcash.count).toBe(1);
      expect(payments.gcash.percentage).toBeGreaterThan(0);
    });

    it("should handle La Union timezone for scheduling", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.scheduleCheckIn({
          guest: "Maria Santos",
          scheduledTime: "14:00", // 2:00 PM PHT
          room: "203",
        });
      });

      const schedule = result.current.getTodaySchedule();

      expect(schedule[0].localTime).toBe("2:00 PM");
      expect(schedule[0].timezone).toBe("Asia/Manila");
    });

    it("should implement typhoon mode state management", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.enableTyphoonMode({
          signalLevel: 3,
          expectedLandfall: new Date("2024-07-15T14:00:00+08:00"),
        });
      });

      expect(result.current.typhoonMode.active).toBe(true);
      expect(result.current.typhoonMode.signalLevel).toBe(3);

      // Should adjust connection parameters
      expect(result.current.ws.reconnectDelay).toBeGreaterThan(5000);
      expect(result.current.polling.interval).toBeGreaterThan(30000);
    });

    it("should track BIR compliance data", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.recordTransaction({
          type: "accommodation",
          amount: 5500,
          vatAmount: 660, // 12% VAT
          officialReceipt: "OR-2024-00123",
        });
      });

      const birReport = result.current.generateBIRReport("2551Q");

      expect(birReport.grossSales).toBe(5500);
      expect(birReport.vatCollected).toBe(660);
      expect(birReport.netSales).toBe(4840);
    });

    it("should handle peak season state adjustments", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.setPeakSeason({
          active: true,
          multiplier: 1.5, // 50% price increase
          reason: "Holy Week",
        });
      });

      const pricing = result.current.calculateRoomPrice("standard", 2);

      expect(pricing.basePrice).toBe(3500);
      expect(pricing.peakAdjustment).toBe(1750); // 50% increase
      expect(pricing.totalPrice).toBe(5250);
    });

    it("should manage local government compliance", () => {
      const { result } = renderHook(() => useRealtimeStore());

      act(() => {
        result.current.updateCompliance({
          businessPermit: {
            status: "valid",
            expiryDate: new Date("2024-12-31"),
            permitNumber: "BP-2024-0456",
          },
          touristAccreditation: {
            status: "valid",
            dotNumber: "DOT-NCR-2024-789",
          },
          fireSafety: {
            status: "due_soon",
            dueDate: new Date("2024-04-15"),
          },
        });
      });

      const alerts = result.current.getComplianceAlerts();

      expect(alerts).toContainEqual(
        expect.objectContaining({
          type: "warning",
          message: expect.stringContaining("Fire Safety"),
        })
      );
    });
  });
});
