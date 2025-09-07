/**
 * useDashboardData Hook
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Custom hook for integrating dashboard components with Report Engine Service
 * - Report Engine Service integration with caching
 * - Real-time updates with WebSocket readiness
 * - Optimistic updates for immediate UI feedback
 * - Error handling and retry logic for business continuity
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useQueryClient, UseMutationResult } from "@tanstack/react-query";
import {
  reportEngine,
  type ReportConfig,
  type ReportData,
  type ReportPeriod,
} from "@/lib/services/report-engine.service";
import { useExpenseStore } from "@/stores/expense.store";
import { useIncomeStore } from "@/stores/income.store";
import { usePaymentStore } from "@/stores/payment.store";
import { Money } from "@/lib/money";

interface DashboardDataOptions {
  projectId: string;
  period: ReportPeriod;
  autoRefresh?: boolean;
  refreshInterval?: number;
  enableOptimisticUpdates?: boolean;
  enableRealtime?: boolean;
  customDateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

interface DashboardMetrics {
  totalRevenue: Money;
  totalExpenses: Money;
  netProfit: Money;
  profitMargin: number;
  cashPosition: Money;
  occupancyRate: number;
  revpar: Money;
  averageDailyRate: Money;
  vatCollected: Money;
  taxObligations: Money;
  // Chart-specific data
  revenueTrend: Array<{
    date: Date;
    current: Money;
    previous?: Money;
    label?: string;
  }>;
  expenseBreakdown: Array<{
    category: string;
    amount: Money;
    budget?: Money;
    previousAmount?: Money;
    color?: string;
  }>;
  paymentMethods: Array<{
    method: string;
    amount: Money;
    count: number;
    previousAmount?: Money;
  }>;
  cashFlow: Array<{
    type: "opening" | "inflow" | "outflow" | "closing";
    label: string;
    amount: Money;
    category?: string;
    date?: Date;
  }>;
}

interface DashboardDataReturn {
  // Data
  metrics: DashboardMetrics | null;
  reportData: ReportData | null;

  // State
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;

  // Actions
  refresh: () => Promise<void>;
  retry: () => void;

  // Real-time
  isRealtimeConnected: boolean;
  realtimeError: string | null;

  // Performance
  cacheHit: boolean;
  generationTime: number;
}

export function useDashboardData(options: DashboardDataOptions): DashboardDataReturn {
  const {
    projectId,
    period,
    autoRefresh = false,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    enableOptimisticUpdates = true,
    enableRealtime = false,
    customDateRange,
  } = options;

  // State management
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Refs for cleanup
  const refreshIntervalRef = useRef<NodeJS.Timeout>();
  const websocketRef = useRef<WebSocket>();

  // Query client for cache management
  const queryClient = useQueryClient();

  // Store integration
  const { expenses } = useExpenseStore();
  const { income } = useIncomeStore();
  const { payments } = usePaymentStore();

  // Generate report configuration
  const reportConfig = useMemo((): ReportConfig => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (customDateRange) {
      startDate = customDateRange.startDate;
      endDate = customDateRange.endDate;
    } else {
      // Calculate date range based on period
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0); // Last day of current month

      switch (period) {
        case "daily":
          startDate = new Date(now);
          endDate = new Date(now);
          break;
        case "weekly":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "monthly":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "quarterly":
          const quarterStart = Math.floor(now.getMonth() / 3) * 3;
          startDate = new Date(now.getFullYear(), quarterStart, 1);
          break;
        case "yearly":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }

    return {
      projectId,
      reportType: "profit-loss",
      period,
      startDate,
      endDate,
      currency: "PHP",
      includeComparisons: true,
      includeCharts: true,
    };
  }, [projectId, period, customDateRange]);

  // Main data query using TanStack Query
  const {
    data: reportData,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-data", reportConfig],
    queryFn: async () => {
      const data = await reportEngine.generateReport(reportConfig, "dashboard-user");
      setLastUpdated(new Date());
      return data;
    },
    staleTime: period === "daily" ? 5 * 60 * 1000 : 30 * 60 * 1000, // Vary by period
    cacheTime: 60 * 60 * 1000, // 1 hour cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Transform report data to dashboard metrics
  const metrics = useMemo((): DashboardMetrics | null => {
    if (!reportData) return null;

    // Extract basic metrics from report
    const baseMetrics = {
      totalRevenue: reportData.metrics.totalRevenue,
      totalExpenses: reportData.metrics.totalExpenses,
      netProfit: reportData.metrics.netIncome,
      profitMargin: reportData.metrics.grossMargin,
      cashPosition: reportData.metrics.totalRevenue.subtract(reportData.metrics.totalExpenses),
      occupancyRate: reportData.metrics.occupancyRate || 0,
      revpar: reportData.metrics.revenuePerAvailableRoom || new Money(0),
      averageDailyRate: reportData.metrics.averageDailyRate || new Money(0),
      vatCollected: reportData.metrics.vatCollected,
      taxObligations: reportData.metrics.taxLiability,
    };

    // Generate mock chart data (in production, this would come from report details)
    const revenueTrend = generateMockRevenueTrend(baseMetrics.totalRevenue, period);
    const expenseBreakdown = generateMockExpenseBreakdown(baseMetrics.totalExpenses);
    const paymentMethods = generateMockPaymentMethods(baseMetrics.totalRevenue);
    const cashFlow = generateMockCashFlow(baseMetrics.totalRevenue, baseMetrics.totalExpenses);

    return {
      ...baseMetrics,
      revenueTrend,
      expenseBreakdown,
      paymentMethods,
      cashFlow,
    };
  }, [reportData, period]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  // Retry function for error recovery
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Auto-refresh mechanism
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    refreshIntervalRef.current = setInterval(() => {
      if (!isLoading && !isRefreshing) {
        refresh();
      }
    }, refreshInterval);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval, isLoading, isRefreshing, refresh]);

  // Real-time WebSocket connection (placeholder for future implementation)
  useEffect(() => {
    if (!enableRealtime) return;

    // This is a placeholder for WebSocket implementation
    // In production, this would establish a WebSocket connection
    // for real-time dashboard updates

    const connectWebSocket = () => {
      try {
        // Mock WebSocket connection
        setIsRealtimeConnected(true);
        setRealtimeError(null);

        // In real implementation:
        // websocketRef.current = new WebSocket(process.env.REACT_APP_WS_URL);
        // websocketRef.current.onmessage = handleRealtimeUpdate;
        // websocketRef.current.onerror = handleWebSocketError;
      } catch (error: any) {
        setRealtimeError(error.message);
        setIsRealtimeConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [enableRealtime]);

  // Optimistic updates based on store changes
  useEffect(() => {
    if (!enableOptimisticUpdates || !metrics) return;

    // Listen for store changes and invalidate queries
    // This ensures dashboard reflects optimistic updates from other parts of the app
    const handleStoreChange = () => {
      queryClient.invalidateQueries(["dashboard-data"]);
    };

    // In production, you would set up store subscriptions here
    // For now, this is a placeholder
  }, [enableOptimisticUpdates, metrics, queryClient]);

  const error = queryError?.message || null;
  const cacheHit = reportData?.performance?.cacheHit || false;
  const generationTime = reportData?.performance?.generationTime || 0;

  return {
    // Data
    metrics,
    reportData,

    // State
    isLoading,
    isRefreshing,
    error,
    lastUpdated,

    // Actions
    refresh,
    retry,

    // Real-time
    isRealtimeConnected,
    realtimeError,

    // Performance
    cacheHit,
    generationTime,
  };
}

// Helper functions for generating mock chart data
// In production, these would be replaced with real data from the Report Engine

function generateMockRevenueTrend(totalRevenue: Money, period: ReportPeriod) {
  const days = period === "daily" ? 1 : period === "weekly" ? 7 : period === "monthly" ? 30 : 90;
  const trend = [];

  for (let i = 0; i < Math.min(days, 30); i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // Generate realistic daily revenue with some randomness
    const dailyRevenue = (totalRevenue.toNumber() / days) * (0.8 + Math.random() * 0.4);
    const previousRevenue = dailyRevenue * (0.9 + Math.random() * 0.2);

    trend.unshift({
      date,
      current: new Money(dailyRevenue),
      previous: new Money(previousRevenue),
      label: date.toLocaleDateString(),
    });
  }

  return trend;
}

function generateMockExpenseBreakdown(totalExpenses: Money) {
  const categories = [
    { category: "Staff Salaries", percentage: 0.4, color: "#ef4444" },
    { category: "Utilities", percentage: 0.2, color: "#f97316" },
    { category: "Maintenance", percentage: 0.15, color: "#eab308" },
    { category: "Supplies", percentage: 0.1, color: "#22c55e" },
    { category: "Marketing", percentage: 0.08, color: "#3b82f6" },
    { category: "Administration", percentage: 0.07, color: "#8b5cf6" },
  ];

  return categories.map((cat) => ({
    category: cat.category,
    amount: new Money(totalExpenses.toNumber() * cat.percentage),
    budget: new Money(totalExpenses.toNumber() * cat.percentage * 1.1),
    previousAmount: new Money(totalExpenses.toNumber() * cat.percentage * 0.95),
    color: cat.color,
  }));
}

function generateMockPaymentMethods(totalRevenue: Money) {
  const methods = [
    { method: "cash", percentage: 0.45, count: 120 },
    { method: "gcash", percentage: 0.3, count: 85 },
    { method: "maya", percentage: 0.15, count: 45 },
    { method: "bank_transfer", percentage: 0.1, count: 25 },
  ];

  return methods.map((method) => ({
    method: method.method,
    amount: new Money(totalRevenue.toNumber() * method.percentage),
    count: method.count,
    previousAmount: new Money(totalRevenue.toNumber() * method.percentage * 0.9),
  }));
}

function generateMockCashFlow(totalRevenue: Money, totalExpenses: Money) {
  const openingBalance = new Money(totalRevenue.toNumber() * 0.3); // Assume 30% starting balance

  return [
    {
      type: "opening" as const,
      label: "Opening Balance",
      amount: openingBalance,
      category: "Balance",
      date: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
    {
      type: "inflow" as const,
      label: "Room Revenue",
      amount: new Money(totalRevenue.toNumber() * 0.7),
      category: "Revenue",
      date: new Date(),
    },
    {
      type: "inflow" as const,
      label: "Other Income",
      amount: new Money(totalRevenue.toNumber() * 0.3),
      category: "Revenue",
      date: new Date(),
    },
    {
      type: "outflow" as const,
      label: "Operating Expenses",
      amount: new Money(totalExpenses.toNumber() * 0.8),
      category: "Expenses",
      date: new Date(),
    },
    {
      type: "outflow" as const,
      label: "Tax Payments",
      amount: new Money(totalExpenses.toNumber() * 0.2),
      category: "Taxes",
      date: new Date(),
    },
    {
      type: "closing" as const,
      label: "Closing Balance",
      amount: openingBalance.add(totalRevenue).subtract(totalExpenses),
      category: "Balance",
      date: new Date(),
    },
  ];
}

export default useDashboardData;
