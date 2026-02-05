/**
 * Workflow Store - Zustand Store for Serverless Workflow Management
 *
 * Manages workflow state, automated triggers, business rules, and execution history
 * with optimistic updates and real-time synchronization capabilities.
 *
 * Integrates with the serverless workflow engine and API routes for
 * comprehensive workflow state management in the Okaeri Resort System.
 *
 * @module WorkflowStore
 */

import React from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { AutomatedTrigger, BookingStatus, WorkflowEvent } from "@/types";
import type {
  ResortWorkflowConfig,
  ScheduledTask,
  WorkflowCostUsage,
  WorkflowResult,
  WorkflowState,
} from "@/workflow/engine";

// ============================================
// WORKFLOW STORE TYPES
// ============================================

interface WorkflowStore {
  // Workflow execution state
  activeExecutions: Map<string, WorkflowExecution>;
  executionHistory: WorkflowEvent[];
  scheduledTasks: ScheduledTask[];

  // Workflow configuration
  workflowConfig: ResortWorkflowConfig | null;
  customWorkflows: CustomWorkflowDefinition[];

  // UI state
  selectedWorkflowExecution: string | null;
  workflowFilters: WorkflowFilters;
  showAdvancedOptions: boolean;

  // Cost monitoring
  dailyCostUsage: number;
  monthlyCostUsage: number;
  costAlerts: CostAlert[];

  // Performance metrics
  executionMetrics: WorkflowMetrics;

  // Actions
  setActiveExecution: (executionId: string, execution: WorkflowExecution) => void;
  removeActiveExecution: (executionId: string) => void;
  addExecutionHistory: (event: WorkflowEvent) => void;
  setWorkflowConfig: (config: ResortWorkflowConfig) => void;
  setWorkflowFilters: (filters: WorkflowFilters) => void;
  setSelectedWorkflowExecution: (executionId: string | null) => void;
  toggleAdvancedOptions: () => void;
  addCostUsage: (usage: WorkflowCostUsage) => void;
  addCostAlert: (alert: CostAlert) => void;
  dismissCostAlert: (alertId: string) => void;
  updateExecutionMetrics: (metrics: Partial<WorkflowMetrics>) => void;
  clearExecutionHistory: () => void;

  // Optimistic updates
  optimisticWorkflowStates: Map<string, WorkflowState>;
  addOptimisticWorkflowState: (bookingId: string, state: WorkflowState) => void;
  updateOptimisticWorkflowState: (bookingId: string, updates: Partial<WorkflowState>) => void;
  removeOptimisticWorkflowState: (bookingId: string) => void;
}

interface WorkflowExecution {
  executionId: string;
  bookingId: string;
  startTime: Date;
  status: "running" | "completed" | "failed" | "cancelled";
  currentStep: string;
  progress: number; // 0-100
  result?: WorkflowResult;
  error?: string;
}

interface WorkflowFilters {
  status?: ("running" | "completed" | "failed" | "cancelled")[];
  dateFrom?: string;
  dateTo?: string;
  triggerType?: ("user" | "system" | "automation")[];
  bookingStatus?: BookingStatus[];
  showOnlyErrors?: boolean;
}

interface CostAlert {
  alertId: string;
  type: "daily_threshold" | "monthly_threshold" | "execution_limit";
  severity: "info" | "warning" | "critical";
  message: string;
  currentValue: number;
  threshold: number;
  timestamp: Date;
  dismissed: boolean;
}

interface WorkflowMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  totalCostSpent: number;
  automatedTransitions: number;
  manualTransitions: number;
}

interface WorkflowCondition {
  type: string;
  field?: string;
  operator?: string;
  value?: unknown;
}

interface WorkflowAction {
  type: string;
  target?: string;
  params?: Record<string, unknown>;
}

interface RetryConfig {
  maxRetries?: number;
  backoffMs?: number;
  retryConditions?: string[];
}

interface CustomWorkflowDefinition {
  workflowId: string;
  name: string;
  description: string;
  isActive: boolean;
  triggerConditions: WorkflowCondition[];
  actions: WorkflowAction[];
  executionCount: number;
  lastExecuted?: Date;
}

// ============================================
// ZUSTAND STORE IMPLEMENTATION
// ============================================

