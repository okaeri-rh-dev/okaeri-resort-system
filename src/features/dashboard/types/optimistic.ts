/**
 * Optimistic Updates Types - TypeScript definitions for React 19 useOptimistic patterns
 * Phase 2.1 - TDD GREEN: Minimal types to satisfy test requirements
 */

export interface OptimisticUpdate<T = any> {
  id: string;
  changes: T;
  timestamp?: number;
  metadata?: Record<string, any>;
  rollbackData?: any;
  merge?: boolean;
  deep?: boolean;
  partial?: boolean;
  dependsOn?: string[];
  immerUpdate?: boolean;
  actionName?: string;
  expectedVersion?: number;
  priority?: number;
  dedupeKey?: string;
  baseState?: any;
}

export interface ConflictResolution {
  type: "server-wins" | "client-wins" | "manual" | "three-way";
  reason?: string;
  conflictedFields?: string[];
}

export interface UpdateResolution {
  success: boolean;
  serverData?: any;
  conflict?: boolean;
  reason?: string;
  conflictedFields?: string[];
  baseState?: any;
}

export interface RollbackInfo {
  updateId: string;
  previousData: any;
  attemptedData: any;
  timestamp: number;
  rolledBackAt?: number;
}

export interface ConflictInfo {
  updateId: string;
  clientValue: any;
  serverValue: any;
  resolution: string;
  timestamp: number;
  type?: "three-way";
}

export interface ResolutionHints {
  conflictedFields: string[];
  suggestedActions: string[];
  userPrompt: string;
}

export interface OptimisticHookOptions<T> {
  initialData: T;
  syncWithStore?: boolean;
  onRollback?: (info: RollbackInfo) => void;
  conflictResolution?: "server-wins" | "client-wins";
  conflictResolver?: (local: any, server: any) => any;
  trackHistory?: boolean;
  trackConflicts?: boolean;
  enableSnapshots?: boolean;
  fieldLevelConflictResolution?: boolean;
  threeWayMerge?: boolean;
  autoRetryOnConflict?: boolean;
  maxRetries?: number;
  mutationFn?: (update: OptimisticUpdate<T>) => Promise<any>;
  optimisticLocking?: boolean;
  provideResolutionHints?: boolean;
  isOnline?: boolean;
  processUpdate?: (update: OptimisticUpdate<T>) => Promise<UpdateResolution>;
  persistQueue?: boolean;
  storageKey?: string;
  maxQueueSize?: number;
  onQueueFull?: () => void;
  deduplicateQueue?: boolean;
  priorityQueue?: boolean;
  batchProcess?: boolean;
  batchSize?: number;
  processBatch?: (updates: OptimisticUpdate<T>[]) => Promise<any>;
  queueTTL?: number;
  onUpdateExpired?: (id: string) => void;
  overflowStrategy?: "drop-oldest" | "drop-newest";
  persist?: boolean;
  persistKey?: string;
  devtools?: boolean;
  name?: string;
  immer?: boolean;
  asyncActions?: Record<string, () => Promise<any>>;
}

export interface OptimisticHookResult<T> {
  optimisticData: T;
  isPending: boolean;
  pendingUpdates: OptimisticUpdate<T>[];
  queuedUpdates: OptimisticUpdate<T>[];
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  rollbackHistory: RollbackInfo[];
  conflictHistory: ConflictInfo[];

  // Actions
  applyOptimisticUpdate: (update: OptimisticUpdate<T>) => void;
  rollbackUpdate: (id: string, options?: RollbackOptions) => void;
  rollbackAll: () => void;
  resolveUpdate: (id: string, resolution: UpdateResolution) => void;
  getResolutionHints: (id: string) => ResolutionHints;

  // Snapshots
  createSnapshot: (name: string) => void;
  restoreSnapshot: (name: string) => void;

  // Queue management
  processQueue: () => void;

  // Async actions
  asyncActions: Record<string, () => Promise<any>>;
}

export interface RollbackOptions {
  cascade?: boolean;
  fields?: string[];
}

// Store integration types
export interface OptimisticStoreData {
  data: any;
  pendingUpdates: OptimisticUpdate[];
  conflicts: ConflictInfo[];
  rollbackHistory: RollbackInfo[];
}

export interface OptimisticStoreActions {
  addUpdate: (update: OptimisticUpdate) => void;
  removeUpdate: (id: string) => void;
  clearUpdates: () => void;
  createSnapshot: (name: string) => void;
  restoreSnapshot: (name: string) => void;
  composeWith: (key: string, initialValue: any) => any;
  getSubscriptionCount: () => number;
  reset: () => void;
}
