/**
 * Dashboard Test Helpers - Phase 2.1 TDD Utilities
 *
 * Comprehensive test utilities for dashboard components following the successful
 * patterns established in Phase 1 authentication testing. Provides specialized
 * helpers for testing metric cards, activity feeds, and real-time dashboard updates.
 *
 * These utilities support the RED phase of TDD - creating failing tests before
 * implementation to define expected behavior for Okaeri Resort's dashboard.
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 2.1 - Dashboard TDD
 */

import type { ReactElement } from "react";
import type { RenderOptions } from "@testing-library/react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, expect } from "vitest";
import type { DashboardStats, ChartData, ActivityLog, Booking, DateRange } from "@/types/common";

// Dashboard-specific test IDs following Phase 1 patterns
export const DASHBOARD_TEST_IDS = {
  // Main dashboard containers
  DASHBOARD_CONTAINER: "dashboard-container",
  STATS_GRID: "stats-grid",
  CHARTS_SECTION: "charts-section",
  ACTIVITY_FEED: "activity-feed",
  QUICK_ACTIONS: "quick-actions",

  // Metric cards
  METRIC_CARD: "metric-card",
  METRIC_REVENUE: "metric-revenue",
  METRIC_EXPENSES: "metric-expenses",
  METRIC_OCCUPANCY: "metric-occupancy",
  METRIC_BOOKINGS: "metric-bookings",
  METRIC_NET_INCOME: "metric-net-income",
  METRIC_AVG_RATE: "metric-avg-rate",

  // Metric card elements
  METRIC_VALUE: "metric-value",
  METRIC_LABEL: "metric-label",
  METRIC_TREND: "metric-trend",
  METRIC_TREND_UP: "metric-trend-up",
  METRIC_TREND_DOWN: "metric-trend-down",
  METRIC_COMPARISON: "metric-comparison",
  METRIC_LOADING: "metric-loading",
  METRIC_ERROR: "metric-error",

  // Charts and visualizations
  REVENUE_CHART: "revenue-chart",
  OCCUPANCY_CHART: "occupancy-chart",
  BOOKING_TIMELINE: "booking-timeline",
  EXPENSE_BREAKDOWN: "expense-breakdown",
  CHART_LOADING: "chart-loading",
  CHART_ERROR: "chart-error",
  CHART_NO_DATA: "chart-no-data",

  // Activity feed
  ACTIVITY_ITEM: "activity-item",
  ACTIVITY_TIME: "activity-time",
  ACTIVITY_USER: "activity-user",
  ACTIVITY_ACTION: "activity-action",
  ACTIVITY_RESOURCE: "activity-resource",
  ACTIVITY_LOADING: "activity-loading",
  ACTIVITY_EMPTY: "activity-empty",

  // Date controls
  DATE_RANGE_PICKER: "date-range-picker",
  DATE_FROM: "date-from",
  DATE_TO: "date-to",
  DATE_PRESET_TODAY: "date-preset-today",
  DATE_PRESET_WEEK: "date-preset-week",
  DATE_PRESET_MONTH: "date-preset-month",
  DATE_PRESET_YEAR: "date-preset-year",

  // Quick actions
  ADD_BOOKING: "add-booking",
  ADD_EXPENSE: "add-expense",
  VIEW_CALENDAR: "view-calendar",
  VIEW_REPORTS: "view-reports",

  // Mobile interactions
  SWIPE_CONTAINER: "swipe-container",
  PULL_REFRESH: "pull-refresh",
  TOUCH_CARD: "touch-card",

  // Loading and error states
  SKELETON_CARD: "skeleton-card",
  ERROR_BOUNDARY: "error-boundary",
  RETRY_BUTTON: "retry-button",
  REFRESH_BUTTON: "refresh-button",

  // Accessibility elements
  LIVE_REGION: "live-region",
  SCREEN_READER_SUMMARY: "screen-reader-summary",
  KEYBOARD_SHORTCUTS: "keyboard-shortcuts",
} as const;