export const useWorkflowStore = create<WorkflowStore>()(
  devtools(
    persist(
      (set, _get) => ({
        // Initial state
        activeExecutions: new Map(),
        executionHistory: [],
        scheduledTasks: [],
        workflowConfig: null,
        customWorkflows: [],
        selectedWorkflowExecution: null,
        workflowFilters: {},
        showAdvancedOptions: false,
        dailyCostUsage: 0,
        monthlyCostUsage: 0,
        costAlerts: [],
        executionMetrics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          averageExecutionTime: 0,
          totalCostSpent: 0,
          automatedTransitions: 0,
          manualTransitions: 0,
        },
        optimisticWorkflowStates: new Map(),

        // Actions
        setActiveExecution: (executionId, execution) =>
          set((state) => {
            const newMap = new Map(state.activeExecutions);
            newMap.set(executionId, execution);
            return { activeExecutions: newMap };
          }),

        removeActiveExecution: (executionId) =>
          set((state) => {
            const newMap = new Map(state.activeExecutions);
            newMap.delete(executionId);
            return { activeExecutions: newMap };
          }),

        addExecutionHistory: (event) =>
          set((state) => ({
            executionHistory: [event, ...state.executionHistory].slice(0, 1000), // Keep last 1000 events
          })),

        setWorkflowConfig: (config) => set({ workflowConfig: config }),

        setWorkflowFilters: (filters) => set({ workflowFilters: filters }),

        setSelectedWorkflowExecution: (executionId) =>
          set({ selectedWorkflowExecution: executionId }),

        toggleAdvancedOptions: () =>
          set((state) => ({ showAdvancedOptions: !state.showAdvancedOptions })),

        addCostUsage: (usage) =>
          set((state) => {
            // Date tracking for future cost aggregation features
            const _today = new Date().toDateString();
            const _currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

            return {
              dailyCostUsage: state.dailyCostUsage + usage.actualCostUSD,
              monthlyCostUsage: state.monthlyCostUsage + usage.actualCostUSD,
            };
          }),

        addCostAlert: (alert) =>
          set((state) => ({
            costAlerts: [alert, ...state.costAlerts],
          })),

        dismissCostAlert: (alertId) =>
          set((state) => ({
            costAlerts: state.costAlerts.map((alert) =>
              alert.alertId === alertId ? { ...alert, dismissed: true } : alert
            ),
          })),

        updateExecutionMetrics: (metrics) =>
          set((state) => ({
            executionMetrics: { ...state.executionMetrics, ...metrics },
          })),

        clearExecutionHistory: () => set({ executionHistory: [] }),

        addOptimisticWorkflowState: (bookingId, state) =>
          set((currentState) => {
            const newMap = new Map(currentState.optimisticWorkflowStates);
            newMap.set(bookingId, state);
            return { optimisticWorkflowStates: newMap };
          }),

        updateOptimisticWorkflowState: (bookingId, updates) =>
          set((currentState) => {
            const newMap = new Map(currentState.optimisticWorkflowStates);
            const existing = newMap.get(bookingId);
            if (existing) {
              newMap.set(bookingId, { ...existing, ...updates });
            }
            return { optimisticWorkflowStates: newMap };
          }),

        removeOptimisticWorkflowState: (bookingId) =>
          set((state) => {
            const newMap = new Map(state.optimisticWorkflowStates);
            newMap.delete(bookingId);
            return { optimisticWorkflowStates: newMap };
          }),
      }),
      {
        name: "workflow-storage",
        storage: {
          getItem: (name) => {
            const value = localStorage.getItem(name);
            if (!value) return null;

            const parsed = JSON.parse(value);

            // Convert Maps back from JSON
            if (parsed.state?.activeExecutions) {
              parsed.state.activeExecutions = new Map(parsed.state.activeExecutions);
            }
            if (parsed.state?.optimisticWorkflowStates) {
              parsed.state.optimisticWorkflowStates = new Map(
                parsed.state.optimisticWorkflowStates
              );
            }

            return parsed;
          },
          setItem: (name, value) => {
            const toStore = {
              ...value,
              state: {
                ...value.state,
                // Convert Maps to JSON-serializable format
                activeExecutions: Array.from(value.state.activeExecutions.entries()),
                optimisticWorkflowStates: Array.from(
                  value.state.optimisticWorkflowStates.entries()
                ),
              },
            };
            localStorage.setItem(name, JSON.stringify(toStore));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
        partialize: (state) =>
          ({
            workflowConfig: state.workflowConfig,
            workflowFilters: state.workflowFilters,
            showAdvancedOptions: state.showAdvancedOptions,
            executionMetrics: state.executionMetrics,
            customWorkflows: state.customWorkflows,
          }) as WorkflowStore,
      }
    ),
    {
      name: "WorkflowStore",
    }
  )
);

// ============================================
// REACT QUERY HOOKS FOR WORKFLOW OPERATIONS
// ============================================

/**
 * Execute workflow transition with real-time updates
 */
export const useExecuteWorkflowTransition = () => {
  const queryClient = useQueryClient();
  const {
    setActiveExecution,
    removeActiveExecution,
    addExecutionHistory,
    addCostUsage,
    updateExecutionMetrics,
    addOptimisticWorkflowState: _addOptimisticWorkflowState,
    removeOptimisticWorkflowState: _removeOptimisticWorkflowState,
  } = useWorkflowStore();

  return useMutation({
    mutationFn: async ({
      bookingId,
      fromStatus,
      toStatus,
      resortId,
      triggeredBy = "user",
      metadata = {},
      dryRun = false,
    }: {
      bookingId: string;
      fromStatus: BookingStatus;
      toStatus: BookingStatus;
      resortId: string;
      triggeredBy?: "user" | "system" | "automation";
      metadata?: Record<string, unknown>;
      dryRun?: boolean;
    }) => {
      const response = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          fromStatus,
          toStatus,
          resortId,
          triggeredBy,
          metadata,
          dryRun,
        }),
      });

      if (!response.ok) {
        throw new Error(`Workflow execution failed: ${response.statusText}`);
      }

      return response.json();
    },
    onMutate: async (variables) => {
      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      // Add optimistic execution state
      const execution: WorkflowExecution = {
        executionId,
        bookingId: variables.bookingId,
        startTime: new Date(),
        status: "running",
        currentStep: "validating_transition",
        progress: 25,
      };

      setActiveExecution(executionId, execution);

      return { executionId };
    },
    onSuccess: (data, variables, context) => {
      const { workflowResult, executionId: _executionId } = data;

      // Update execution state
      if (context?.executionId) {
        const execution: WorkflowExecution = {
          executionId: context.executionId,
          bookingId: variables.bookingId,
          startTime: new Date(),
          status: workflowResult.success ? "completed" : "failed",
          currentStep: "completed",
          progress: 100,
          result: workflowResult,
        };

        setActiveExecution(context.executionId, execution);

        // Remove after delay to show completion
        setTimeout(() => {
          removeActiveExecution(context.executionId);
        }, 3000);
      }

      // Add to execution history
      if (workflowResult.workflowEvent) {
        addExecutionHistory(workflowResult.workflowEvent);
      }

      // Track cost usage
      if (workflowResult.costUsage) {
        addCostUsage(workflowResult.costUsage);
      }

      // Update metrics
      updateExecutionMetrics({
        totalExecutions: 1,
        successfulExecutions: workflowResult.success ? 1 : 0,
        failedExecutions: workflowResult.success ? 0 : 1,
        totalCostSpent: workflowResult.costUsage?.actualCostUSD || 0,
        manualTransitions: variables.triggeredBy === "user" ? 1 : 0,
        automatedTransitions: variables.triggeredBy !== "user" ? 1 : 0,
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-status"] });
    },
    onError: (error, variables, context) => {
      if (context?.executionId) {
        const execution: WorkflowExecution = {
          executionId: context.executionId,
          bookingId: variables.bookingId,
          startTime: new Date(),
          status: "failed",
          currentStep: "error",
          progress: 0,
          error: error instanceof Error ? error.message : "Unknown error",
        };

        setActiveExecution(context.executionId, execution);

        // Remove after delay to show error
        setTimeout(() => {
          removeActiveExecution(context.executionId);
        }, 5000);
      }

      // Update error metrics
      updateExecutionMetrics({
        totalExecutions: 1,
        failedExecutions: 1,
      });
    },
  });
};

