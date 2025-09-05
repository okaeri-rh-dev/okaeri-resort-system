// Dashboard State and Component Type Definitions
// Phase 2.1 - RED Phase: State management and UI types for Okaeri Resort dashboard

import {
  BookingMetrics,
  FinancialMetrics,
  PerformanceKPIs,
  AlertThresholds,
  MetricPeriod,
  DashboardConfig,
} from "./metrics";
import { DashboardActivity, ActivityFeedState, ActivityNotificationSettings } from "./activities";

/**
 * Main dashboard state combining all metrics and UI state
 */
export interface DashboardState {
  // Core metrics data
  metrics: {
    booking: BookingMetrics | null;
    financial: FinancialMetrics | null;
    performance: PerformanceKPIs | null;
    lastUpdate: Date | null;
  };

  // Activity feed state
  activities: ActivityFeedState;

  // UI state
  ui: DashboardUIState;

  // Real-time connection
  realtime: RealtimeState;

  // User preferences
  config: DashboardConfig | null;

  // Offline support
  offline: OfflineState;

  // Alerts and notifications
  alerts: AlertState;
}

/**
 * Dashboard UI state management
 */
export interface DashboardUIState {
  // Loading states
  isLoading: boolean;
  loadingComponents: Set<string>; // Component IDs currently loading

  // Error states
  error: DashboardError | null;
  componentErrors: Map<string, string>; // Component ID -> error message

  // Layout and visibility
  layout: {
    sidebarCollapsed: boolean;
    fullscreenMode: boolean;
    activeTab: DashboardTab;
    pinnedMetrics: string[];
    hiddenComponents: string[];
  };

  // Modal and overlay states
  modals: {
    quickBooking: boolean;
    expenseEntry: boolean;
    guestDetails: boolean;
    alertDetails: boolean;
    settingsPanel: boolean;
  };

  // Mobile-specific UI state
  mobile: {
    orientation: "portrait" | "landscape";
    keyboardVisible: boolean;
    pullToRefreshActive: boolean;
    swipeGestureActive: boolean;
  };

  // Performance monitoring
  performance: {
    renderTime: number; // Milliseconds
    memoryUsage: number; // MB
    frameDrops: number;
    lastOptimization: Date | null;
  };

  // Accessibility state
  accessibility: {
    highContrastMode: boolean;
    reduceAnimations: boolean;
    screenReaderActive: boolean;
    keyboardNavigation: boolean;
  };
}

/**
 * Dashboard tab navigation
 */
export type DashboardTab =
  | "overview"
  | "bookings"
  | "financial"
  | "operations"
  | "analytics"
  | "settings";

/**
 * Real-time connection and synchronization state
 */
export interface RealtimeState {
  // WebSocket connection
  connection: {
    status: "connected" | "connecting" | "disconnected" | "error";
    lastConnected: Date | null;
    reconnectAttempts: number;
    latency: number; // Milliseconds
  };

  // Event handling
  events: {
    queue: RealtimeEvent[];
    processing: boolean;
    lastProcessed: Date | null;
    failedEvents: RealtimeEvent[];
  };

  // Subscription management
  subscriptions: {
    metrics: boolean;
    activities: boolean;
    alerts: boolean;
    bookings: boolean;
  };

  // Polling fallback
  polling: {
    active: boolean;
    interval: number; // Seconds
    lastPoll: Date | null;
  };
}

/**
 * Real-time events from WebSocket
 */
export interface RealtimeEvent {
  readonly id: string;
  readonly type: RealtimeEventType;
  readonly projectId: string;
  readonly timestamp: Date;
  readonly data: unknown;
  readonly priority: "low" | "medium" | "high" | "critical";
}

export type RealtimeEventType =
  | "metric_update"
  | "booking_created"
  | "booking_updated"
  | "payment_received"
  | "activity_created"
  | "alert_triggered"
  | "system_status"
  | "user_action";

/**
 * Offline state and queue management
 */
export interface OfflineState {
  // Connection status
  isOnline: boolean;
  lastOnline: Date | null;
  offlineDuration: number; // Minutes

  // Offline queue
  queue: {
    actions: OfflineAction[];
    maxSize: number;
    currentSize: number;
    lastSync: Date | null;
  };

  // Cached data
  cache: {
    metrics: Map<string, unknown>;
    activities: DashboardActivity[];
    lastCacheUpdate: Date | null;
    cacheSize: number; // MB
  };

  // Sync status
  sync: {
    inProgress: boolean;
    lastAttempt: Date | null;
    successfulActions: number;
    failedActions: number;
  };
}

/**
 * Offline action queue item
 */
export interface OfflineAction {
  readonly id: string;
  readonly type: string;
  readonly payload: unknown;
  readonly timestamp: Date;
  readonly retryCount: number;
  readonly maxRetries: number;
}

/**
 * Alert and notification state
 */
export interface AlertState {
  // Active alerts
  active: DashboardAlert[];

  // Alert history
  history: DashboardAlert[];

  // Thresholds and rules
  thresholds: AlertThresholds;

  // Notification preferences
  notifications: ActivityNotificationSettings;

  // Unread counts
  unread: {
    critical: number;
    high: number;
    medium: number;
    total: number;
  };

  // Snooze management
  snoozed: {
    alertId: string;
    until: Date;
  }[];
}

/**
 * Dashboard alert with Philippine business context
 */