/**
 * Dashboard component rendering helpers
 * Provides consistent rendering with proper providers and mocking
 */
export const dashboardRenderHelpers = {
  /**
   * Render a metric card component with proper test context
   * @param ui - The component to render
   * @param options - Additional render options
   */
  renderMetricCard: (
    ui: ReactElement,
    options: {
      mockData?: Partial<DashboardStats>;
      isLoading?: boolean;
      error?: string | null;
    } = {}
  ) => {
    const { mockData = {}, isLoading = false, error = null } = options;

    // Mock dashboard store with provided data
    vi.doMock("@/stores/dashboardStore", () => ({
      useDashboardStore: vi.fn(() => ({
        stats: mockData,
        isLoading,
        error,
        fetchStats: vi.fn(),
        clearError: vi.fn(),
      })),
    }));

    return render(ui);
  },

  /**
   * Render chart components with canvas mocking
   * @param ui - The chart component to render
   * @param options - Chart-specific options
   */
  renderChart: (
    ui: ReactElement,
    options: {
      mockData?: ChartData;
      isLoading?: boolean;
      error?: string | null;
    } = {}
  ) => {
    const { mockData = { labels: [], datasets: [] }, isLoading = false, error = null } = options;

    // Ensure canvas is properly mocked (from test setup)
    const canvasContext = {
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      strokeRect: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => canvasContext);

    return render(ui);
  },

  /**
   * Render activity feed with mock data
   * @param ui - The activity feed component
   * @param options - Activity feed options
   */
  renderActivityFeed: (
    ui: ReactElement,
    options: {
      mockActivities?: ActivityLog[];
      isLoading?: boolean;
      error?: string | null;
    } = {}
  ) => {
    const { mockActivities = [], isLoading = false, error = null } = options;

    vi.doMock("@/hooks/useActivityLog", () => ({
      useActivityLog: vi.fn(() => ({
        activities: mockActivities,
        isLoading,
        error,
        refetch: vi.fn(),
      })),
    }));

    return render(ui);
  },

  /**
   * Render dashboard with full context and real-time updates
   * @param ui - The dashboard component
   * @param options - Dashboard options
   */
  renderDashboard: (
    ui: ReactElement,
    options: {
      mockStats?: Partial<DashboardStats>;
      mockActivities?: ActivityLog[];
      realtimeEnabled?: boolean;
    } = {}
  ) => {
    const { mockStats = {}, mockActivities = [], realtimeEnabled = false } = options;

    // Mock WebSocket for real-time updates
    if (realtimeEnabled) {
      global.WebSocket = vi.fn().mockImplementation(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
        readyState: 1, // OPEN
      }));
    }

    return render(ui);
  },
};

/**
 * User interaction helpers for dashboard components
 * Simulates real user behavior including touch gestures
 */