/**
 * Get workflow state for a booking
 */
export const useWorkflowState = (bookingId: string, resortId: string) => {
  const optimisticStates = useWorkflowStore((state) => state.optimisticWorkflowStates);

  return useQuery({
    queryKey: ["workflow-status", bookingId, resortId],
    queryFn: async () => {
      const response = await fetch(
        `/api/workflows/status?bookingId=${bookingId}&resortId=${resortId}&includePredictions=true&includeCostEstimate=true`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow state: ${response.statusText}`);
      }

      const data = await response.json();
      return data.workflowState as WorkflowState;
    },
    enabled: !!bookingId && !!resortId,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
    select: (data) => {
      // Merge with optimistic updates
      const optimisticState = optimisticStates.get(bookingId);
      return optimisticState ? { ...data, ...optimisticState } : data;
    },
  });
};

/**
 * Get workflow summary for dashboard
 */
export const useWorkflowSummary = (resortId: string) => {
  return useQuery({
    queryKey: ["workflow-summary", resortId],
    queryFn: async () => {
      const response = await fetch(
        `/api/workflows/status?resortId=${resortId}&includeCostEstimate=true`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow summary: ${response.statusText}`);
      }

      const data = await response.json();
      return data.summary;
    },
    enabled: !!resortId,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
};

/**
 * Schedule automated workflow task
 */
export const useScheduleWorkflowTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      bookingId,
      resortId,
      trigger,
      taskType,
      scheduledTime,
      retryConfig,
      metadata = {},
    }: {
      bookingId: string;
      resortId: string;
      trigger: AutomatedTrigger;
      taskType: "status_transition" | "notification" | "reminder" | "validation";
      scheduledTime?: string;
      retryConfig?: RetryConfig;
      metadata?: Record<string, unknown>;
    }) => {
      const response = await fetch("/api/workflows/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          resortId,
          trigger,
          taskType,
          scheduledTime,
          retryConfig,
          metadata,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to schedule task: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-summary"] });
    },
  });
};

