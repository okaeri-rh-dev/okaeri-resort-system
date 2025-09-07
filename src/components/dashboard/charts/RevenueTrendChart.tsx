/**
 * RevenueTrendChart Component
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Revenue trend line chart with period comparison for Professional Enterprise Design System
 * - Clean, information-dense visualization
 * - Philippine peso formatting with proper scaling
 * - Period-over-period comparison with trend indicators
 * - Mobile-responsive design for resort staff
 */

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Money } from "@/lib/money";
import {
  formatPhilippinePeso,
  formatBusinessDate,
  formatTrendIndicator,
} from "@/utils/dashboard-formatters";

interface RevenueDataPoint {
  date: Date;
  current: Money | number;
  previous?: Money | number;
  label?: string;
}

interface RevenueTrendChartProps {
  data: RevenueDataPoint[];
  title?: string;
  period: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  loading?: boolean;
  error?: string | null;
  height?: number;
  className?: string;
  showComparison?: boolean;
  comparisonPeriod?: string;
  onDataPointClick?: (dataPoint: RevenueDataPoint, index: number) => void;
}

interface ChartSummary {
  totalCurrent: Money;
  totalPrevious: Money;
  averageCurrent: Money;
  averagePrevious: Money;
  trendDirection: "up" | "down" | "neutral";
  percentageChange: number;
  peakValue: Money;
  peakDate: Date;
}

