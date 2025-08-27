/**
 * Route Loaders Test Suite
 * Tests for TanStack Router data loaders including authentication,
 * data prefetching, error handling, and Philippine-specific features
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { redirect } from "@tanstack/react-router";
import {
  createAuthenticatedLoader,
  dashboardLoader,
  bookingsLoader,
  bookingDetailLoader,
  propertiesLoader,
  expensesLoader,
  reportsLoader,
  settingsLoader,
  analyticsLoader,
  batchLoader,
} from "../route-loaders";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { queryClient } from "@/lib/query-client";
import { apiClient } from "@/lib/api-client";
import { MOCK_USERS, MOCK_AUTH_STATES } from "@tests/utils/test-utils";

// Mock stores
vi.mock("@/stores/authStore", () => ({
  useAuthStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: {
    getState: vi.fn(),
  },
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: {
    getState: vi.fn(),
  },
}));

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  redirect: vi.fn(),
}));

// Mock query client
vi.mock("@/lib/query-client", () => ({
  queryClient: {
    fetchQuery: vi.fn(),
    prefetchQuery: vi.fn(),
    invalidateQueries: vi.fn(),
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
  },
  queryKeys: {
    dashboard: {
      stats: vi.fn((projectId) => ["dashboard", "stats", projectId]),
      charts: vi.fn((projectId) => ["dashboard", "charts", projectId]),
    },
    bookings: {
      list: vi.fn((projectId, params) => ["bookings", "list", projectId, params]),
      detail: vi.fn((projectId, id) => ["bookings", "detail", projectId, id]),
    },
    properties: {
      list: vi.fn((projectId, params) => ["properties", "list", projectId, params]),
      availability: vi.fn((projectId, id) => ["properties", "availability", projectId, id]),
    },
    expenses: {
      list: vi.fn((projectId, params) => ["expenses", "list", projectId, params]),
      categories: vi.fn((projectId) => ["expenses", "categories", projectId]),
      summary: vi.fn((projectId, dateRange) => ["expenses", "summary", projectId, dateRange]),
    },
    reports: {
      financial: vi.fn((projectId, params) => ["reports", "financial", projectId, params]),
      occupancy: vi.fn((projectId, params) => ["reports", "occupancy", projectId, params]),
      revenue: vi.fn((projectId, params) => ["reports", "revenue", projectId, params]),
    },
    analytics: {
      trends: vi.fn((projectId, metric) => ["analytics", "trends", projectId, metric]),
      forecasts: vi.fn((projectId) => ["analytics", "forecasts", projectId]),
      insights: vi.fn((projectId) => ["analytics", "insights", projectId]),
    },
  },
}));

// Mock API client
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock store integration modules
vi.mock("@/lib/store-router-integration", () => ({
  useNavigationStore: {
    getState: vi.fn(() => ({
      startNavigation: vi.fn(),
      completeNavigation: vi.fn(),
      failNavigation: vi.fn(),
      queuePrefetch: vi.fn(),
    })),
  },
  cacheSyncManager: {
    sync: vi.fn(),
  },
  optimisticUpdateManager: {
    applyOptimisticNavigation: vi.fn(),
    rollbackOptimisticNavigation: vi.fn(),
  },
  routeStateManager: {
    setRouteState: vi.fn(),
    getRouteState: vi.fn(),
    registerCleanup: vi.fn(),
  },
}));

// Mock route utils
vi.mock("@/lib/route-utils", () => ({
  PrefetchManager: vi.fn().mockImplementation(() => ({
    prefetchProperties: vi.fn(),
    prefetchBookings: vi.fn(),
  })),
}));

// Mock validation
vi.mock("@/types/route-params", () => ({
  validateSearchParams: vi.fn((schema, params) => params),
  DashboardSearchSchema: {},
  BookingsSearchSchema: {},
  PropertiesSearchSchema: {},
  ExpensesSearchSchema: {},
  ReportsSearchSchema: {},
}));

describe("Route Loaders", () => {
  const mockAuthState = {
    isAuthenticated: true,
    user: MOCK_USERS.OWNER,
    token: "mock-token",
  };

  const mockProjectState = {
    activeProjectId: "project-123",
    projects: [{ id: "project-123", name: "Test Resort", ownerId: MOCK_USERS.OWNER.id }],
    setActiveProject: vi.fn(),
    fetchProjects: vi.fn(),
    setProperties: vi.fn(),
  };

  const mockUIState = {
    setGlobalLoading: vi.fn(),
    isMobile: false,
    theme: "light",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (useAuthStore.getState as any).mockReturnValue(mockAuthState);
    (useProjectStore.getState as any).mockReturnValue(mockProjectState);
    (useUIStore.getState as any).mockReturnValue(mockUIState);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createAuthenticatedLoader", () => {
    const mockLoaderFn = vi.fn().mockResolvedValue({ data: "test" });

    it("should authenticate user before loading data", async () => {
      const loader = createAuthenticatedLoader(mockLoaderFn);
      const params = { location: { pathname: "/test" } };

      await loader(params);

      expect(mockLoaderFn).toHaveBeenCalledWith({
        ...params,
        projectId: "project-123",
        userId: MOCK_USERS.OWNER.id,
      });
    });

    it("should redirect to login when not authenticated", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        isAuthenticated: false,
        user: null,
        token: null,
      });

      const loader = createAuthenticatedLoader(mockLoaderFn);
      const params = { location: { pathname: "/test" } };

      await expect(loader(params)).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: "/login",
        search: { reason: "session_required" },
      });
    });

    it("should handle missing active project", async () => {
      (useProjectStore.getState as any).mockReturnValue({
        activeProjectId: null,
        projects: [{ id: "project-456", name: "Another Resort" }],
        setActiveProject: vi.fn().mockResolvedValue(undefined),
        fetchProjects: vi.fn(),
      });

      const loader = createAuthenticatedLoader(mockLoaderFn);
      const params = { location: { pathname: "/test" } };

      await loader(params);

      expect(mockProjectState.setActiveProject).toHaveBeenCalledWith("project-456");
    });

    it("should redirect to onboarding when no projects exist", async () => {
      (useProjectStore.getState as any).mockReturnValue({
        activeProjectId: null,
        projects: [],
        setActiveProject: vi.fn(),
        fetchProjects: vi.fn().mockResolvedValue(undefined),
      });

      const loader = createAuthenticatedLoader(mockLoaderFn);
      const params = { location: { pathname: "/test" } };

      await expect(loader(params)).rejects.toThrow();
      expect(redirect).toHaveBeenCalledWith({
        to: "/onboarding",
        search: { reason: "no_projects" },
      });
    });

    it("should handle loader function errors", async () => {
      const errorLoader = vi.fn().mockRejectedValue(new Error("Loader failed"));
      const loader = createAuthenticatedLoader(errorLoader);
      const params = { location: { pathname: "/test" } };

      await expect(loader(params)).rejects.toThrow("Loader failed");
    });
  });

  describe("dashboardLoader", () => {
    const mockDashboardData = {
      stats: { totalBookings: 10, revenue: 50000 },
      recentBookings: [{ id: "1", guestName: "Juan Dela Cruz" }],
      recentExpenses: [{ id: "1", description: "Office supplies" }],
      charts: { occupancy: [75, 80, 85] },
      alerts: [{ type: "warning", message: "Low inventory" }],
    };

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockDashboardData.stats)
        .mockResolvedValueOnce(mockDashboardData.recentBookings)
        .mockResolvedValueOnce(mockDashboardData.recentExpenses)
        .mockResolvedValueOnce(mockDashboardData.charts)
        .mockResolvedValueOnce(mockDashboardData.alerts);
    });

    it("should load comprehensive dashboard data", async () => {
      const params = {
        search: { dateRange: "month" },
        location: { pathname: "/dashboard" },
      };

      const result = await dashboardLoader(params);

      expect(result).toEqual({
        projectId: "project-123",
        dateRange: "month",
        stats: mockDashboardData.stats,
        recentBookings: mockDashboardData.recentBookings,
        recentExpenses: mockDashboardData.recentExpenses,
        charts: mockDashboardData.charts,
        alerts: mockDashboardData.alerts,
      });
    });

    it("should set and clear global loading state", async () => {
      const params = {
        search: { dateRange: "week" },
        location: { pathname: "/dashboard" },
      };

      await dashboardLoader(params);

      expect(mockUIState.setGlobalLoading).toHaveBeenCalledWith(true, "Loading dashboard...");
      expect(mockUIState.setGlobalLoading).toHaveBeenCalledWith(false);
    });

    it("should prefetch related data in background", async () => {
      const params = {
        search: { dateRange: "month" },
        location: { pathname: "/dashboard" },
      };

      await dashboardLoader(params);

      // Should set timeout for background prefetching
      expect(setTimeout).toHaveBeenCalled();
    });

    it("should handle date range parameters", async () => {
      const params = {
        search: {
          dateRange: "custom",
          startDate: "2024-01-01",
          endDate: "2024-01-31",
        },
        location: { pathname: "/dashboard" },
      };

      await dashboardLoader(params);

      expect(queryClient.fetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFn: expect.any(Function),
        })
      );
    });
  });

  describe("bookingsLoader", () => {
    const mockBookingsData = {
      items: [
        { id: "1", guestName: "Maria Santos", checkIn: "2024-02-01" },
        { id: "2", guestName: "Pedro Gonzales", checkIn: "2024-02-02" },
      ],
      hasNextPage: true,
      totalCount: 25,
    };

    const mockProperties = {
      items: [{ id: "prop-1", name: "Deluxe Room", type: "room", capacity: 2 }],
    };

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockBookingsData)
        .mockResolvedValueOnce(mockProperties);
      (queryClient.prefetchQuery as any).mockResolvedValue(undefined);
    });

    it("should load bookings with search parameters", async () => {
      const params = {
        search: {
          status: ["CONFIRMED"],
          page: 1,
          limit: 10,
        },
        location: { pathname: "/bookings" },
      };

      const result = await bookingsLoader(params);

      expect(result).toEqual({
        projectId: "project-123",
        search: params.search,
        bookings: mockBookingsData,
        properties: mockProperties,
      });
    });

    it("should prefetch next page when available", async () => {
      const params = {
        search: { page: 1, limit: 10 },
        location: { pathname: "/bookings" },
      };

      await bookingsLoader(params);

      expect(queryClient.prefetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: expect.arrayContaining(["bookings", "list"]),
        })
      );
    });

    it("should queue prefetch for visible booking details", async () => {
      const params = {
        search: { page: 1, limit: 10 },
        location: { pathname: "/bookings" },
      };

      await bookingsLoader(params);

      // Should queue prefetch for top booking items
      expect(
        require("@/lib/store-router-integration").useNavigationStore.getState().queuePrefetch
      ).toHaveBeenCalled();
    });

    it("should handle optimistic updates", async () => {
      const params = {
        search: { status: ["PENDING"] },
        location: { pathname: "/bookings" },
      };

      await bookingsLoader(params);

      expect(
        require("@/lib/store-router-integration").optimisticUpdateManager.applyOptimisticNavigation
      ).toHaveBeenCalledWith("/bookings");
    });

    it("should rollback optimistic updates on error", async () => {
      (queryClient.fetchQuery as any).mockRejectedValueOnce(new Error("Network error"));

      const params = {
        search: { status: ["CONFIRMED"] },
        location: { pathname: "/bookings" },
      };

      await expect(bookingsLoader(params)).rejects.toThrow("Network error");

      expect(
        require("@/lib/store-router-integration").optimisticUpdateManager
          .rollbackOptimisticNavigation
      ).toHaveBeenCalled();
    });
  });

  describe("bookingDetailLoader", () => {
    const mockBookingDetail = {
      id: "booking-123",
      guestName: "Juan Dela Cruz",
      propertyId: "prop-456",
      guestId: "guest-789",
    };

    const mockPayments = [{ id: "pay-1", amount: 5000, currency: "PHP", method: "GCash" }];

    const mockProperty = {
      id: "prop-456",
      name: "Ocean View Suite",
      type: "suite",
    };

    const mockGuestHistory = [{ id: "booking-100", checkIn: "2023-12-01", checkOut: "2023-12-05" }];

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockBookingDetail)
        .mockResolvedValueOnce(mockPayments)
        .mockResolvedValueOnce(mockProperty)
        .mockResolvedValueOnce(mockGuestHistory);
    });

    it("should load comprehensive booking details", async () => {
      const params = {
        params: { bookingId: "booking-123" },
        location: { pathname: "/bookings/booking-123" },
      };

      const result = await bookingDetailLoader(params);

      expect(result).toEqual({
        projectId: "project-123",
        bookingId: "booking-123",
        booking: mockBookingDetail,
        payments: mockPayments,
        property: mockProperty,
        guestHistory: mockGuestHistory,
      });
    });

    it("should handle Philippine payment methods (GCash)", async () => {
      const params = {
        params: { bookingId: "booking-123" },
        location: { pathname: "/bookings/booking-123" },
      };

      const result = await bookingDetailLoader(params);

      expect(result.payments[0].method).toBe("GCash");
      expect(result.payments[0].currency).toBe("PHP");
    });

    it("should store route state for caching", async () => {
      const params = {
        params: { bookingId: "booking-123" },
        location: { pathname: "/bookings/booking-123" },
      };

      await bookingDetailLoader(params);

      expect(
        require("@/lib/store-router-integration").routeStateManager.setRouteState
      ).toHaveBeenCalledWith("/bookings/booking-123", {
        booking: mockBookingDetail,
        payments: mockPayments,
        property: mockProperty,
        guestHistory: mockGuestHistory,
      });
    });
  });

  describe("propertiesLoader", () => {
    const mockProperties = {
      items: [
        { id: "prop-1", name: "Beachfront Villa", type: "villa", status: "AVAILABLE" },
        { id: "prop-2", name: "Garden Room", type: "room", status: "OCCUPIED" },
      ],
    };

    const mockAvailability = [
      { propertyId: "prop-1", availableDates: ["2024-02-01", "2024-02-02"] },
      { propertyId: "prop-2", availableDates: ["2024-02-05"] },
    ];

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockProperties)
        .mockResolvedValueOnce(mockAvailability[0])
        .mockResolvedValueOnce(mockAvailability[1]);
    });

    it("should load properties with availability data", async () => {
      const params = {
        search: { status: ["AVAILABLE"], type: "all" },
        location: { pathname: "/properties" },
      };

      const result = await propertiesLoader(params);

      expect(result).toEqual({
        projectId: "project-123",
        search: params.search,
        properties: mockProperties,
        availability: mockAvailability,
      });
    });

    it("should update project store with properties", async () => {
      const params = {
        search: { status: ["AVAILABLE"] },
        location: { pathname: "/properties" },
      };

      await propertiesLoader(params);

      expect(mockProjectState.setProperties).toHaveBeenCalledWith(mockProperties.items);
    });

    it("should fetch availability for visible properties only", async () => {
      const manyProperties = {
        items: Array.from({ length: 15 }, (_, i) => ({
          id: `prop-${i}`,
          name: `Property ${i}`,
        })),
      };

      (queryClient.fetchQuery as any).mockResolvedValueOnce(manyProperties);

      const params = {
        search: { status: ["AVAILABLE"] },
        location: { pathname: "/properties" },
      };

      await propertiesLoader(params);

      // Should only fetch availability for first 10 properties
      expect(queryClient.fetchQuery).toHaveBeenCalledTimes(11); // 1 for properties + 10 for availability
    });
  });

  describe("expensesLoader", () => {
    const mockExpenses = {
      items: [{ id: "exp-1", description: "Utility bills", amount: 5000, currency: "PHP" }],
    };

    const mockCategories = [
      { id: "cat-1", name: "Utilities", description: "Electricity, water, internet" },
      { id: "cat-2", name: "Maintenance", description: "Property upkeep" },
    ];

    const mockSummary = {
      totalAmount: 25000,
      byCategory: { Utilities: 5000, Maintenance: 20000 },
      currency: "PHP",
    };

    const mockProperties = {
      items: [{ id: "prop-1", name: "Main Building", type: "building" }],
    };

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockExpenses)
        .mockResolvedValueOnce(mockCategories)
        .mockResolvedValueOnce(mockSummary)
        .mockResolvedValueOnce(mockProperties);
      (queryClient.prefetchQuery as any).mockResolvedValue(undefined);
    });

    it("should load expenses with Filipino peso amounts", async () => {
      const params = {
        search: { dateRange: "month", category: "all" },
        location: { pathname: "/expenses" },
      };

      const result = await expensesLoader(params);

      expect(result).toEqual({
        projectId: "project-123",
        search: params.search,
        expenses: mockExpenses,
        categories: mockCategories,
        summary: mockSummary,
        properties: mockProperties,
      });

      expect(result.expenses.items[0].currency).toBe("PHP");
      expect(result.summary.currency).toBe("PHP");
    });

    it("should prefetch approval queue for managers", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: { ...MOCK_USERS.MANAGER, role: "MANAGER" },
      });

      const params = {
        search: { dateRange: "week" },
        location: { pathname: "/expenses" },
      };

      await expensesLoader(params);

      expect(queryClient.prefetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["expenses", "approval-queue", "project-123"],
        })
      );
    });

    it("should not prefetch approval queue for staff", async () => {
      (useAuthStore.getState as any).mockReturnValue({
        ...mockAuthState,
        user: { ...MOCK_USERS.STAFF, role: "STAFF" },
      });

      const params = {
        search: { dateRange: "week" },
        location: { pathname: "/expenses" },
      };

      await expensesLoader(params);

      expect(queryClient.prefetchQuery).not.toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["expenses", "approval-queue", "project-123"],
        })
      );
    });
  });

  describe("reportsLoader", () => {
    const mockReportData = {
      revenue: { total: 150000, currency: "PHP", growth: 15 },
      occupancy: { average: 85, peak: 95 },
    };

    const mockFinancialBreakdown = {
      income: 150000,
      expenses: 50000,
      profit: 100000,
      profitMargin: 67,
    };

    const mockProperties = {
      items: [{ id: "prop-1", name: "Deluxe Room", status: "ACTIVE" }],
    };

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockReportData)
        .mockResolvedValueOnce(mockFinancialBreakdown)
        .mockResolvedValueOnce(mockProperties);
    });

    it("should generate financial reports with Philippine peso", async () => {
      const params = {
        search: {
          reportType: "financial",
          dateRange: "month",
          startDate: "2024-01-01",
          endDate: "2024-01-31",
        },
        location: { pathname: "/reports" },
      };

      const result = await reportsLoader(params);

      expect(result.reportData.revenue.currency).toBe("PHP");
      expect(mockUIState.setGlobalLoading).toHaveBeenCalledWith(
        true,
        "Generating financial report..."
      );
    });

    it("should load different report types", async () => {
      const reportTypes = ["financial", "occupancy", "revenue"];

      for (const reportType of reportTypes) {
        const params = {
          search: {
            reportType,
            dateRange: "month",
          },
          location: { pathname: "/reports" },
        };

        await reportsLoader(params);

        expect(queryClient.fetchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            queryKey: expect.arrayContaining(["reports", reportType]),
          })
        );
      }
    });

    it("should store report state with timestamp", async () => {
      const params = {
        search: {
          reportType: "financial",
          dateRange: "quarter",
        },
        location: { pathname: "/reports" },
      };

      await reportsLoader(params);

      expect(
        require("@/lib/store-router-integration").routeStateManager.setRouteState
      ).toHaveBeenCalledWith(
        "/reports",
        expect.objectContaining({
          reportType: "financial",
          generatedAt: expect.any(Number),
        })
      );
    });
  });

  describe("settingsLoader", () => {
    const mockSettingsData = {
      projectSettings: {
        currency: "PHP",
        timezone: "Asia/Manila",
        language: "en-PH",
      },
      userProfile: {
        ...MOCK_USERS.OWNER,
        preferences: { theme: "light", notifications: true },
      },
      integrations: {
        gcash: { enabled: true, merchantId: "GC-12345" },
        googleSheets: { enabled: false },
      },
      teamMembers: [{ id: "member-1", name: "Maria Santos", role: "MANAGER" }],
      billingInfo: {
        plan: "premium",
        currency: "PHP",
        nextBilling: "2024-02-15",
      },
    };

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockSettingsData.projectSettings)
        .mockResolvedValueOnce(mockSettingsData.userProfile)
        .mockResolvedValueOnce(mockSettingsData.integrations)
        .mockResolvedValueOnce(mockSettingsData.teamMembers)
        .mockResolvedValueOnce(mockSettingsData.billingInfo);
    });

    it("should load Philippine-specific settings", async () => {
      const params = {
        location: { pathname: "/settings" },
      };

      const result = await settingsLoader(params);

      expect(result.projectSettings.currency).toBe("PHP");
      expect(result.projectSettings.timezone).toBe("Asia/Manila");
      expect(result.integrations.gcash.enabled).toBe(true);
    });

    it("should load user profile and preferences", async () => {
      const params = {
        location: { pathname: "/settings" },
      };

      const result = await settingsLoader(params);

      expect(result.userProfile.id).toBe(MOCK_USERS.OWNER.id);
      expect(result.userProfile.preferences.theme).toBe("light");
    });

    it("should handle billing in Philippine peso", async () => {
      const params = {
        location: { pathname: "/settings" },
      };

      const result = await settingsLoader(params);

      expect(result.billingInfo.currency).toBe("PHP");
      expect(result.billingInfo.plan).toBe("premium");
    });
  });

  describe("analyticsLoader", () => {
    const mockAnalyticsData = {
      trends: {
        revenue: [45000, 52000, 48000, 65000],
        occupancy: [75, 82, 79, 88],
      },
      forecasts: {
        revenue: { next30Days: 180000, confidence: 85 },
        occupancy: { next30Days: 82, trend: "increasing" },
      },
      insights: [
        { type: "opportunity", message: "Peak season bookings 15% higher than last year" },
        { type: "warning", message: "Maintenance costs trending upward" },
      ],
      comparisons: {
        previousPeriod: { revenue: 45000, occupancy: 75 },
        yearOverYear: { revenue: 38000, occupancy: 72 },
      },
    };

    beforeEach(() => {
      (queryClient.fetchQuery as any)
        .mockResolvedValueOnce(mockAnalyticsData.trends)
        .mockResolvedValueOnce(mockAnalyticsData.forecasts)
        .mockResolvedValueOnce(mockAnalyticsData.insights)
        .mockResolvedValueOnce(mockAnalyticsData.comparisons);
    });

    it("should load analytics with forecasting", async () => {
      const params = {
        search: { metric: "revenue", period: "month" },
        location: { pathname: "/analytics" },
      };

      const result = await analyticsLoader(params);

      expect(result).toEqual({
        projectId: "project-123",
        metric: "revenue",
        period: "month",
        trends: mockAnalyticsData.trends,
        forecasts: mockAnalyticsData.forecasts,
        insights: mockAnalyticsData.insights,
        comparisons: mockAnalyticsData.comparisons,
      });
    });

    it("should handle different metrics and periods", async () => {
      const metrics = ["revenue", "occupancy", "bookings"];
      const periods = ["week", "month", "quarter"];

      for (const metric of metrics) {
        for (const period of periods) {
          const params = {
            search: { metric, period },
            location: { pathname: "/analytics" },
          };

          await analyticsLoader(params);

          expect(queryClient.fetchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
              queryKey: expect.arrayContaining(["analytics", "trends", "project-123", metric]),
            })
          );
        }
      }
    });

    it("should cache insights for longer duration", async () => {
      const params = {
        search: { metric: "revenue", period: "month" },
        location: { pathname: "/analytics" },
      };

      await analyticsLoader(params);

      expect(queryClient.fetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          staleTime: 60 * 60 * 1000, // 1 hour
        })
      );
    });
  });

  describe("batchLoader", () => {
    it("should execute multiple loaders in parallel", async () => {
      const loader1 = vi.fn().mockResolvedValue("result1");
      const loader2 = vi.fn().mockResolvedValue("result2");
      const loader3 = vi.fn().mockResolvedValue("result3");

      const results = await batchLoader([loader1, loader2, loader3]);

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(loader1).toHaveBeenCalled();
      expect(loader2).toHaveBeenCalled();
      expect(loader3).toHaveBeenCalled();
    });

    it("should handle individual loader failures gracefully", async () => {
      const loader1 = vi.fn().mockResolvedValue("result1");
      const loader2 = vi.fn().mockRejectedValue(new Error("Failed"));
      const loader3 = vi.fn().mockResolvedValue("result3");

      const results = await batchLoader([loader1, loader2, loader3]);

      expect(results).toEqual(["result1", null, "result3"]);
    });

    it("should log errors for failed loaders", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const loader1 = vi.fn().mockResolvedValue("result1");
      const loader2 = vi.fn().mockRejectedValue(new Error("Network error"));

      await batchLoader([loader1, loader2]);

      expect(consoleSpy).toHaveBeenCalledWith("Loader 1 failed:", expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should handle API client errors", async () => {
      (queryClient.fetchQuery as any).mockRejectedValue(new Error("API Error"));

      const params = {
        search: { dateRange: "month" },
        location: { pathname: "/dashboard" },
      };

      await expect(dashboardLoader(params)).rejects.toThrow("API Error");
      expect(mockUIState.setGlobalLoading).toHaveBeenCalledWith(false);
    });

    it("should handle network timeouts", async () => {
      (queryClient.fetchQuery as any).mockRejectedValue(new Error("Request timeout"));

      const params = {
        search: { status: ["CONFIRMED"] },
        location: { pathname: "/bookings" },
      };

      await expect(bookingsLoader(params)).rejects.toThrow("Request timeout");
    });

    it("should handle malformed data gracefully", async () => {
      (queryClient.fetchQuery as any).mockResolvedValue(null);

      const params = {
        search: { dateRange: "month" },
        location: { pathname: "/dashboard" },
      };

      const result = await dashboardLoader(params);

      expect(result.stats).toBeNull();
    });
  });

  describe("Performance", () => {
    it("should use appropriate cache times for different data types", async () => {
      const params = {
        search: { dateRange: "month" },
        location: { pathname: "/dashboard" },
      };

      await dashboardLoader(params);

      // Verify different stale times are used
      expect(queryClient.fetchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ staleTime: 5 * 60 * 1000 }) // 5 minutes for stats
      );
    });

    it("should prefetch efficiently", async () => {
      const params = {
        search: { page: 1 },
        location: { pathname: "/bookings" },
      };

      await bookingsLoader(params);

      // Should prefetch but not block main loading
      expect(queryClient.prefetchQuery).toHaveBeenCalled();
    });
  });
});