/**
 * Process batch workflows manually
 */
export const useProcessBatchWorkflows = () => {
  const queryClient = useQueryClient();
  const { addCostUsage, updateExecutionMetrics } = useWorkflowStore();

  return useMutation({
    mutationFn: async ({
      resortId,
      triggerTypes = ["date", "payment", "time"],
      batchSize = 25,
      dryRun = false,
      filters = {},
    }: {
      resortId: string;
      triggerTypes?: string[];
      batchSize?: number;
      dryRun?: boolean;
      filters?: Record<string, unknown>;
    }) => {
      const response = await fetch("/api/workflows/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resortId,
          triggerTypes,
          batchSize,
          dryRun,
          filters,
        }),
      });

      if (!response.ok) {
        throw new Error(`Batch processing failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      const { batchResult, summary } = data;

      // Update cost tracking
      if (batchResult.totalCostUsage) {
        addCostUsage(batchResult.totalCostUsage);
      }

      // Update metrics
      updateExecutionMetrics({
        totalExecutions: summary.triggersProcessed,
        successfulExecutions: summary.successfulTransitions,
        failedExecutions: summary.failedTransitions,
        totalCostSpent: summary.totalCostUSD,
        automatedTransitions: summary.triggersProcessed,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["workflow-summary"] });
    },
  });
};

/**
 * Get scheduled tasks
 */
export const useScheduledTasks = (resortId: string) => {
  return useQuery({
    queryKey: ["scheduled-tasks", resortId],
    queryFn: async () => {
      // Mock implementation - in production, fetch from API
      return [] as ScheduledTask[];
    },
    enabled: !!resortId,
    staleTime: 60000,
  });
};

/**
 * Get workflow execution history
 */
export const useWorkflowExecutionHistory = (resortId: string, filters: WorkflowFilters = {}) => {
  const executionHistory = useWorkflowStore((state) => state.executionHistory);

  return useQuery({
    queryKey: ["workflow-execution-history", resortId, filters],
    queryFn: async () => {
      // Mock implementation - in production, fetch from API with filters
      return executionHistory.filter((event) => {
        if (filters.dateFrom && event.timestamp < new Date(filters.dateFrom)) {
          return false;
        }
        if (filters.dateTo && event.timestamp > new Date(filters.dateTo)) {
          return false;
        }
        if (filters.triggerType && !filters.triggerType.includes(event.triggeredBy)) {
          return false;
        }
        return true;
      });
    },
    enabled: !!resortId,
    staleTime: 30000,
  });
};

// ============================================
// COST MONITORING HOOKS
// ============================================

/**
 * Monitor workflow costs and generate alerts
 */
export const useWorkflowCostMonitoring = (_resortId: string) => {
  const { workflowConfig, dailyCostUsage, monthlyCostUsage, addCostAlert } = useWorkflowStore();

  // Check cost thresholds and generate alerts
  React.useEffect(() => {
    if (!workflowConfig?.costLimits) return;

    const { costLimits } = workflowConfig;

    // Check daily threshold
    costLimits.alertThresholds.forEach((threshold) => {
      const dailyPercentage = (dailyCostUsage / costLimits.dailyLimitUSD) * 100;

      if (dailyPercentage >= threshold.percentage) {
        const alert: CostAlert = {
          alertId: `daily_${threshold.percentage}_${Date.now()}`,
          type: "daily_threshold",
          severity:
            threshold.action === "stop"
              ? "critical"
              : threshold.action === "throttle"
                ? "warning"
                : "info",
          message: `Daily cost usage has reached ${dailyPercentage.toFixed(1)}% of limit ($${dailyCostUsage.toFixed(4)} / $${costLimits.dailyLimitUSD})`,
          currentValue: dailyCostUsage,
          threshold: costLimits.dailyLimitUSD * (threshold.percentage / 100),
          timestamp: new Date(),
          dismissed: false,
        };

        addCostAlert(alert);
      }
    });
  }, [dailyCostUsage, monthlyCostUsage, workflowConfig, addCostAlert]);

  return {
    dailyCostUsage,
    monthlyCostUsage,
    dailyLimit: workflowConfig?.costLimits?.dailyLimitUSD || 0,
    monthlyLimit: workflowConfig?.costLimits?.monthlyLimitUSD || 0,
  };
};