export const dashboardInteractionHelpers = {
  /**
   * Simulate metric card click/tap interaction
   * @param testId - The test ID of the metric card
   */
  clickMetricCard: async (testId: string) => {
    const user = userEvent.setup();
    const card = screen.getByTestId(testId);
    await user.click(card);
  },

  /**
   * Simulate swipe gesture for mobile card navigation
   * @param container - The swipeable container
   * @param direction - Swipe direction
   */
  swipeCard: async (container: HTMLElement, direction: "left" | "right" | "up" | "down") => {
    const startCoords = { clientX: 100, clientY: 100 };
    const endCoords = {
      left: { clientX: 50, clientY: 100 },
      right: { clientX: 150, clientY: 100 },
      up: { clientX: 100, clientY: 50 },
      down: { clientX: 100, clientY: 150 },
    };

    // Simulate touch events
    fireEvent.touchStart(container, {
      touches: [{ ...startCoords }],
    });

    fireEvent.touchMove(container, {
      touches: [{ ...endCoords[direction] }],
    });

    fireEvent.touchEnd(container, {
      changedTouches: [{ ...endCoords[direction] }],
    });
  },

  /**
   * Simulate pull-to-refresh gesture
   * @param container - The refreshable container
   */
  pullToRefresh: async (container: HTMLElement) => {
    // Simulate pull down gesture
    fireEvent.touchStart(container, {
      touches: [{ clientX: 100, clientY: 50 }],
    });

    fireEvent.touchMove(container, {
      touches: [{ clientX: 100, clientY: 150 }],
    });

    fireEvent.touchEnd(container, {
      changedTouches: [{ clientX: 100, clientY: 150 }],
    });

    // Wait for refresh animation
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  },

  /**
   * Change date range using date picker
   * @param fromDate - Start date
   * @param toDate - End date
   */
  changeDateRange: async (fromDate: string, toDate: string) => {
    const user = userEvent.setup();

    const fromInput = screen.getByTestId(DASHBOARD_TEST_IDS.DATE_FROM);
    const toInput = screen.getByTestId(DASHBOARD_TEST_IDS.DATE_TO);

    await user.clear(fromInput);
    await user.type(fromInput, fromDate);

    await user.clear(toInput);
    await user.type(toInput, toDate);

    // Trigger change event
    fireEvent.change(fromInput, { target: { value: fromDate } });
    fireEvent.change(toInput, { target: { value: toDate } });
  },

  /**
   * Select date preset (today, week, month, year)
   * @param preset - The preset to select
   */
  selectDatePreset: async (preset: "today" | "week" | "month" | "year") => {
    const user = userEvent.setup();
    const presetMap = {
      today: DASHBOARD_TEST_IDS.DATE_PRESET_TODAY,
      week: DASHBOARD_TEST_IDS.DATE_PRESET_WEEK,
      month: DASHBOARD_TEST_IDS.DATE_PRESET_MONTH,
      year: DASHBOARD_TEST_IDS.DATE_PRESET_YEAR,
    };

    const button = screen.getByTestId(presetMap[preset]);
    await user.click(button);
  },

  /**
   * Trigger chart interaction (hover, click)
   * @param chartTestId - Chart test ID
   * @param interaction - Type of interaction
   */
  interactWithChart: async (
    chartTestId: string,
    interaction: "hover" | "click",
    coordinates: { x: number; y: number } = { x: 100, y: 100 }
  ) => {
    const chart = screen.getByTestId(chartTestId);
    const canvas = chart.querySelector("canvas");

    if (canvas) {
      if (interaction === "hover") {
        fireEvent.mouseMove(canvas, {
          clientX: coordinates.x,
          clientY: coordinates.y,
        });
      } else {
        fireEvent.click(canvas, {
          clientX: coordinates.x,
          clientY: coordinates.y,
        });
      }
    }
  },

  /**
   * Scroll activity feed to load more items
   * @param feedContainer - Activity feed container
   */
  scrollActivityFeed: async (feedContainer: HTMLElement) => {
    // Simulate scroll to bottom
    fireEvent.scroll(feedContainer, {
      target: {
        scrollTop: feedContainer.scrollHeight,
        scrollHeight: feedContainer.scrollHeight,
        clientHeight: feedContainer.clientHeight,
      },
    });

    // Wait for potential loading
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  },
};

/**
 * Loading state testing helpers
 * Validates loading states and skeleton loaders
 */
