/**
 * CashFlowChart Component
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Waterfall cash flow visualization for Professional Enterprise Design System
 * - Information-dense visualization showing cash flow progression
 * - Philippine peso formatting with proper scaling
 * - Opening → Inflows → Outflows → Closing balance visualization
 * - Mobile-responsive design for resort financial analysis
 */

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Money } from "@/lib/money";
import {
  formatPhilippinePeso,
  formatPercentage,
  formatBusinessDate,
} from "@/utils/dashboard-formatters";

interface CashFlowItem {
  type: "opening" | "inflow" | "outflow" | "closing";
  label: string;
  amount: Money | number;
  category?: string;
  date?: Date;
  description?: string;
}

interface CashFlowChartProps {
  data: CashFlowItem[];
  title?: string;
  period?: string;
  loading?: boolean;
  error?: string | null;
  height?: number;
  className?: string;
  showNetChange?: boolean;
  showCategories?: boolean;
  onItemClick?: (item: CashFlowItem, index: number) => void;
}

interface CashFlowSummary {
  openingBalance: Money;
  closingBalance: Money;
  totalInflows: Money;
  totalOutflows: Money;
  netChange: Money;
  changePercentage: number;
  largestInflow: { label: string; amount: Money };
  largestOutflow: { label: string; amount: Money };
}

// Color scheme for different cash flow types
const CASH_FLOW_COLORS = {
  opening: "#6b7280", // gray-500
  inflow: "#22c55e", // green-500
  outflow: "#ef4444", // red-500
  closing: "#3b82f6", // blue-500
};