export interface DashboardAlert {
  readonly id: string;
  readonly type: AlertType;
  readonly severity: "info" | "warning" | "error" | "critical";
  readonly title: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly projectId: string;

  // Alert-specific data
  data: {
    metric?: string;
    currentValue?: number | string;
    threshold?: number | string;
    trend?: "up" | "down" | "stable";
    affectedItems?: string[];
  };

  // Actions and resolution
  actions: AlertAction[];
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;

  // Display properties
  color: "blue" | "yellow" | "red" | "gray";
  icon: string;
  persistent: boolean; // Stays until manually dismissed
  autoExpire?: Date; // Auto-dismiss time
}

/**
 * Alert types specific to resort operations
 */
export type AlertType =
  | "low_occupancy"
  | "high_occupancy"
  | "revenue_below_target"
  | "expense_over_budget"
  | "payment_overdue"
  | "maintenance_required"
  | "guest_complaint"
  | "system_error"
  | "compliance_due"
  | "weather_warning"
  | "staff_shortage"
  | "inventory_low";

/**
 * Alert actions that can be taken
 */
export interface AlertAction {
  readonly id: string;
  label: string;
  type: "dismiss" | "snooze" | "resolve" | "escalate" | "view_details";
  handler: string; // Function name or route
  destructive: boolean; // Requires confirmation
}

/**
 * Dashboard error types and handling
 */
export interface DashboardError {
  readonly id: string;
  readonly type: DashboardErrorType;
  readonly message: string;
  readonly timestamp: Date;
  readonly component?: string; // Component that caused the error
  readonly recoverable: boolean;
  readonly retryable: boolean;

  // Error context
  context: {
    userAction?: string;
    networkStatus: "online" | "offline" | "slow";
    memoryUsage: number; // MB
    componentStack?: string;
  };

  // Recovery options
  recovery: {
    autoRetry: boolean;
    retryCount: number;
    maxRetries: number;
    fallback?: string; // Fallback action
  };
}

export type DashboardErrorType =
  | "network_error"
  | "data_fetch_failed"
  | "component_crash"
  | "permission_denied"
  | "quota_exceeded"
  | "session_expired"
  | "validation_error"
  | "unknown_error";

/**
 * Dashboard component props interface
 */
export interface DashboardComponentProps {
  // Common props for all dashboard components
  loading?: boolean;
  error?: string | null;
  className?: string;
  testId?: string;

  // Responsive props
  mobile?: boolean;
  tablet?: boolean;
  desktop?: boolean;

  // Theme props
  theme?: "light" | "dark" | "auto";
  compact?: boolean;

  // Accessibility props
  ariaLabel?: string;
  role?: string;
}

/**
 * Metric card component props
 */
export interface MetricCardProps extends DashboardComponentProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    direction: "up" | "down" | "stable";
    percentage: number;
    period: string;
  };
  icon: string;
  color: "blue" | "green" | "yellow" | "red" | "gray";
  onClick?: () => void;
  loading?: boolean;
}

/**
 * Chart component configuration
 */
export interface ChartConfig {
  type: "line" | "bar" | "pie" | "area" | "gauge";
  responsive: boolean;
  animated: boolean;
  height: number;

  // Data configuration
  data: ChartDataPoint[];
  xAxis: ChartAxisConfig;
  yAxis: ChartAxisConfig;

  // Styling
  colors: string[];
  theme: "light" | "dark";

  // Accessibility
  altText: string;
  dataTable: boolean; // Provide data table for screen readers
}

/**
 * Chart data point interface
 */
export interface ChartDataPoint {
  x: string | number | Date;
  y: number;
  label?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Chart axis configuration
 */
export interface ChartAxisConfig {
  label: string;
  type: "category" | "value" | "time";
  format?: string; // For number/date formatting
  min?: number;
  max?: number;
  tickCount?: number;
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  // Grid system
  columns: number; // 12-column grid
  breakpoints: {
    mobile: number; // px
    tablet: number; // px
    desktop: number; // px
  };

  // Component arrangement
  widgets: DashboardWidget[];

  // Responsive behavior
  responsive: boolean;
  stackOnMobile: boolean;
}

/**
 * Dashboard widget configuration
 */
export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  position: {
    x: number; // Grid column
    y: number; // Grid row
    w: number; // Width in columns
    h: number; // Height in rows
  };
  props: Record<string, unknown>;
  visible: boolean;
  resizable: boolean;
  draggable: boolean;
}

export type DashboardWidgetType =
  | "metric_card"
  | "chart"
  | "activity_feed"
  | "quick_actions"
  | "guest_list"
  | "revenue_summary"
  | "weather_widget"
  | "compliance_tracker";

/**
 * Dashboard performance metrics for optimization
 */
export interface DashboardPerformanceMetrics {
  // Rendering performance
  firstContentfulPaint: number; // ms
  timeToInteractive: number; // ms
  cumulativeLayoutShift: number;

  // Runtime performance
  averageFrameRate: number; // fps
  memoryUsage: number; // MB
  renderTime: number; // ms per update

  // Network performance
  dataTransferred: number; // KB
  apiResponseTime: number; // ms
  websocketLatency: number; // ms

  // User experience
  interactionDelay: number; // ms
  scrollSmootness: number; // 0-100 score
  loadingStateTime: number; // ms
}
