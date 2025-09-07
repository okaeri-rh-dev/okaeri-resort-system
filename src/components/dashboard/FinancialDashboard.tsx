/**
 * FinancialDashboard Component
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Main financial dashboard component integrating Report Engine Service
 * with Professional Enterprise Design System principles:
 * - Information-dense layout for business operations
 * - Real-time updates with WebSocket integration ready
 * - Philippine business context with proper formatting
 * - Mobile-first responsive design for resort staff
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Download, AlertTriangle } from "lucide-react";
import MetricCard from "./metrics/MetricCard";
import RevenueTrendChart from "./charts/RevenueTrendChart";
import ExpenseBreakdownChart from "./charts/ExpenseBreakdownChart";
import PaymentMethodChart from "./charts/PaymentMethodChart";
import CashFlowChart from "./charts/CashFlowChart";
import useDashboardData from "@/hooks/useDashboardData";
import { formatBusinessDate, formatOccupancyRate } from "@/utils/dashboard-formatters";
import type { ReportPeriod } from "@/lib/services/report-engine.service";

interface FinancialDashboardProps {
  projectId: string;
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
  onExport?: (format: "excel" | "pdf" | "quickbooks") => void;
}

const FinancialDashboard: React.FC<FinancialDashboardProps> = ({
  projectId,
  className = "",
  autoRefresh = true,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
  onExport,
}) => {
  // State Management
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("monthly");

  // Dashboard data hook integration
  const {
    metrics,
    reportData,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
    retry,
    cacheHit,
    generationTime,
  } = useDashboardData({
    projectId,
    period: selectedPeriod,
    autoRefresh,
    refreshInterval,
    enableOptimisticUpdates: true,
    enableRealtime: false, // Will be enabled in future phases
  });

  // Handle manual refresh
  const handleRefresh = () => {
    refresh();
  };

  // Handle period change
  const handlePeriodChange = (period: ReportPeriod) => {
    setSelectedPeriod(period);
  };

  // Handle export
  const handleExport = (format: "excel" | "pdf" | "quickbooks") => {
    if (onExport) {
      onExport(format);
    }
  };

  // Calculate date range for display
  const getDateRangeDisplay = () => {
    const now = new Date();
    let startDate: Date;
    let endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    switch (selectedPeriod) {
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

    return { startDate, endDate };
  };

  const dateRange = getDateRangeDisplay();

  // Loading state
  if (isLoading && !metrics) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-8 w-1/4 animate-pulse rounded bg-neutral-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-neutral-200" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <MetricCard key={i} title="Loading..." value="" loading={true} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !metrics) {
    return (
      <Card className={`${className}`}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="space-y-4 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
            <h3 className="text-lg font-semibold text-neutral-900">Dashboard Error</h3>
            <p className="max-w-md text-sm text-neutral-600">{error}</p>
            <Button onClick={retry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`financial-dashboard space-y-6 ${className}`} data-testid="financial-dashboard">
      {/* Dashboard Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Financial Dashboard</h1>
          <p className="text-sm text-neutral-600">
            {formatBusinessDate(dateRange.startDate)} - {formatBusinessDate(dateRange.endDate)}
            {lastUpdated && (
              <span className="ml-2">• Updated {formatBusinessDate(lastUpdated, "full")}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Refreshing" : "Refresh"}
          </Button>

          {/* Export Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Performance Indicator */}
      {reportData && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Badge variant="outline" className="gap-1">
            {cacheHit ? "Cached" : "Fresh"}
          </Badge>
          <span>Generated in {generationTime}ms</span>
          {reportData.performance?.dataPoints && (
            <span>• {reportData.performance.dataPoints} data points</span>
          )}
        </div>
      )}

      {/* Key Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={metrics.totalRevenue}
            subtitle={`${selectedPeriod} performance`}
            status="info"
            data-testid="revenue-metric"
          />

          <MetricCard
            title="Total Expenses"
            value={metrics.totalExpenses}
            subtitle={`${selectedPeriod} spending`}
            status="neutral"
            data-testid="expenses-metric"
          />

          <MetricCard
            title="Net Profit"
            value={metrics.netProfit}
            subtitle={`${metrics.profitMargin.toFixed(1)}% margin`}
            status={metrics.netProfit.toNumber() > 0 ? "success" : "error"}
            data-testid="profit-metric"
          />

          <MetricCard
            title="Cash Position"
            value={metrics.cashPosition}
            subtitle="Available funds"
            status="neutral"
            data-testid="cash-metric"
          />

          <MetricCard
            title="Occupancy Rate"
            value={formatOccupancyRate(metrics.occupancyRate, 100)}
            subtitle="Room utilization"
            status={metrics.occupancyRate > 70 ? "success" : "warning"}
            data-testid="occupancy-metric"
          />

          <MetricCard
            title="RevPAR"
            value={metrics.revpar}
            subtitle="Revenue per available room"
            status="info"
            data-testid="revpar-metric"
          />

          <MetricCard
            title="Average Daily Rate"
            value={metrics.averageDailyRate}
            subtitle="Room pricing"
            status="neutral"
            data-testid="adr-metric"
          />

          <MetricCard
            title="Tax Obligations"
            value={metrics.taxObligations}
            subtitle="BIR compliance"
            status="warning"
            data-testid="tax-metric"
          />
        </div>
      )}

      {/* Interactive Charts */}
      {metrics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RevenueTrendChart
            data={metrics.revenueTrend}
            period={selectedPeriod}
            loading={isLoading}
            error={error}
            showComparison={true}
            comparisonPeriod={`Previous ${selectedPeriod}`}
          />

          <ExpenseBreakdownChart
            data={metrics.expenseBreakdown}
            loading={isLoading}
            error={error}
            showBudgetComparison={true}
            showPercentages={true}
          />

          <PaymentMethodChart
            data={metrics.paymentMethods}
            loading={isLoading}
            error={error}
            showTransactionCount={true}
            showTrends={true}
          />

          <CashFlowChart
            data={metrics.cashFlow}
            period={`${selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} Analysis`}
            loading={isLoading}
            error={error}
            showNetChange={true}
            showCategories={true}
          />
        </div>
      )}

      {/* Error Display if refresh fails */}
      {error && metrics && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Refresh failed: {error}</span>
              <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-auto">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FinancialDashboard;
export type { FinancialDashboardProps };