const CashFlowChart: React.FC<CashFlowChartProps> = ({
  data,
  title = "Cash Flow Analysis",
  period = "This Month",
  loading = false,
  error = null,
  height = 320,
  className = "",
  showNetChange = true,
  showCategories = true,
  onItemClick,
}) => {
  // Process and validate cash flow data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data.map((item) => ({
      ...item,
      amount: typeof item.amount === "number" ? new Money(item.amount * 100) : item.amount,
      numericAmount: typeof item.amount === "number" ? item.amount : item.amount.toNumber(),
    }));
  }, [data]);

  // Calculate cash flow summary and running balances
  const { summary, waterfallData } = useMemo(() => {
    if (!processedData || processedData.length === 0) {
      return { summary: null, waterfallData: [] };
    }

    // Separate items by type
    const opening = processedData.find((item) => item.type === "opening");
    const closing = processedData.find((item) => item.type === "closing");
    const inflows = processedData.filter((item) => item.type === "inflow");
    const outflows = processedData.filter((item) => item.type === "outflow");

    const openingBalance = opening ? opening.amount : new Money(0);
    const closingBalance = closing ? closing.amount : new Money(0);
    const totalInflows = inflows.reduce((sum, item) => sum.add(item.amount), new Money(0));
    const totalOutflows = outflows.reduce((sum, item) => sum.add(item.amount), new Money(0));

    const netChange = totalInflows.subtract(totalOutflows);
    const changePercentage =
      openingBalance.toNumber() > 0 ? (netChange.toNumber() / openingBalance.toNumber()) * 100 : 0;

    const largestInflow =
      inflows.length > 0
        ? inflows.reduce((max, item) =>
            item.amount.toNumber() > max.amount.toNumber() ? item : max
          )
        : { label: "None", amount: new Money(0) };

    const largestOutflow =
      outflows.length > 0
        ? outflows.reduce((max, item) =>
            item.amount.toNumber() > max.amount.toNumber() ? item : max
          )
        : { label: "None", amount: new Money(0) };

    const summary: CashFlowSummary = {
      openingBalance,
      closingBalance,
      totalInflows,
      totalOutflows,
      netChange,
      changePercentage,
      largestInflow: { label: largestInflow.label, amount: largestInflow.amount },
      largestOutflow: { label: largestOutflow.label, amount: largestOutflow.amount },
    };

    // Generate waterfall visualization data with running balances
    let runningBalance = openingBalance.toNumber();
    const waterfallItems = [];

    // Opening balance
    if (opening) {
      waterfallItems.push({
        ...opening,
        runningBalance,
        startValue: 0,
        endValue: runningBalance,
        isBase: true,
      });
    }

    // Inflows (positive additions)
    inflows.forEach((item) => {
      const startValue = runningBalance;
      runningBalance += item.amount.toNumber();
      waterfallItems.push({
        ...item,
        runningBalance,
        startValue,
        endValue: runningBalance,
        isBase: false,
      });
    });

    // Outflows (negative subtractions)
    outflows.forEach((item) => {
      const startValue = runningBalance;
      runningBalance -= item.amount.toNumber();
      waterfallItems.push({
        ...item,
        runningBalance,
        startValue: runningBalance,
        endValue: startValue,
        isBase: false,
      });
    });

    // Closing balance
    if (closing) {
      waterfallItems.push({
        ...closing,
        runningBalance,
        startValue: 0,
        endValue: runningBalance,
        isBase: true,
      });
    }

    return { summary, waterfallData: waterfallItems };
  }, [processedData]);

  // Calculate chart dimensions and scale
  const chartDimensions = useMemo(() => {
    if (!waterfallData || waterfallData.length === 0) return null;

    const values = waterfallData.flatMap((item) => [item.startValue, item.endValue]);
    const maxValue = Math.max(...values, 0);
    const minValue = Math.min(...values, 0);
    const range = maxValue - minValue || 1;

    const chartWidth = 600;
    const chartHeight = height - 160;
    const barWidth = Math.min(80, chartWidth / (waterfallData.length + 1));
    const barSpacing = (chartWidth - barWidth * waterfallData.length) / (waterfallData.length + 1);

    return {
      width: chartWidth,
      height: chartHeight,
      barWidth,
      barSpacing,
      maxValue,
      minValue,
      range,
    };
  }, [waterfallData, height]);

  // Loading state
  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-neutral-200" />
              ))}
            </div>
            <div
              className="animate-pulse rounded bg-neutral-200"
              style={{ height: height - 160 }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-center">
            <div className="space-y-2">
              <p className="text-sm text-red-600">Error loading cash flow data</p>
              <p className="text-xs text-neutral-500">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!processedData || processedData.length === 0 || !summary) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-center">
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">No cash flow data available</p>
              <p className="text-xs text-neutral-400">
                Cash flow analysis will appear when financial data is available
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`} data-testid="cash-flow-chart">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">{title}</CardTitle>
            <p className="mt-1 text-sm text-neutral-500">{period}</p>
          </div>

          {/* Net Change Badge */}
          {showNetChange && summary && (
            <Badge
              variant="outline"
              className={`gap-1 ${
                summary.netChange.toNumber() > 0
                  ? "border-green-200 bg-green-50 text-green-600"
                  : summary.netChange.toNumber() < 0
                    ? "border-red-200 bg-red-50 text-red-600"
                    : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              {summary.netChange.toNumber() > 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : summary.netChange.toNumber() < 0 ? (
                <TrendingDown className="h-3 w-3" />
              ) : (
                <ArrowRight className="h-3 w-3" />
              )}
              {formatPhilippinePeso(summary.netChange.abs(), {
                compact: true,
                showCurrency: false,
              })}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <div className="text-xs font-medium text-neutral-500">Opening Balance</div>
              <div className="font-mono font-semibold" data-testid="opening-balance">
                {formatPhilippinePeso(summary.openingBalance, { compact: true })}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500">Total Inflows</div>
              <div className="font-mono font-semibold text-green-600" data-testid="total-inflows">
                {formatPhilippinePeso(summary.totalInflows, { compact: true })}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500">Total Outflows</div>
              <div className="font-mono font-semibold text-red-600" data-testid="total-outflows">
                {formatPhilippinePeso(summary.totalOutflows, { compact: true })}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500">Closing Balance</div>
              <div className="font-mono font-semibold" data-testid="closing-balance">
                {formatPhilippinePeso(summary.closingBalance, { compact: true })}
              </div>
            </div>
          </div>

          {/* Waterfall Chart */}
          {chartDimensions && (
            <div className="relative">
              <svg
                width="100%"
                height={chartDimensions.height}
                viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                className="rounded border border-neutral-200 bg-neutral-50"
                data-testid="cash-flow-waterfall"
              >
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="50" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Zero line */}
                {chartDimensions.minValue < 0 && (
                  <line
                    x1="0"
                    y1={
                      chartDimensions.height -
                      (-chartDimensions.minValue / chartDimensions.range) * chartDimensions.height
                    }
                    x2={chartDimensions.width}
                    y2={
                      chartDimensions.height -
                      (-chartDimensions.minValue / chartDimensions.range) * chartDimensions.height
                    }
                    stroke="#374151"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                )}

                {/* Waterfall bars and connectors */}
                {waterfallData.map((item, index) => {
                  const x =
                    chartDimensions.barSpacing +
                    index * (chartDimensions.barWidth + chartDimensions.barSpacing);

                  // For base bars (opening/closing), draw from bottom
                  if (item.isBase) {
                    const barHeight = Math.abs(
                      (item.endValue / chartDimensions.range) * chartDimensions.height
                    );
                    const y = chartDimensions.height - barHeight;

                    return (
                      <g key={index}>
                        <rect
                          x={x}
                          y={y}
                          width={chartDimensions.barWidth}
                          height={barHeight}
                          fill={CASH_FLOW_COLORS[item.type]}
                          className={`${onItemClick ? "cursor-pointer hover:opacity-80" : ""}`}
                          onClick={() => onItemClick?.(item, index)}
                          data-testid={`waterfall-bar-${index}`}
                        >
                          <title>
                            {item.label}: {formatPhilippinePeso(item.amount)}
                          </title>
                        </rect>

                        {/* Bar value label */}
                        <text
                          x={x + chartDimensions.barWidth / 2}
                          y={y - 5}
                          textAnchor="middle"
                          className="fill-neutral-700 font-mono text-xs"
                        >
                          {formatPhilippinePeso(item.amount, {
                            compact: true,
                            showCurrency: false,
                          })}
                        </text>
                      </g>
                    );
                  } else {
                    // For change bars (inflows/outflows), draw the change amount
                    const startY =
                      chartDimensions.height -
                      (item.startValue / chartDimensions.range) * chartDimensions.height;
                    const endY =
                      chartDimensions.height -
                      (item.endValue / chartDimensions.range) * chartDimensions.height;
                    const barHeight = Math.abs(endY - startY);
                    const y = Math.min(startY, endY);

                    return (
                      <g key={index}>
                        <rect
                          x={x}
                          y={y}
                          width={chartDimensions.barWidth}
                          height={barHeight}
                          fill={CASH_FLOW_COLORS[item.type]}
                          className={`${onItemClick ? "cursor-pointer hover:opacity-80" : ""}`}
                          onClick={() => onItemClick?.(item, index)}
                          data-testid={`waterfall-bar-${index}`}
                        >
                          <title>
                            {item.label}: {formatPhilippinePeso(item.amount)}
                          </title>
                        </rect>

                        {/* Connector line to next bar */}
                        {index < waterfallData.length - 1 && !waterfallData[index + 1].isBase && (
                          <line
                            x1={x + chartDimensions.barWidth}
                            y1={endY}
                            x2={x + chartDimensions.barWidth + chartDimensions.barSpacing}
                            y2={endY}
                            stroke="#9ca3af"
                            strokeWidth="1"
                            strokeDasharray="3,3"
                          />
                        )}

                        {/* Bar value label */}
                        <text
                          x={x + chartDimensions.barWidth / 2}
                          y={y - 5}
                          textAnchor="middle"
                          className="fill-neutral-700 font-mono text-xs"
                        >
                          {item.type === "outflow" ? "-" : "+"}
                          {formatPhilippinePeso(item.amount, {
                            compact: true,
                            showCurrency: false,
                          })}
                        </text>
                      </g>
                    );
                  }
                })}
              </svg>

              {/* X-axis labels */}
              <div className="mt-2 flex justify-between text-xs text-neutral-500">
                {waterfallData.map((item, index) => (
                  <div
                    key={index}
                    className="text-center"
                    style={{
                      width: chartDimensions.barWidth,
                      marginLeft:
                        index === 0
                          ? chartDimensions.barSpacing
                          : chartDimensions.barSpacing - chartDimensions.barWidth / 2,
                    }}
                  >
                    <div className="font-medium">{item.label}</div>
                    {item.category && showCategories && (
                      <div className="text-neutral-400">{item.category}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Insights */}
          <div className="grid grid-cols-1 gap-4 border-t border-neutral-200 pt-2 md:grid-cols-2">
            <div>
              <div className="text-xs font-medium text-neutral-500">Largest Inflow</div>
              <div className="text-sm font-medium text-green-600">
                {summary.largestInflow.label}
              </div>
              <div className="font-mono text-xs text-neutral-600">
                {formatPhilippinePeso(summary.largestInflow.amount, { compact: true })}
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-neutral-500">Largest Outflow</div>
              <div className="text-sm font-medium text-red-600">{summary.largestOutflow.label}</div>
              <div className="font-mono text-xs text-neutral-600">
                {formatPhilippinePeso(summary.largestOutflow.amount, { compact: true })}
              </div>
            </div>
          </div>

          {/* Net Change Summary */}
          <div className="rounded border bg-neutral-50 p-3 text-center">
            <div className="text-xs font-medium text-neutral-500">Net Cash Flow</div>
            <div
              className={`font-mono text-lg font-bold ${
                summary.netChange.toNumber() > 0
                  ? "text-green-600"
                  : summary.netChange.toNumber() < 0
                    ? "text-red-600"
                    : "text-neutral-600"
              }`}
            >
              {summary.netChange.toNumber() >= 0 ? "+" : ""}
              {formatPhilippinePeso(summary.netChange)}
            </div>
            {summary.changePercentage !== 0 && (
              <div className="text-xs text-neutral-500">
                {summary.changePercentage > 0 ? "+" : ""}
                {formatPercentage(summary.changePercentage, 1)} change
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowChart;
export type { CashFlowChartProps, CashFlowItem, CashFlowSummary };