export const dashboardLoadingHelpers = {
  /**
   * Wait for dashboard loading to complete
   */
  waitForDashboardLoad: async () => {
    // Wait for skeleton loaders to disappear
    await waitFor(() => {
      const skeletons = screen.queryAllByTestId(DASHBOARD_TEST_IDS.SKELETON_CARD);
      expect(skeletons).toHaveLength(0);
    });

    // Wait for loading spinners to disappear
    await waitFor(() => {
      const spinners = screen.queryAllByTestId(DASHBOARD_TEST_IDS.METRIC_LOADING);
      expect(spinners).toHaveLength(0);
    });
  },

  /**
   * Assert that metric card is in loading state
   * @param testId - Metric card test ID
   */
  expectMetricLoading: (testId: string) => {
    const card = screen.getByTestId(testId);
    expect(card).toBeInTheDocument();

    // Should have loading indicator or skeleton
    const loading = screen.getByTestId(DASHBOARD_TEST_IDS.METRIC_LOADING);
    expect(loading).toBeInTheDocument();
  },

  /**
   * Assert that chart is in loading state
   * @param testId - Chart test ID
   */
  expectChartLoading: (testId: string) => {
    const chart = screen.getByTestId(testId);
    expect(chart).toBeInTheDocument();

    const loading = screen.getByTestId(DASHBOARD_TEST_IDS.CHART_LOADING);
    expect(loading).toBeInTheDocument();
  },

  /**
   * Simulate real-time data update
   * @param newData - Updated dashboard data
   */
  simulateRealTimeUpdate: async (newData: Partial<DashboardStats>) => {
    // Mock WebSocket message
    const mockWebSocket = global.WebSocket as any;
    if (mockWebSocket && mockWebSocket.addEventListener) {
      const messageHandler = vi.fn();
      mockWebSocket.addEventListener = vi.fn((event, handler) => {
        if (event === "message") {
          messageHandler.mockImplementation(handler);
        }
      });

      // Simulate message
      await act(async () => {
        messageHandler({
          data: JSON.stringify({
            type: "dashboard_update",
            payload: newData,
          }),
        });
      });
    }
  },
};

/**
 * Error state testing helpers
 * Validates error handling and recovery
 */
export const dashboardErrorHelpers = {
  /**
   * Assert that metric card shows error state
   * @param testId - Metric card test ID
   */
  expectMetricError: (testId: string, errorMessage?: string) => {
    const card = screen.getByTestId(testId);
    expect(card).toBeInTheDocument();

    const error = screen.getByTestId(DASHBOARD_TEST_IDS.METRIC_ERROR);
    expect(error).toBeInTheDocument();

    if (errorMessage) {
      expect(error).toHaveTextContent(errorMessage);
    }
  },

  /**
   * Assert that chart shows error state
   * @param testId - Chart test ID
   */
  expectChartError: (testId: string) => {
    const chart = screen.getByTestId(testId);
    expect(chart).toBeInTheDocument();

    const error = screen.getByTestId(DASHBOARD_TEST_IDS.CHART_ERROR);
    expect(error).toBeInTheDocument();
  },

  /**
   * Trigger error retry action
   * @param testId - Component test ID
   */
  retryAfterError: async (testId: string) => {
    const user = userEvent.setup();
    const component = screen.getByTestId(testId);
    const retryButton = component.querySelector(
      `[data-testid="${DASHBOARD_TEST_IDS.RETRY_BUTTON}"]`
    ) as HTMLButtonElement;

    if (retryButton) {
      await user.click(retryButton);
    }
  },
};

/**
 * Performance testing helpers
 * Validates 60fps animations and memory usage
 */
