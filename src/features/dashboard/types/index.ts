// Phase 2 Dashboard Types
// Phase 2.1 - RED Phase: Complete type exports for Okaeri Resort dashboard

// Metric types
export type {
  // Core metrics
  BaseMetric,
  BookingMetrics,
  FinancialMetrics,
  PerformanceKPIs,

  // Guest and booking data
  GuestArrival,
  GuestDeparture,
  GuestFeedback,

  // Financial types
  PhilippineCurrency,
  ExpenseCategory,
  PaymentMethod,

  // Configuration and thresholds
  AlertThresholds,
  MetricPeriod,
  DashboardConfig,
} from "./metrics";

// Activity types
export type {
  // Base activity
  BaseActivity,
  ActivityCategory,

  // Specific activity types
  BookingActivity,
  FinancialActivity,
  OperationalActivity,
  GuestServiceActivity,
  SystemActivity,
  ComplianceActivity,
  EmergencyActivity,

  // Union and utility types
  DashboardActivity,
  ActivityEvent,
  ActivityMetrics,
  ActivitySearchParams,

  // State and configuration
  ActivityFeedConfig,
  ActivityFeedState,
  ActivityNotificationSettings,
} from "./activities";

// Dashboard state and UI types
export type {
  // Main state interfaces
  DashboardState,
  DashboardUIState,
  DashboardTab,

  // Real-time and connectivity
  RealtimeState,
  RealtimeEvent,
  RealtimeEventType,

  // Offline and synchronization
  OfflineState,
  OfflineAction,

  // Alerts and notifications
  AlertState,
  DashboardAlert,
  AlertType,
  AlertAction,

  // Error handling
  DashboardError,
  DashboardErrorType,

  // Component interfaces
  DashboardComponentProps,
  MetricCardProps,

  // Chart configuration
  ChartConfig,
  ChartDataPoint,
  ChartAxisConfig,

  // Layout and widgets
  DashboardLayout,
  DashboardWidget,
  DashboardWidgetType,

  // Performance monitoring
  DashboardPerformanceMetrics,
} from "./dashboard";

// Type guards for runtime type checking
export const isBookingActivity = (activity: DashboardActivity): activity is BookingActivity => {
  return activity.category === "booking";
};

export const isFinancialActivity = (activity: DashboardActivity): activity is FinancialActivity => {
  return activity.category === "financial";
};

export const isEmergencyActivity = (activity: DashboardActivity): activity is EmergencyActivity => {
  return activity.category === "emergency";
};

export const isCriticalAlert = (alert: DashboardAlert): boolean => {
  return alert.severity === "critical";
};

export const isPhilippineCurrency = (value: unknown): value is PhilippineCurrency => {
  return (
    typeof value === "object" &&
    value !== null &&
    "amount" in value &&
    "currency" in value &&
    (value as PhilippineCurrency).currency === "PHP"
  );
};

// Utility type for dashboard component test props
export type DashboardTestProps<T = {}> = T & {
  testId?: string;
  "data-testid"?: string;
};

// Common dashboard constants
export const DASHBOARD_CONSTANTS = {
  // Refresh intervals (milliseconds)
  REFRESH_INTERVALS: {
    REALTIME: 1000, // 1 second for critical metrics
    FAST: 5000, // 5 seconds for dynamic data
    MEDIUM: 30000, // 30 seconds for stable data
    SLOW: 300000, // 5 minutes for historical data
  },

  // Philippine business settings
  PHILIPPINE: {
    CURRENCY: "PHP" as const,
    TIMEZONE: "Asia/Manila",
    VAT_RATE: 0.12,
    LOCALE: "en-PH",
    PHONE_FORMAT: "+63",
  },

  // Performance thresholds
  PERFORMANCE: {
    MAX_RENDER_TIME: 16, // ms for 60fps
    MAX_MEMORY_USAGE: 100, // MB
    MAX_BUNDLE_SIZE: 200, // KB
    MIN_LIGHTHOUSE_SCORE: 90,
  },

  // Grid and layout
  LAYOUT: {
    GRID_COLUMNS: 12,
    BREAKPOINTS: {
      MOBILE: 640, // px
      TABLET: 1024, // px
      DESKTOP: 1280, // px
    },
  },
} as const;
