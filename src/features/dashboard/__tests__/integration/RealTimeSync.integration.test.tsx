import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient } from "@tanstack/react-query";

// Use existing test utilities from Phase 2.1
import { DashboardTestProvider } from "../../../../../tests/utils/dashboard-providers";
import { DashboardMockDataGenerator } from "../../../../../tests/utils/dashboard-mocks";
import { WebSocketSimulator } from "../../../../../tests/utils/websocket-mocks";
import { DashboardTestIDs } from "../../../../../tests/utils/dashboard-test-helpers";

// These components/hooks don't exist yet - RED phase of TDD
import { Dashboard } from "../../../components/Dashboard";
import { useRealTimeMetrics } from "../../../hooks/useRealTimeMetrics";
import { useWebSocketConnection } from "../../../hooks/useWebSocketConnection";
import { useDashboardWithSync } from "../../../hooks/useDashboardWithSync";

describe("Real-Time Dashboard Synchronization Integration", () => {
  let wsSimulator: WebSocketSimulator;
  let queryClient: QueryClient;
  let mockGenerator: DashboardMockDataGenerator;
  const user = userEvent.setup();

  beforeEach(() => {
    wsSimulator = new WebSocketSimulator();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    mockGenerator = new DashboardMockDataGenerator();
  });

  afterEach(() => {
    wsSimulator.cleanup();
    vi.clearAllMocks();
  });

  describe("WebSocket + TanStack Query Integration (5 tests)", () => {
    it("should update query cache on WebSocket message", async () => {
      const initialMetrics = mockGenerator.createDashboardMetrics({
        occupancyRate: 75.5,
      });

      render(
        <DashboardTestProvider
          queryClient={queryClient}
          initialMetrics={initialMetrics}
          realtimeEnabled={true}
        >
          <Dashboard />
        </DashboardTestProvider>
      );

      // Verify initial metrics
      expect(screen.getByTestId(DashboardTestIDs.occupancyRate)).toHaveTextContent("75.5%");

      // Send WebSocket update
      wsSimulator.simulateMetricUpdate({
        occupancyRate: 95,
      });

      await waitFor(() => {
        expect(screen.getByTestId(DashboardTestIDs.occupancyRate)).toHaveTextContent("95%");
      });

      // Verify query cache was updated
      const cachedData = queryClient.getQueryData(["metrics"]);
      expect(cachedData).toMatchObject({ occupancyRate: 95 });
    });

    it("should fallback to polling when WebSocket disconnects", async () => {
      const fetchMetrics = vi.fn().mockResolvedValue({
        occupancyRate: 80,
        checkInsToday: 5,
        checkOutsToday: 3,
      });

      render(
        <DashboardTestProvider
          queryClient={queryClient}
          fetchMetrics={fetchMetrics}
          fallbackPolling={true}
          pollingInterval={1000}
        >
          <Dashboard />
        </DashboardTestProvider>
      );

      // Initially connected via WebSocket
      expect(screen.getByTestId("connection-status")).toHaveTextContent("Connected");

      // Disconnect WebSocket
      wsSimulator.disconnect();

      await waitFor(() => {
        expect(screen.getByTestId("connection-status")).toHaveTextContent("Polling");
      });

      // Verify polling is active
      vi.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(fetchMetrics).toHaveBeenCalledTimes(2); // Initial + 1 poll
      });
    });

    it("should coordinate optimistic updates with real-time data", async () => {
      const initialBookings = mockGenerator.createBookingsList(5);

      render(
        <DashboardTestProvider queryClient={queryClient} initialBookings={initialBookings}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const checkInsToday = screen.getByTestId(DashboardTestIDs.checkInsToday);
      const initialCount = parseInt(checkInsToday.textContent!);

      // Trigger optimistic update via UI
      const quickCheckinBtn = screen.getByRole("button", { name: "Quick Check-in" });
      await user.click(quickCheckinBtn);

      // Fill form
      const guestNameInput = screen.getByLabelText("Guest Name");
      await user.type(guestNameInput, "Juan Dela Cruz");

      const roomSelect = screen.getByLabelText("Room");
      await user.selectOptions(roomSelect, "101");

      const submitBtn = screen.getByRole("button", { name: "Check In" });
      await user.click(submitBtn);

      // Immediate optimistic update
      expect(checkInsToday).toHaveTextContent(String(initialCount + 1));

      // Simulate server confirmation via WebSocket
      wsSimulator.simulateBookingConfirmation({
        type: "check_in",
        guestName: "Juan Dela Cruz",
        roomNumber: "101",
        checkInsToday: initialCount + 1,
      });

      await waitFor(() => {
        // Value should remain the same (no flicker)
        expect(checkInsToday).toHaveTextContent(String(initialCount + 1));
      });
    });

    it("should handle WebSocket reconnection gracefully", async () => {
      render(
        <DashboardTestProvider queryClient={queryClient} realtimeEnabled={true}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const connectionStatus = screen.getByTestId("connection-status");
      expect(connectionStatus).toHaveTextContent("Connected");

      // Simulate connection loss
      wsSimulator.disconnect();

      await waitFor(() => {
        expect(connectionStatus).toHaveTextContent("Reconnecting...");
      });

      // Simulate successful reconnection
      wsSimulator.reconnect();

      await waitFor(() => {
        expect(connectionStatus).toHaveTextContent("Connected");
      });

      // Should resync data after reconnection
      expect(screen.getByTestId("sync-status")).toHaveTextContent("Synced");
    });

    it("should batch rapid WebSocket updates efficiently", async () => {
      const renderSpy = vi.fn();

      const TestComponent = () => {
        renderSpy();
        const metrics = useRealTimeMetrics();
        return <div>{metrics.occupancyRate}%</div>;
      };

      render(
        <DashboardTestProvider queryClient={queryClient}>
          <TestComponent />
        </DashboardTestProvider>
      );

      const initialRenderCount = renderSpy.mock.calls.length;

      // Send 50 rapid updates
      for (let i = 0; i < 50; i++) {
        wsSimulator.simulateMetricUpdate({
          occupancyRate: 50 + i,
        });
      }

      await waitFor(() => {
        expect(screen.getByText("99%")).toBeInTheDocument();
      });

      // Should batch updates and not render 50 times
      const additionalRenders = renderSpy.mock.calls.length - initialRenderCount;
      expect(additionalRenders).toBeLessThan(10);
    });
  });

  describe("Multi-Tab Synchronization (5 tests)", () => {
    it("should sync dashboard state across browser tabs", async () => {
      const broadcastChannel = new BroadcastChannel("dashboard_state");
      const messageHandler = vi.fn();

      broadcastChannel.addEventListener("message", messageHandler);

      render(
        <DashboardTestProvider queryClient={queryClient}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Change date range in current tab
      const dateRangeBtn = screen.getByRole("button", { name: "Date Range" });
      await user.click(dateRangeBtn);

      const thisWeekOption = screen.getByRole("option", { name: "This Week" });
      await user.click(thisWeekOption);

      await waitFor(() => {
        expect(messageHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: "DATE_RANGE_CHANGE",
              payload: expect.objectContaining({
                preset: "thisWeek",
              }),
            }),
          })
        );
      });

      broadcastChannel.close();
    });

    it("should elect single WebSocket connection across tabs", async () => {
      const connections: string[] = [];

      wsSimulator.onConnection((id) => {
        connections.push(id);
      });

      // Simulate multiple tabs
      const tabs = [
        render(
          <DashboardTestProvider tabId="tab1" queryClient={queryClient}>
            <Dashboard />
          </DashboardTestProvider>
        ),
        render(
          <DashboardTestProvider tabId="tab2" queryClient={queryClient}>
            <Dashboard />
          </DashboardTestProvider>
        ),
        render(
          <DashboardTestProvider tabId="tab3" queryClient={queryClient}>
            <Dashboard />
          </DashboardTestProvider>
        ),
      ];

      await waitFor(() => {
        // Only one WebSocket connection should be established
        expect(connections).toHaveLength(1);
      });

      // Verify leader indicator
      const leaderBadges = screen.getAllByTestId("leader-badge");
      const visibleLeaders = leaderBadges.filter((badge) => badge.style.display !== "none");
      expect(visibleLeaders).toHaveLength(1);
    });

    it("should transfer leadership when leader tab closes", async () => {
      const { unmount: unmountTab1 } = render(
        <DashboardTestProvider tabId="tab1" queryClient={queryClient}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const { container: tab2Container } = render(
        <DashboardTestProvider tabId="tab2" queryClient={queryClient}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Initially tab1 is leader
      await waitFor(() => {
        const tab1Leader = screen.getByTestId("tab1-leader-status");
        expect(tab1Leader).toHaveTextContent("Leader");
      });

      // Close tab1
      unmountTab1();

      // Tab2 should become leader
      await waitFor(() => {
        const tab2Leader = tab2Container.querySelector('[data-testid="tab2-leader-status"]');
        expect(tab2Leader).toHaveTextContent("Leader");
      });
    });

    it("should sync filter preferences across tabs", async () => {
      const broadcastChannel = new BroadcastChannel("dashboard_filters");
      const syncHandler = vi.fn();

      broadcastChannel.addEventListener("message", syncHandler);

      render(
        <DashboardTestProvider queryClient={queryClient}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Apply filters in current tab
      const propertyFilter = screen.getByLabelText("Property");
      await user.selectOptions(propertyFilter, "beachfront");

      const statusFilter = screen.getByLabelText("Booking Status");
      await user.selectOptions(statusFilter, "confirmed");

      await waitFor(() => {
        expect(syncHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              type: "FILTER_CHANGE",
              filters: {
                property: "beachfront",
                bookingStatus: "confirmed",
              },
            }),
          })
        );
      });

      broadcastChannel.close();
    });

    it("should handle storage quota exceeded gracefully", async () => {
      const errorHandler = vi.fn();

      // Mock localStorage to throw quota exceeded
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new DOMException("QuotaExceededError");
      });

      render(
        <DashboardTestProvider queryClient={queryClient} onStorageError={errorHandler}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Trigger state sync that would normally save to localStorage
      const dateRangeBtn = screen.getByRole("button", { name: "Date Range" });
      await user.click(dateRangeBtn);

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "STORAGE_QUOTA_EXCEEDED",
            fallback: "memory",
          })
        );
      });

      // Should still function using memory storage
      expect(screen.getByTestId("sync-status")).toHaveTextContent("Memory Only");

      localStorage.setItem = originalSetItem;
    });
  });

  describe("Performance Under Load (5 tests)", () => {
    it("should handle rapid real-time updates without blocking UI", async () => {
      render(
        <DashboardTestProvider queryClient={queryClient}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const updateTimes: number[] = [];
      const startTime = performance.now();

      // Send 100 rapid updates
      for (let i = 0; i < 100; i++) {
        wsSimulator.simulateMetricUpdate({
          occupancyRate: 50 + i * 0.5,
          checkInsToday: 10 + i,
          revenue: 100000 + i * 1000,
        });
        updateTimes.push(performance.now() - startTime);
      }

      // All updates should be processed quickly
      const avgUpdateTime = updateTimes.reduce((a, b) => a + b) / updateTimes.length;
      expect(avgUpdateTime).toBeLessThan(10); // Less than 10ms average

      // UI should remain responsive
      const button = screen.getByRole("button", { name: "Refresh" });
      await user.click(button);

      expect(button).toHaveAttribute("aria-busy", "true");
    });

    it("should throttle dashboard re-renders during burst updates", async () => {
      let renderCount = 0;

      const TestDashboard = () => {
        renderCount++;
        return <Dashboard />;
      };

      render(
        <DashboardTestProvider queryClient={queryClient}>
          <TestDashboard />
        </DashboardTestProvider>
      );

      const initialRenders = renderCount;

      // Send 50 updates in rapid succession
      for (let i = 0; i < 50; i++) {
        wsSimulator.simulateMetricUpdate({
          occupancyRate: 50 + i,
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId(DashboardTestIDs.occupancyRate)).toHaveTextContent("99%");
      });

      // Should batch updates and not render 50 times
      const additionalRenders = renderCount - initialRenders;
      expect(additionalRenders).toBeLessThan(10);
    });

    it("should maintain 60fps during activity feed updates", async () => {
      const activities = mockGenerator.createActivityFeed().withBookingActivities(20).build();

      render(
        <DashboardTestProvider queryClient={queryClient} initialActivities={activities}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const frameTimings: number[] = [];
      let lastFrameTime = performance.now();

      // Monitor frame timing during updates
      const measureFrame = () => {
        const currentTime = performance.now();
        const frameDuration = currentTime - lastFrameTime;
        frameTimings.push(frameDuration);
        lastFrameTime = currentTime;
      };

      // Simulate 30 new activities
      for (let i = 0; i < 30; i++) {
        requestAnimationFrame(measureFrame);

        wsSimulator.simulateBookingActivity({
          type: "check_in",
          guestName: `Guest ${i}`,
          roomNumber: `${100 + i}`,
        });
      }

      await waitFor(() => {
        const activityItems = screen.getAllByTestId(/activity-item-/);
        expect(activityItems.length).toBeGreaterThan(20);
      });

      // Check frame timings (60fps = 16.67ms per frame)
      const slowFrames = frameTimings.filter((time) => time > 20);
      expect(slowFrames.length / frameTimings.length).toBeLessThan(0.1); // Less than 10% slow frames
    });

    it("should efficiently handle large metric datasets", async () => {
      const largeMetrics = mockGenerator.createDashboardMetrics({
        monthlyData: Array.from({ length: 365 }, (_, i) => ({
          date: new Date(2024, 0, i + 1),
          revenue: 50000 + Math.random() * 50000,
          bookings: Math.floor(10 + Math.random() * 20),
          occupancy: 60 + Math.random() * 30,
        })),
      });

      const startTime = performance.now();

      render(
        <DashboardTestProvider queryClient={queryClient} initialMetrics={largeMetrics}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const renderTime = performance.now() - startTime;

      // Should render large dataset efficiently
      expect(renderTime).toBeLessThan(500); // Less than 500ms

      // Charts should be rendered
      expect(screen.getByTestId("revenue-chart")).toBeInTheDocument();
      expect(screen.getByTestId("occupancy-chart")).toBeInTheDocument();
    });

    it("should implement virtual scrolling for activity feed", async () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withBookingActivities(500) // Large number of activities
        .build();

      render(
        <DashboardTestProvider queryClient={queryClient} initialActivities={activities}>
          <Dashboard />
        </DashboardTestProvider>
      );

      const activityFeed = screen.getByTestId("activity-feed");
      const visibleItems = screen.getAllByTestId(/activity-item-/);

      // Should only render visible items (virtual scrolling)
      expect(visibleItems.length).toBeLessThan(50);

      // Scroll to bottom
      fireEvent.scroll(activityFeed, {
        target: { scrollTop: activityFeed.scrollHeight },
      });

      await waitFor(() => {
        const newVisibleItems = screen.getAllByTestId(/activity-item-/);
        // Different items should be visible after scrolling
        expect(newVisibleItems[0].id).not.toBe(visibleItems[0].id);
      });
    });
  });

  describe("Error Recovery and Resilience (5 tests)", () => {
    it("should recover from WebSocket connection errors", async () => {
      const onError = vi.fn();

      render(
        <DashboardTestProvider queryClient={queryClient} onConnectionError={onError}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Simulate connection error
      wsSimulator.simulateError("CONNECTION_LOST");

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "CONNECTION_LOST",
            retry: true,
          })
        );
      });

      // Should show error state
      expect(screen.getByTestId("connection-error")).toHaveTextContent(
        "Connection lost. Retrying..."
      );

      // Simulate successful recovery
      wsSimulator.reconnect();

      await waitFor(() => {
        expect(screen.queryByTestId("connection-error")).not.toBeInTheDocument();
        expect(screen.getByTestId("connection-status")).toHaveTextContent("Connected");
      });
    });

    it("should handle malformed WebSocket messages gracefully", async () => {
      const errorHandler = vi.fn();

      render(
        <DashboardTestProvider queryClient={queryClient} onMessageError={errorHandler}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Send malformed message
      wsSimulator.sendRaw("{ invalid json }");

      await waitFor(() => {
        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "PARSE_ERROR",
            raw: "{ invalid json }",
          })
        );
      });

      // Dashboard should continue functioning
      expect(screen.getByTestId("dashboard-container")).toBeInTheDocument();

      // Should log error but not crash
      expect(screen.queryByTestId("error-boundary")).not.toBeInTheDocument();
    });

    it("should handle query failures with retry logic", async () => {
      let attempts = 0;
      const fetchMetrics = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(mockGenerator.createDashboardMetrics());
      });

      render(
        <DashboardTestProvider
          queryClient={queryClient}
          fetchMetrics={fetchMetrics}
          retryAttempts={3}
        >
          <Dashboard />
        </DashboardTestProvider>
      );

      // Should show loading initially
      expect(screen.getByTestId("metrics-loading")).toBeInTheDocument();

      await waitFor(() => {
        // Should eventually succeed after retries
        expect(screen.queryByTestId("metrics-loading")).not.toBeInTheDocument();
        expect(screen.getByTestId(DashboardTestIDs.occupancyRate)).toBeInTheDocument();
      });

      expect(fetchMetrics).toHaveBeenCalledTimes(3);
    });

    it("should handle conflicting real-time updates", async () => {
      const conflictResolver = vi.fn((local, server) => server); // Server wins

      render(
        <DashboardTestProvider
          queryClient={queryClient}
          conflictResolution="custom"
          conflictResolver={conflictResolver}
        >
          <Dashboard />
        </DashboardTestProvider>
      );

      // Apply local optimistic update
      const occupancy = screen.getByTestId(DashboardTestIDs.occupancyRate);
      const localUpdate = { occupancyRate: 85 };

      // Simulate optimistic update
      fireEvent.click(screen.getByRole("button", { name: "Quick Update" }));

      // Receive conflicting server update
      wsSimulator.simulateMetricUpdate({
        occupancyRate: 90,
        version: 2,
      });

      await waitFor(() => {
        expect(conflictResolver).toHaveBeenCalledWith(localUpdate, {
          occupancyRate: 90,
          version: 2,
        });
      });

      // Server value should win
      expect(occupancy).toHaveTextContent("90%");
    });

    it("should degrade gracefully during Philippine typhoon conditions", async () => {
      render(
        <DashboardTestProvider queryClient={queryClient} enableTyphoonMode={true}>
          <Dashboard />
        </DashboardTestProvider>
      );

      // Simulate degraded network (common during typhoons)
      wsSimulator.simulateSlowConnection(5000); // 5 second latency

      // Should show typhoon mode indicator
      expect(screen.getByTestId("typhoon-mode-banner")).toHaveTextContent(
        "Typhoon Mode: Operating with limited connectivity"
      );

      // Should use longer cache times
      const cacheConfig = queryClient.getDefaultOptions().queries;
      expect(cacheConfig?.staleTime).toBeGreaterThanOrEqual(30 * 60 * 1000); // 30 minutes

      // Should batch updates more aggressively
      for (let i = 0; i < 10; i++) {
        wsSimulator.simulateMetricUpdate({ checkInsToday: i });
      }

      await waitFor(() => {
        // Should show latest value despite slow connection
        expect(screen.getByTestId(DashboardTestIDs.checkInsToday)).toHaveTextContent("9");
      });

      // Should prioritize critical operations
      const criticalOps = screen.getByTestId("critical-operations");
      expect(criticalOps.children[0]).toHaveTextContent("Check-in/Check-out");
      expect(criticalOps.children[1]).toHaveTextContent("Payment Processing");
    });
  });
});