export const dashboardPerformanceHelpers = {
  /**
   * Measure component render performance
   * @param renderFn - Function that renders the component
   */
  measureRenderTime: async (renderFn: () => void): Promise<number> => {
    const start = performance.now();
    await act(async () => {
      renderFn();
    });
    const end = performance.now();
    return end - start;
  },

  /**
   * Check for 60fps animation performance
   * @param element - Element with animation
   * @param duration - Animation duration in ms
   */
  checkAnimationPerformance: async (
    element: HTMLElement,
    duration: number = 1000
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      const frames: number[] = [];
      let lastTime = performance.now();
      let animationId: number;

      const trackFrame = () => {
        const currentTime = performance.now();
        const frameDuration = currentTime - lastTime;
        frames.push(frameDuration);
        lastTime = currentTime;

        if (currentTime - frames[0] < duration) {
          animationId = requestAnimationFrame(trackFrame);
        } else {
          cancelAnimationFrame(animationId);

          // Calculate average FPS
          const averageFrameDuration = frames.reduce((a, b) => a + b, 0) / frames.length;
          const averageFPS = 1000 / averageFrameDuration;

          // 60fps target (allow 10% tolerance)
          resolve(averageFPS >= 54);
        }
      };

      requestAnimationFrame(trackFrame);
    });
  },

  /**
   * Monitor memory usage during component lifecycle
   */
  monitorMemoryUsage: () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize;

    return {
      getMemoryDelta: () => {
        const currentMemory = (performance as any).memory?.usedJSHeapSize;
        return currentMemory - initialMemory;
      },

      checkMemoryLeak: (threshold: number = 1024 * 1024) => {
        // 1MB threshold
        const delta = (performance as any).memory?.usedJSHeapSize - initialMemory;
        return delta < threshold;
      },
    };
  },
};

/**
 * Mock data generators for consistent testing
 * Provides realistic test data for dashboard components
 */
export const dashboardMockData = {
  /**
   * Generate mock dashboard stats
   * @param overrides - Partial overrides for default stats
   */
  createMockStats: (overrides: Partial<DashboardStats> = {}): DashboardStats => ({
    totalRevenue: 125000,
    totalExpenses: 45000,
    netIncome: 80000,
    occupancyRate: 75.5,
    averageNightlyRate: 2500,
    totalBookings: 48,
    upcomingCheckIns: 5,
    upcomingCheckOuts: 3,
    revenueGrowth: 12.5,
    expenseGrowth: -5.2,
    ...overrides,
  }),

  /**
   * Generate mock activity log
   * @param count - Number of activities to generate
   */
  createMockActivities: (count: number = 10): ActivityLog[] => {
    const activities: ActivityLog[] = [];
    const actions = ["created", "updated", "cancelled", "checked_in", "checked_out"];
    const resources = ["booking", "expense", "property", "user"];

    for (let i = 0; i < count; i++) {
      activities.push({
        id: `activity-${i}`,
        userId: `user-${i % 3}`,
        projectId: "project-123",
        action: actions[i % actions.length],
        resource: resources[i % resources.length],
        resourceId: `resource-${i}`,
        details: { amount: 2500, guestName: "Juan Dela Cruz" },
        createdAt: new Date(Date.now() - i * 1000 * 60 * 60).toISOString(),
        user: {
          id: `user-${i % 3}`,
          name: `User ${i % 3}`,
          email: `user${i % 3}@okaeriresort.ph`,
          role: "STAFF" as any,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }

    return activities;
  },

  /**
   * Generate mock chart data
   * @param type - Chart type
   * @param dataPoints - Number of data points
   */
  createMockChartData: (
    type: "revenue" | "occupancy" | "expenses",
    dataPoints: number = 12
  ): ChartData => {
    const labels = Array.from({ length: dataPoints }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (dataPoints - 1 - i));
      return date.toLocaleDateString("en-PH", { month: "short" });
    });

    const baseValues = {
      revenue: () => Math.floor(Math.random() * 50000) + 75000,
      occupancy: () => Math.floor(Math.random() * 30) + 60,
      expenses: () => Math.floor(Math.random() * 20000) + 30000,
    };

    return {
      labels,
      datasets: [
        {
          label: type.charAt(0).toUpperCase() + type.slice(1),
          data: Array.from({ length: dataPoints }, () => baseValues[type]()),
          backgroundColor:
            type === "revenue" ? "#10b981" : type === "occupancy" ? "#3b82f6" : "#ef4444",
          borderColor:
            type === "revenue" ? "#059669" : type === "occupancy" ? "#2563eb" : "#dc2626",
          borderWidth: 2,
        },
      ],
    };
  },
};

// Export all helpers for easy importing
export * from "@testing-library/react";
export { userEvent, vi, expect };
