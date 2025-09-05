/**
 * Polling-related type definitions for dashboard
 */

export interface PollingConfig {
  queryFn: (options?: any) => Promise<any>;
  interval?: number;
  baseInterval?: number;
  maxInterval?: number;
  enabled?: boolean;
  immediate?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
  onDataChange?: (data: any) => void;
  onCleanup?: () => void;
  onIntervalChange?: (interval: number) => void;
  adaptive?: boolean;
  networkAdaptive?: boolean;
  respectDataSaver?: boolean;
  compareHash?: boolean;
  useETag?: boolean;
  compareFunction?: (prev: any, next: any) => boolean;
  jitter?: boolean;
  websocketUrl?: string;
  fallbackEnabled?: boolean;
}

export interface PollingState {
  data: any;
  error: Error | null;
  isPolling: boolean;
  isPaused: boolean;
  currentInterval: number;
}

export interface NetworkInfo {
  effectiveType?: string;
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
}

export interface PollingMetrics {
  totalPolls: number;
  successfulPolls: number;
  failedPolls: number;
  averageResponseTime: number;
  dataChanges: number;
  lastPollTime: Date | null;
}
