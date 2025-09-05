/**
 * Dashboard Test Providers - Phase 2.1 TDD Utilities
 *
 * Comprehensive test wrapper component that provides all necessary providers
 * for dashboard testing. Includes QueryClient, Zustand stores, authentication
 * context, and WebSocket mocking for real-time features.
 *
 * This component follows the successful patterns from Phase 1 and provides
 * consistent test environment setup for all dashboard component tests.
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 2.1 - Dashboard TDD
 */

import React, { createContext, useContext, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";
import type {
  DashboardStats,
  ActivityLog,
  AuthState,
  User,
  ChartData,
  Booking,
  Expense,
} from "@/types/common";
import { MOCK_AUTH_STATES, MOCK_USERS } from "./test-utils";
import { MetricBuilders } from "./metric-test-builders";

/**
 * Dashboard Test Context
 * Provides access to mocked stores and utilities within tests
 */
interface DashboardTestContextValue {
  // Mock store functions
  updateDashboardStats: (stats: Partial<DashboardStats>) => void;
  addActivity: (activity: ActivityLog) => void;
  triggerRealTimeUpdate: (data: any) => void;
  simulateError: (component: string, error: string) => void;
  clearError: (component: string) => void;

  // Mock WebSocket instance
  mockWebSocket: {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    readyState: number;
  };

  // Current test data
  currentStats: DashboardStats;
  currentActivities: ActivityLog[];
  currentUser: User | null;
}

const DashboardTestContext = createContext<DashboardTestContextValue | null>(null);

/**
 * Hook to access dashboard test utilities
 */
export const useDashboardTestContext = (): DashboardTestContextValue => {
  const context = useContext(DashboardTestContext);
  if (!context) {
    throw new Error("useDashboardTestContext must be used within DashboardTestProvider");
  }
  return context;
};

/**
 * Dashboard Test Provider Props
 */
interface DashboardTestProviderProps {
  children: ReactNode;

  // Initial data
  initialStats?: Partial<DashboardStats>;
  initialActivities?: ActivityLog[];
  authState?: Partial<AuthState>;

  // Feature flags
  enableRealTime?: boolean;
  enableOfflineMode?: boolean;
  simulateSlowNetwork?: boolean;

  // Error scenarios
  initialErrors?: Record<string, string>;

  // Performance settings
  queryDelay?: number;
  mutationDelay?: number;
}

/**
 * Dashboard Test Provider Component
 * Wraps dashboard components with all necessary providers and mocks
 */
export const DashboardTestProvider: React.FC<DashboardTestProviderProps> = ({
  children,
  initialStats = {},
  initialActivities = [],
  authState = {},
  enableRealTime = false,
  enableOfflineMode = false,
  simulateSlowNetwork = false,
  initialErrors = {},
  queryDelay = 0,
  mutationDelay = 0,
}) => {
  // Create test query client with appropriate settings
  const queryClient = createTestQueryClient({
    simulateSlowNetwork,
    queryDelay,
    mutationDelay,
  });

  // Generate default dashboard stats if not provided
  const defaultStats = MetricBuilders.dashboardStats().build();
  const currentStats = { ...defaultStats, ...initialStats };

  // Generate default activities if not provided
  const currentActivities =
    initialActivities.length > 0
      ? initialActivities
      : MetricBuilders.dashboardStats().build().totalBookings > 0
        ? generateDefaultActivities(5)
        : [];

  // Setup auth state
  const currentAuthState = {
    ...MOCK_AUTH_STATES.LOGGED_IN_OWNER,
    ...authState,
  };

  // Create mock WebSocket if real-time is enabled
  const mockWebSocket = createMockWebSocket(enableRealTime);

  // Setup store mocks
  setupDashboardStoreMocks(currentStats, currentActivities, initialErrors);
  setupAuthStoreMock(currentAuthState);

  // Create test context value
  const testContextValue = createTestContextValue(
    mockWebSocket,
    currentStats,
    currentActivities,
    currentAuthState.user
  );

  return (
    <DashboardTestContext.Provider value={testContextValue}>
      <QueryClientProvider client={queryClient}>
        <div data-testid="dashboard-test-root">{children}</div>
      </QueryClientProvider>
    </DashboardTestContext.Provider>
  );
};

/**
 * Create test query client with dashboard-specific configuration
 */
function createTestQueryClient(options: {
  simulateSlowNetwork?: boolean;
  queryDelay?: number;
  mutationDelay?: number;
}) {
  const { simulateSlowNetwork, queryDelay, mutationDelay } = options;

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: simulateSlowNetwork ? 0 : 5 * 60 * 1000, // 5 minutes
        networkMode: "offlineFirst", // Support offline testing
        queryFn: async (context) => {
          // Add artificial delay if specified
          if (queryDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, queryDelay));
          }

          // Simulate network failures for testing
          if (simulateSlowNetwork && Math.random() < 0.1) {
            // 10% failure rate
            throw new Error("Network timeout");
          }

          // Return mock data based on query key
          return getMockDataForQuery(context.queryKey);
        },
      },
      mutations: {
        retry: false,
        networkMode: "offlineFirst",
        mutationFn: async (data) => {
          if (mutationDelay > 0) {
            await new Promise((resolve) => setTimeout(resolve, mutationDelay));
          }

          return { success: true, data };
        },
      },
    },
    logger: {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });
}

