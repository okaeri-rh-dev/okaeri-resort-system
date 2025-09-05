/**
 * Dashboard type definitions for Zustand stores
 */

export interface DashboardMetrics {
  occupancyRate: number | null;
  totalRevenue: number | null;
  revenueGrowth: number | null;
  activeBookings: number | null;
  averageDailyRate: number | null;
  revPAR: number | null;
  customerSatisfaction: number | null;
  repeatGuestRate: number | null;
  lastUpdated: string | null;
  checkInsToday?: number | null;
  [key: string]: any;
}

export interface MetricUpdate {
  id: string;
  type: string;
  previousValue: number;
  newValue: number;
  timestamp: number;
}

export interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: number;
  priority?: string;
}

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  priority?: number;
}

export interface WebSocketState {
  status: "connected" | "connecting" | "disconnected" | "error";
  connection: WebSocket | null;
  reconnectAttempts: number;
  reconnectDelay: number;
  lastConnected: Date | null;
}

export interface DashboardState {
  metrics: DashboardMetrics;
  isLoading: boolean;
  error: string | null;
  isOfflineMode: boolean;
  offlineQueue: OfflineAction[];
  realtimeEvents: RealtimeEvent[];
  optimisticUpdates: MetricUpdate[];
  wsConnection: WebSocket | null;
  wsState: "connected" | "connecting" | "disconnected" | "polling";
  currentProjectId: string | null;
}

export interface RealtimeState {
  ws: WebSocketState;
  lastUpdate: Date | null;
  metrics?: any;
  bookings?: any[];
}

export interface OptimisticUpdate {
  id: string;
  changes: any;
}

export interface DashboardStore extends DashboardState {
  // Actions
  fetchDashboardMetrics: (projectId: string) => Promise<void>;
  updateMetricOptimistically: (key: string, value: number, update: MetricUpdate) => void;
  rollbackOptimisticUpdate: (updateId: string) => void;
  subscribeToRealTimeUpdates: () => Promise<void>;
  handleRealtimeEvent: (event: RealtimeEvent) => void;
  queueOfflineAction: (action: OfflineAction) => void;
  processOfflineQueue: () => Promise<void>;
  switchProject: (projectId: string) => void;
  cleanup: () => void;
  reset: () => void;
  getComputedMetrics: () => any;
  syncWithQueryCache: (queryClient: any) => void;
  initCrossTabSync: () => void;
  handleCrossTabMessage: (event: MessageEvent) => void;
  handleLogout: () => void;
  setCachedMetrics: (projectId: string, metrics: any) => void;
  getCachedMetrics: (projectId: string) => any;
  getFormattedMetrics: () => any;
  updateSeasonalMetrics: (data: any) => void;
  calculateTaxMetrics: () => any;
  updatePaymentMethodMetrics: (data: any) => void;
  getPaymentMethodStats: () => any;
  analyzeHolidayPatterns: (patterns: any[]) => void;
  updateVisitorRegionMetrics: (data: any) => void;
  getVisitorAnalysis: () => any;
  applySeasonalPricing: (season: string, baseRate: number) => void;
  cleanupExpiredQueueItems: () => void;
}
