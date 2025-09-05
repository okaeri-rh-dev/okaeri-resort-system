/**
 * Dashboard TanStack Query Hooks Tests
 * Phase 2.1 - RED Phase: Comprehensive test suite for dashboard data fetching hooks
 *
 * @description Tests for TanStack Query hooks that manage server state,
 * caching, background refetching, and optimistic updates for dashboard metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Types and utilities
import type {
  BookingMetrics,
  FinancialMetrics,
  DashboardActivity,
  MetricPeriod,
} from "../../types";
import { DashboardMockGenerator } from "@tests/utils/dashboard-mocks";
import { createPHPCurrency } from "@tests/utils/metric-helpers";

// Hooks under test (do not exist yet - RED phase)
import {
  useDashboardMetrics,
  useOccupancyTrends,
  useRevenueSummary,
  useUpcomingBookings,
  useActivityFeed,
  useQuickCheckIn,
  useQuickExpenseEntry,
  useDashboardRefresh,
  useMetricSubscription,
  queryKeys,
} from "../../hooks/useDashboardQueries";

describe("Dashboard TanStack Query Hooks", () => {
  let queryClient: QueryClient;
  let mockGenerator: DashboardMockGenerator;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  beforeEach(() => {
    // Create fresh query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false, // Disable retries for tests
          gcTime: 0, // No garbage collection in tests
        },
        mutations: {
          retry: false,
        },
      },
    });

    mockGenerator = new DashboardMockGenerator();

    // Create wrapper with providers
    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("useDashboardMetrics Hook", () => {
    it("should fetch dashboard metrics with proper cache configuration", async () => {
      const projectId = "proj_123";
      const mockMetrics = mockGenerator.withOccupancy(75).withRevenue(48500).build();

      // Mock API response
      const fetchSpy = vi.fn().mockResolvedValue(mockMetrics);
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      const { result } = renderHook(() => useDashboardMetrics(projectId), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      // Wait for data
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockMetrics);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/api/dashboard/metrics?projectId=${projectId}`)
      );
    });

    it("should use 1-minute stale time for real-time data", async () => {
      const projectId = "proj_123";

      const { result } = renderHook(() => useDashboardMetrics(projectId), { wrapper });

      const queryState = queryClient.getQueryState(queryKeys.dashboard.stats(projectId));

      // Check stale time configuration
      expect(queryState?.dataUpdatedAt).toBeDefined();

      // Fast-forward 30 seconds - should still be fresh
      vi.advanceTimersByTime(30 * 1000);
      expect(queryClient.getQueryState(queryKeys.dashboard.stats(projectId))?.isInvalidated).toBe(
        false
      );

      // Fast-forward to 61 seconds - should be stale
      vi.advanceTimersByTime(31 * 1000);
      expect(queryClient.getQueryState(queryKeys.dashboard.stats(projectId))?.isInvalidated).toBe(
        true
      );
    });

    it("should refetch on window focus", async () => {
      const projectId = "proj_123";
      const fetchSpy = vi.fn().mockResolvedValue(mockGenerator.build());

      const { result } = renderHook(() => useDashboardMetrics(projectId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Simulate window focus
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });

    it("should not fetch when projectId is null", () => {
      const fetchSpy = vi.fn();
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      const { result } = renderHook(() => useDashboardMetrics(null), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("useOccupancyTrends Hook", () => {
    it("should fetch occupancy trends with period parameter", async () => {
      const projectId = "proj_123";
      const period: MetricPeriod = "weekly";
      const mockTrends = {
        data: [
          { date: "2024-03-01", occupancy: 72 },
          { date: "2024-03-02", occupancy: 78 },
          { date: "2024-03-03", occupancy: 85 },
        ],
        average: 78.3,
        trend: "up" as const,
      };

      const fetchSpy = vi.fn().mockResolvedValue(mockTrends);
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      const { result } = renderHook(() => useOccupancyTrends(projectId, period), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockTrends);
      expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining(`period=${period}`));
    });

    it("should use longer stale time (5 minutes) for trend data", () => {
      const projectId = "proj_123";

      renderHook(() => useOccupancyTrends(projectId, "weekly"), { wrapper });

      const queryState = queryClient.getQueryState(
        queryKeys.dashboard.occupancy(projectId, "weekly")
      );

      // Verify 5-minute stale time
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(queryState?.isInvalidated).toBe(false);

      vi.advanceTimersByTime(61 * 1000); // 5 minutes 1 second
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe("useRevenueSummary Hook", () => {
    it("should fetch revenue summary with Philippine peso formatting", async () => {
      const projectId = "proj_123";
      const mockRevenue = {
        today: createPHPCurrency(48500),
        week: createPHPCurrency(285000),
        month: createPHPCurrency(1250000),
        year: createPHPCurrency(15000000),
        comparisons: {
          todayVsYesterday: 15.5,
          weekVsLastWeek: 8.2,
          monthVsLastMonth: -3.1,
        },
        paymentBreakdown: {
          cash: createPHPCurrency(450000),
          gcash: createPHPCurrency(380000),
          maya: createPHPCurrency(220000),
          bank_transfer: createPHPCurrency(150000),
          credit_card: createPHPCurrency(50000),
        },
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockRevenue,
      } as Response);

      const { result } = renderHook(() => useRevenueSummary(projectId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockRevenue);
      expect(result.current.data?.today.formatted).toBe("₱48,500.00");
      expect(result.current.data?.paymentBreakdown.gcash.formatted).toBe("₱380,000.00");
    });

    it("should use 15-minute stale time for financial data", () => {
      const projectId = "proj_123";

      renderHook(() => useRevenueSummary(projectId), { wrapper });

      const queryState = queryClient.getQueryState(queryKeys.dashboard.revenue(projectId));

      // Verify 15-minute stale time
      vi.advanceTimersByTime(14 * 60 * 1000); // 14 minutes
      expect(queryState?.isInvalidated).toBe(false);

      vi.advanceTimersByTime(61 * 1000); // 15 minutes 1 second
      expect(queryState?.isInvalidated).toBe(true);
    });
  });

  describe("useUpcomingBookings Hook", () => {
    it("should fetch upcoming bookings with guest details", async () => {
      const projectId = "proj_123";
      const mockBookings = [
        {
          id: "BK-2024-001",
          guestName: "Juan Dela Cruz",
          roomNumber: "203",
          checkInDate: new Date("2024-03-15"),
          checkOutDate: new Date("2024-03-18"),
          paymentStatus: "paid",
          amount: createPHPCurrency(8500),
        },
        {
          id: "BK-2024-002",
          guestName: "Maria Santos",
          roomNumber: "105",
          checkInDate: new Date("2024-03-16"),
          checkOutDate: new Date("2024-03-19"),
          paymentStatus: "partial",
          amount: createPHPCurrency(9500),
        },
      ];

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ bookings: mockBookings }),
      } as Response);

      const { result } = renderHook(() => useUpcomingBookings(projectId), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.bookings).toHaveLength(2);
      expect(result.current.data?.bookings[0].guestName).toBe("Juan Dela Cruz");
    });

    it("should refetch on window focus for fresh booking data", async () => {
      const projectId = "proj_123";
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ bookings: [] }),
      });
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      renderHook(() => useUpcomingBookings(projectId), { wrapper });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      // Simulate window focus
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("useActivityFeed Hook", () => {
    it("should fetch activity feed with pagination", async () => {
      const projectId = "proj_123";
      const mockActivities = mockGenerator
        .createActivityFeed()
        .withBookingActivities(10)
        .withFinancialActivities(5)
        .build();

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockActivities,
      } as Response);

      const { result } = renderHook(() => useActivityFeed(projectId, { limit: 15, offset: 0 }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.activities).toHaveLength(15);
      expect(result.current.data?.hasMore).toBeDefined();
    });

    it("should implement infinite query for activity feed", async () => {
      const projectId = "proj_123";

      const { result } = renderHook(() => useActivityFeed(projectId, { limit: 10 }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Fetch next page
      act(() => {
        result.current.fetchNextPage();
      });

      await waitFor(() => {
        expect(result.current.isFetchingNextPage).toBe(false);
      });

      expect(result.current.hasNextPage).toBeDefined();
    });
  });

  describe("useQuickCheckIn Mutation", () => {
    it("should optimistically update occupancy on check-in", async () => {
      const projectId = "proj_123";
      const booking = {
        id: "BK-2024-001",
        guestName: "Juan Dela Cruz",
        roomNumber: "203",
      };

      const mutateSpy = vi.fn().mockResolvedValue({ success: true });
      vi.mocked(global.fetch).mockImplementation(mutateSpy);

      const { result } = renderHook(() => useQuickCheckIn(projectId), { wrapper });

      // Set initial occupancy data
      queryClient.setQueryData(queryKeys.dashboard.stats(projectId), {
        booking: { occupancy: { current: 75 } },
      });

      // Perform check-in
      act(() => {
        result.current.mutate(booking);
      });

      // Check optimistic update
      const updatedData = queryClient.getQueryData(queryKeys.dashboard.stats(projectId)) as any;
      expect(updatedData.booking.occupancy.current).toBeGreaterThan(75);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mutateSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/bookings/quick-checkin"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(booking),
        })
      );
    });

    it("should rollback on check-in failure", async () => {
      const projectId = "proj_123";
      const booking = {
        id: "BK-2024-001",
        guestName: "Juan Dela Cruz",
        roomNumber: "203",
      };

      vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useQuickCheckIn(projectId), { wrapper });

      const initialOccupancy = 75;
      queryClient.setQueryData(queryKeys.dashboard.stats(projectId), {
        booking: { occupancy: { current: initialOccupancy } },
      });

      // Perform check-in
      act(() => {
        result.current.mutate(booking);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      // Check rollback
      const data = queryClient.getQueryData(queryKeys.dashboard.stats(projectId)) as any;
      expect(data.booking.occupancy.current).toBe(initialOccupancy);
    });

    it("should invalidate related queries on success", async () => {
      const projectId = "proj_123";
      const booking = {
        id: "BK-2024-001",
        guestName: "Juan Dela Cruz",
        roomNumber: "203",
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useQuickCheckIn(projectId), { wrapper });

      act(() => {
        result.current.mutate(booking);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Should invalidate dashboard and booking queries
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.dashboard.all(projectId),
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.bookings.all(projectId),
      });
    });
  });

  describe("useQuickExpenseEntry Mutation", () => {
    it("should update financial metrics optimistically", async () => {
      const projectId = "proj_123";
      const expense = {
        amount: 5500,
        category: "utilities",
        description: "Electricity bill",
        receiptNumber: "RCP-2024-001",
      };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, id: "exp_123" }),
      } as Response);

      const { result } = renderHook(() => useQuickExpenseEntry(projectId), { wrapper });

      // Set initial financial data
      queryClient.setQueryData(queryKeys.dashboard.stats(projectId), {
        financial: {
          expenses: {
            monthly: createPHPCurrency(100000),
          },
        },
      });

      // Log expense
      act(() => {
        result.current.mutate(expense);
      });

      // Check optimistic update
      const updatedData = queryClient.getQueryData(queryKeys.dashboard.stats(projectId)) as any;
      expect(updatedData.financial.expenses.monthly.amount).toBeGreaterThan(100000);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it("should handle Philippine VAT calculation", async () => {
      const projectId = "proj_123";
      const expense = {
        amount: 5500,
        category: "supplies",
        description: "Office supplies",
        includesVAT: true,
      };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          vatAmount: (5500 * 0.12) / 1.12, // VAT calculation
        }),
      });
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      const { result } = renderHook(() => useQuickExpenseEntry(projectId), { wrapper });

      act(() => {
        result.current.mutate(expense);
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.vatAmount).toBeCloseTo(589.29, 2);
    });
  });

  describe("useDashboardRefresh Hook", () => {
    it("should refresh all dashboard queries", async () => {
      const projectId = "proj_123";
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useDashboardRefresh(projectId), { wrapper });

      act(() => {
        result.current.refresh();
      });

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.dashboard.all(projectId),
      });
    });

    it("should handle pull-to-refresh pattern", async () => {
      const projectId = "proj_123";
      const refetchSpy = vi.spyOn(queryClient, "refetchQueries");

      const { result } = renderHook(() => useDashboardRefresh(projectId), { wrapper });

      await act(async () => {
        await result.current.pullToRefresh();
      });

      expect(refetchSpy).toHaveBeenCalledWith({
        queryKey: queryKeys.dashboard.all(projectId),
        type: "active",
      });
    });
  });

  describe("useMetricSubscription Hook", () => {
    it("should subscribe to real-time metric updates", () => {
      const projectId = "proj_123";
      const onUpdate = vi.fn();

      const { result } = renderHook(() => useMetricSubscription(projectId, "occupancy", onUpdate), {
        wrapper,
      });

      // Simulate WebSocket message
      act(() => {
        const event = new MessageEvent("message", {
          data: JSON.stringify({
            type: "metric_update",
            metric: "occupancy",
            value: 82.5,
          }),
        });
        result.current.ws?.dispatchEvent(event);
      });

      expect(onUpdate).toHaveBeenCalledWith({
        metric: "occupancy",
        value: 82.5,
      });
    });

    it("should clean up WebSocket on unmount", () => {
      const projectId = "proj_123";
      const closeSpy = vi.fn();

      const { result, unmount } = renderHook(() => useMetricSubscription(projectId, "revenue"), {
        wrapper,
      });

      // Mock WebSocket close method
      if (result.current.ws) {
        result.current.ws.close = closeSpy;
      }

      unmount();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe("Query Key Management", () => {
    it("should generate project-scoped query keys", () => {
      const projectId = "proj_123";

      expect(queryKeys.dashboard.all(projectId)).toEqual(["dashboard", projectId]);
      expect(queryKeys.dashboard.stats(projectId)).toEqual(["dashboard", projectId, "stats"]);
      expect(queryKeys.dashboard.occupancy(projectId, "weekly")).toEqual([
        "dashboard",
        projectId,
        "occupancy",
        "weekly",
      ]);
      expect(queryKeys.dashboard.revenue(projectId)).toEqual(["dashboard", projectId, "revenue"]);
    });

    it("should support query invalidation cascading", () => {
      const projectId = "proj_123";

      // Set some query data
      queryClient.setQueryData(queryKeys.dashboard.stats(projectId), { test: "stats" });
      queryClient.setQueryData(queryKeys.dashboard.revenue(projectId), { test: "revenue" });
      queryClient.setQueryData(queryKeys.dashboard.occupancy(projectId, "daily"), {
        test: "occupancy",
      });

      // Invalidate all dashboard queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.dashboard.all(projectId),
      });

      // All should be invalidated
      expect(queryClient.getQueryState(queryKeys.dashboard.stats(projectId))?.isInvalidated).toBe(
        true
      );
      expect(queryClient.getQueryState(queryKeys.dashboard.revenue(projectId))?.isInvalidated).toBe(
        true
      );
      expect(
        queryClient.getQueryState(queryKeys.dashboard.occupancy(projectId, "daily"))?.isInvalidated
      ).toBe(true);
    });
  });

  describe("Background Refetching", () => {
    it("should refetch dashboard every 60 seconds when visible", async () => {
      const projectId = "proj_123";
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGenerator.build(),
      });
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      renderHook(() => useDashboardMetrics(projectId), { wrapper });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 60 seconds
      vi.advanceTimersByTime(60 * 1000);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });

    it("should pause refetching when tab is hidden", async () => {
      const projectId = "proj_123";
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockGenerator.build(),
      });
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      renderHook(() => useDashboardMetrics(projectId), { wrapper });

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      // Hide tab
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Fast-forward 60 seconds while hidden
      vi.advanceTimersByTime(60 * 1000);

      // Should not refetch while hidden
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Show tab again
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));

      // Should refetch on becoming visible
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Error Handling", () => {
    it("should retry failed queries with exponential backoff", async () => {
      const projectId = "proj_123";
      let attemptCount = 0;

      const fetchSpy = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: async () => mockGenerator.build(),
        });
      });
      vi.mocked(global.fetch).mockImplementation(fetchSpy);

      // Override retry for this test
      const customQueryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
        },
      });

      const customWrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={customQueryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDashboardMetrics(projectId), {
        wrapper: customWrapper,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(fetchSpy).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it("should handle network offline gracefully", () => {
      const projectId = "proj_123";

      // Simulate offline
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() => useDashboardMetrics(projectId), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toContain("offline");
    });
  });
});