/**
 * Create mock WebSocket for real-time features
 */
function createMockWebSocket(enabled: boolean) {
  if (!enabled) {
    return {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      readyState: 3, // CLOSED
    };
  }

  const mockWebSocket = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: 1, // OPEN
  };

  // Mock global WebSocket constructor
  global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket);

  return mockWebSocket;
}

/**
 * Setup dashboard store mocks
 */
function setupDashboardStoreMocks(
  stats: DashboardStats,
  activities: ActivityLog[],
  errors: Record<string, string>
) {
  // Mock dashboard store
  vi.doMock("@/stores/dashboardStore", () => ({
    useDashboardStore: vi.fn(() => ({
      // State
      stats,
      activities,
      isLoading: false,
      error: errors.dashboard || null,

      // Actions
      fetchStats: vi.fn().mockResolvedValue(stats),
      fetchActivities: vi.fn().mockResolvedValue(activities),
      refreshDashboard: vi.fn(),
      clearError: vi.fn(),

      // Real-time
      subscribeToUpdates: vi.fn(),
      unsubscribeFromUpdates: vi.fn(),
    })),

    // Selector hooks
    useDashboardStats: vi.fn(() => stats),
    useDashboardActivities: vi.fn(() => activities),
    useDashboardLoading: vi.fn(() => false),
    useDashboardError: vi.fn(() => errors.dashboard || null),
  }));

  // Mock booking store
  vi.doMock("@/stores/bookingStore", () => ({
    useBookingStore: vi.fn(() => ({
      bookings: [],
      upcomingCheckIns: stats.upcomingCheckIns || 0,
      upcomingCheckOuts: stats.upcomingCheckOuts || 0,
      isLoading: false,
      error: errors.bookings || null,
      fetchBookings: vi.fn(),
      fetchUpcoming: vi.fn(),
    })),
  }));

  // Mock expense store
  vi.doMock("@/stores/expenseStore", () => ({
    useExpenseStore: vi.fn(() => ({
      expenses: [],
      totalExpenses: stats.totalExpenses || 0,
      isLoading: false,
      error: errors.expenses || null,
      fetchExpenses: vi.fn(),
      fetchSummary: vi.fn(),
    })),
  }));
}

/**
 * Setup auth store mock
 */
function setupAuthStoreMock(authState: AuthState) {
  vi.doMock("@/stores/authStore", () => ({
    useAuthStore: vi.fn(() => ({
      ...authState,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn(),
      hasPermission: vi.fn(() => true), // Allow all permissions in tests
      hasRole: vi.fn(() => true),
    })),

    // Selector hooks
    useUser: vi.fn(() => authState.user),
    useIsAuthenticated: vi.fn(() => authState.isAuthenticated),
    useAuthLoading: vi.fn(() => authState.isLoading),
    useAuthError: vi.fn(() => authState.error),
  }));
}

/**
 * Create test context value with utility functions
 */
function createTestContextValue(
  mockWebSocket: any,
  initialStats: DashboardStats,
  initialActivities: ActivityLog[],
  user: User | null
): DashboardTestContextValue {
  return {
    // Mock store update functions
    updateDashboardStats: (newStats: Partial<DashboardStats>) => {
      // Update the mocked store state
      const currentMock = vi.mocked(require("@/stores/dashboardStore").useDashboardStore);
      currentMock.mockReturnValueOnce({
        ...currentMock(),
        stats: { ...initialStats, ...newStats },
      });
    },

    addActivity: (activity: ActivityLog) => {
      const currentMock = vi.mocked(require("@/stores/dashboardStore").useDashboardStore);
      currentMock.mockReturnValueOnce({
        ...currentMock(),
        activities: [activity, ...initialActivities],
      });
    },

    triggerRealTimeUpdate: (data: any) => {
      if (mockWebSocket.addEventListener.mock.calls.length > 0) {
        // Find the message event listener
        const messageListeners = mockWebSocket.addEventListener.mock.calls
          .filter(([event]: any) => event === "message")
          .map(([, handler]: any) => handler);

        // Trigger all message listeners
        messageListeners.forEach((handler: any) => {
          handler({
            data: JSON.stringify({
              type: "dashboard_update",
              payload: data,
            }),
          });
        });
      }
    },

    simulateError: (component: string, error: string) => {
      const storeName = `${component}Store`;
      if (vi.isMockFunction(require(`@/stores/${storeName}`).useDashboardStore)) {
        const currentMock = vi.mocked(require(`@/stores/${storeName}`).useDashboardStore);
        currentMock.mockReturnValueOnce({
          ...currentMock(),
          error,
          isLoading: false,
        });
      }
    },

    clearError: (component: string) => {
      const storeName = `${component}Store`;
      if (vi.isMockFunction(require(`@/stores/${storeName}`).useDashboardStore)) {
        const currentMock = vi.mocked(require(`@/stores/${storeName}`).useDashboardStore);
        currentMock.mockReturnValueOnce({
          ...currentMock(),
          error: null,
        });
      }
    },

    // Mock WebSocket instance
    mockWebSocket,

    // Current data
    currentStats: initialStats,
    currentActivities: initialActivities,
    currentUser: user,
  };
}