const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  data,
  title = "Revenue Trend",
  period,
  loading = false,
  error = null,
  height = 320,
  className = "",
  showComparison = true,
  comparisonPeriod = "previous period",
  onDataPointClick,
}) => {
  // Calculate chart summary metrics
  const chartSummary = useMemo((): ChartSummary | null => {
    if (!data || data.length === 0) return null;

    const currentValues = data.map((d) =>
      typeof d.current === "number" ? d.current : d.current.toNumber()
    );
    const previousValues = data
      .map((d) =>
        d.previous ? (typeof d.previous === "number" ? d.previous : d.previous.toNumber()) : 0
      )
      .filter((v) => v > 0);

    const totalCurrent = new Money(currentValues.reduce((sum, val) => sum + val, 0) * 100);
    const totalPrevious = new Money(previousValues.reduce((sum, val) => sum + val, 0) * 100);
    const averageCurrent = new Money((totalCurrent.toNumber() / data.length) * 100);
    const averagePrevious =
      previousValues.length > 0
        ? new Money((totalPrevious.toNumber() / previousValues.length) * 100)
        : new Money(0);

    const peakIndex = currentValues.indexOf(Math.max(...currentValues));
    const peakValue = new Money(currentValues[peakIndex] * 100);
    const peakDate = data[peakIndex].date;

    const percentageChange =
      totalPrevious.toNumber() > 0
        ? ((totalCurrent.toNumber() - totalPrevious.toNumber()) / totalPrevious.toNumber()) * 100
        : 0;

    const trendDirection = percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "neutral";

    return {
      totalCurrent,
      totalPrevious,
      averageCurrent,
      averagePrevious,
      trendDirection,
      percentageChange,
      peakValue,
      peakDate,
    };
  }, [data]);

  // Generate SVG path for line chart
  const generatePath = (values: number[], width: number, height: number): string => {
    if (values.length === 0) return "";

    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;

    const stepX = width / (values.length - 1);
    const padding = height * 0.1; // 10% padding top and bottom

    const points = values.map((value, index) => {
      const x = index * stepX;
      const y = padding + ((maxValue - value) / range) * (height - 2 * padding);
      return `${x},${y}`;
    });

    return `M ${points.join(" L ")}`;
  };

  // Generate chart dimensions and scale
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const chartWidth = 400;
    const chartHeight = height - 120; // Reserve space for axis labels

    const currentValues = data.map((d) =>
      typeof d.current === "number" ? d.current : d.current.toNumber()
    );
    const previousValues = showComparison
      ? data.map((d) =>
          d.previous ? (typeof d.previous === "number" ? d.previous : d.previous.toNumber()) : 0
        )
      : [];

    const allValues = [...currentValues, ...previousValues].filter((v) => v > 0);
    const maxValue = Math.max(...allValues);
    const minValue = Math.min(...allValues);

    return {
      width: chartWidth,
      height: chartHeight,
      currentPath: generatePath(currentValues, chartWidth, chartHeight),
      previousPath: showComparison ? generatePath(previousValues, chartWidth, chartHeight) : "",
      maxValue,
      minValue,
      currentValues,
      previousValues,
    };
  }, [data, height, showComparison]);

  // Loading state
  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-neutral-200" />
            <div className="animate-pulse rounded bg-neutral-200" style={{ height: height - 80 }} />
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
              <p className="text-sm text-red-600">Error loading chart data</p>
              <p className="text-xs text-neutral-500">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-center">
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">No revenue data available</p>
              <p className="text-xs text-neutral-400">
                Data will appear when transactions are recorded
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`} data-testid="revenue-trend-chart">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>

          {/* Trend Summary */}
          {chartSummary && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`gap-1 ${
                  chartSummary.trendDirection === "up"
                    ? "border-green-200 bg-green-50 text-green-600"
                    : chartSummary.trendDirection === "down"
                      ? "border-red-200 bg-red-50 text-red-600"
                      : "border-gray-200 bg-gray-50 text-gray-600"
                }`}
              >
                {chartSummary.trendDirection === "up" && <TrendingUp className="h-3 w-3" />}
                {chartSummary.trendDirection === "down" && <TrendingDown className="h-3 w-3" />}
                {chartSummary.trendDirection === "neutral" && <Minus className="h-3 w-3" />}
                {Math.abs(chartSummary.percentageChange).toFixed(1)}%
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Chart Summary Metrics */}
          {chartSummary && (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-neutral-500">Total Revenue</div>
                <div className="font-mono font-semibold" data-testid="chart-total-current">
                  {formatPhilippinePeso(chartSummary.totalCurrent, { compact: true })}
                </div>
              </div>

              {showComparison && chartSummary.totalPrevious.toNumber() > 0 && (
                <div>
                  <div className="text-xs font-medium text-neutral-500">{comparisonPeriod}</div>
                  <div className="font-mono text-neutral-600" data-testid="chart-total-previous">
                    {formatPhilippinePeso(chartSummary.totalPrevious, { compact: true })}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-neutral-500">Average</div>
                <div className="font-mono font-medium" data-testid="chart-average">
                  {formatPhilippinePeso(chartSummary.averageCurrent, { compact: true })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-neutral-500">Peak Day</div>
                <div className="font-mono font-medium" data-testid="chart-peak">
                  {formatPhilippinePeso(chartSummary.peakValue, { compact: true })}
                </div>
                <div className="text-xs text-neutral-400">
                  {formatBusinessDate(chartSummary.peakDate)}
                </div>
              </div>
            </div>
          )}

          {/* SVG Line Chart */}
          {chartData && (
            <div className="relative">
              <svg
                width="100%"
                height={height - 120}
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                className="rounded border border-neutral-200 bg-neutral-50"
                data-testid="revenue-trend-svg"
              >
                {/* Grid lines */}
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* Previous period line (comparison) */}
                {showComparison && chartData.previousPath && (
                  <path
                    d={chartData.previousPath}
                    stroke="#94a3b8"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    className="opacity-60"
                  />
                )}

                {/* Current period line */}
                <path
                  d={chartData.currentPath}
                  stroke="#3b82f6"
                  strokeWidth="3"
                  fill="none"
                  className="drop-shadow-sm"
                />

                {/* Data points */}
                {data.map((dataPoint, index) => {
                  const x = (index / (data.length - 1)) * chartData.width;
                  const currentValue =
                    typeof dataPoint.current === "number"
                      ? dataPoint.current
                      : dataPoint.current.toNumber();
                  const y =
                    chartData.height * 0.1 +
                    ((chartData.maxValue - currentValue) /
                      (chartData.maxValue - chartData.minValue || 1)) *
                      (chartData.height * 0.8);

                  return (
                    <circle
                      key={index}
                      cx={x}
                      cy={y}
                      r="4"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                      className="hover:r-6 cursor-pointer drop-shadow-sm transition-all duration-200"
                      onClick={() => onDataPointClick?.(dataPoint, index)}
                      data-testid={`revenue-point-${index}`}
                    >
                      <title>
                        {formatBusinessDate(dataPoint.date)}:{" "}
                        {formatPhilippinePeso(dataPoint.current)}
                      </title>
                    </circle>
                  );
                })}
              </svg>

              {/* X-axis labels */}
              <div className="mt-2 flex justify-between text-xs text-neutral-500">
                {data
                  .filter((_, index) => index % Math.ceil(data.length / 6) === 0)
                  .map((dataPoint, index) => (
                    <div key={index} className="text-center">
                      {formatBusinessDate(dataPoint.date)}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Chart Legend */}
          {showComparison && (
            <div className="flex items-center justify-center gap-6 text-xs">
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 bg-blue-500" />
                <span>Current Period</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 border-b border-dashed bg-neutral-400" />
                <span>{comparisonPeriod}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RevenueTrendChart;
export type { RevenueTrendChartProps, RevenueDataPoint, ChartSummary };
