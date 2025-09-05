/**
 * Offline-related type definitions for dashboard
 */

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
  priority?: number;
  persistent?: boolean;
}

export interface SyncStatus {
  success: boolean;
  error?: string;
  fallback?: string;
  data?: any;
}

export interface ConflictRecord {
  id: string;
  entityId: string;
  type: string;
  localValue: any;
  serverValue: any;
  resolution: string;
  resolvedBy: string;
  timestamp: number;
}

export interface OfflineConfig {
  processor?: (action: OfflineAction | OfflineAction[]) => Promise<any>;
  maxRetries?: number;
  retryDelay?: number;
  typhoonMode?: boolean;
  batchSize?: number;
  batchDelay?: number;
  conflictStrategy?: "client-wins" | "server-wins" | "three-way-merge" | "manual";
  locale?: string;
  timezone?: string;
  periodicSync?: boolean;
  syncInterval?: number;
  schemaVersion?: number;
  migrations?: Record<number, (data: any) => any>;
}

export interface OfflineState {
  isOfflineMode: boolean;
  queueSize: number;
  lastSync: Date | null;
  syncInProgress: boolean;
  conflicts: ConflictRecord[];
}