/**
 * Get mock data based on TanStack Query key
 */
function getMockDataForQuery(queryKey: unknown[]): any {
  const [resource, ...params] = queryKey as string[];

  switch (resource) {
    case "dashboard-stats":
      return MetricBuilders.dashboardStats().build();

    case "dashboard-activities":
      return generateDefaultActivities(10);

    case "bookings":
      return MetricBuilders.bookings().withCount(20).build();

    case "expenses":
      return MetricBuilders.expenses().withCount(15).build();

    case "chart-data":
      const [chartType] = params;
      return MetricBuilders.chartData()
        .withType(chartType as any)
        .withSeasonalPattern()
        .build();

    default:
      return null;
  }
}

/**
 * Generate default activities for testing
 */
function generateDefaultActivities(count: number): ActivityLog[] {
  const activities: ActivityLog[] = [];
  const actions = ["created", "updated", "cancelled", "checked_in", "checked_out"];
  const resources = ["booking", "expense", "property", "user"];

  for (let i = 0; i < count; i++) {
    activities.push({
      id: `activity-${i + 1}`,
      userId: `user-${(i % 3) + 1}`,
      projectId: "test-project",
      action: actions[i % actions.length],
      resource: resources[i % resources.length],
      resourceId: `resource-${i + 1}`,
      details: {
        amount: 2500,
        guestName: "Test Guest",
        propertyName: "Test Villa",
      },
      createdAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      user: {
        id: `user-${(i % 3) + 1}`,
        name: ["Juan Santos", "Maria Cruz", "Pedro Reyes"][i % 3],
        email: `user${(i % 3) + 1}@okaeriresort.ph`,
        role: "STAFF" as any,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  return activities;
}

/**
 * Specialized providers for different test scenarios
 */
export const DashboardTestProviders = {
  /**
   * Provider for testing loading states
   */
  Loading: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      initialErrors={{ dashboard: "loading" }}
      queryDelay={1000}
      mutationDelay={500}
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing error states
   */
  WithErrors: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      initialErrors={{
        dashboard: "Failed to load dashboard data",
        bookings: "Failed to load bookings",
        expenses: "Failed to load expenses",
      }}
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing real-time updates
   */
  RealTime: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      enableRealTime={true}
      initialStats={MetricBuilders.dashboardStats().withHighPerformance().build()}
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing offline functionality
   */
  Offline: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider enableOfflineMode={true} simulateSlowNetwork={true} queryDelay={2000}>
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing peak season scenario
   */
  PeakSeason: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      initialStats={MetricBuilders.dashboardStats().withSeason("peak").build()}
      initialActivities={generateDefaultActivities(20)} // More activities in peak season
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing off-season scenario
   */
  OffSeason: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      initialStats={MetricBuilders.dashboardStats().withSeason("off").build()}
      initialActivities={generateDefaultActivities(3)} // Fewer activities in off season
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing typhoon season impact
   */
  TyphoonSeason: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      initialStats={MetricBuilders.dashboardStats().withTyphoonImpact().build()}
      initialActivities={generateDefaultActivities(5)}
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing edge cases (zero data, extreme values)
   */
  EdgeCases: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider
      initialStats={MetricBuilders.edgeCases().zeroRevenue}
      initialActivities={[]}
    >
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing unauthorized access
   */
  Unauthorized: ({ children }: { children: ReactNode }) => (
    <DashboardTestProvider authState={MOCK_AUTH_STATES.LOGGED_OUT}>
      {children}
    </DashboardTestProvider>
  ),

  /**
   * Provider for testing different user roles
   */
  WithRole: ({ children, role }: { children: ReactNode; role: "OWNER" | "MANAGER" | "STAFF" }) => (
    <DashboardTestProvider
      authState={{
        user: MOCK_USERS[role],
        isAuthenticated: true,
        isLoading: false,
        error: null,
        token: "mock-token",
        refreshToken: "mock-refresh-token",
        sessionExpiry: Date.now() + 3600000,
      }}
    >
      {children}
    </DashboardTestProvider>
  ),
};

/**
 * Utility function to render dashboard components with test provider
 */
export function renderDashboardWithProvider(
  ui: React.ReactElement,
  providerProps?: Partial<DashboardTestProviderProps>
) {
  const { render } = require("@testing-library/react");

  return render(<DashboardTestProvider {...providerProps}>{ui}</DashboardTestProvider>);
}

// Export provider and utilities
export default DashboardTestProvider;
