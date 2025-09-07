/**
 * MetricCard Component
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Reusable KPI display component following Professional Enterprise Design System
 * - Information-dense layout for operational efficiency
 * - Philippine business formatting with monospace fonts
 * - Professional styling with minimal visual elements
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/lib/money";
import {
  formatPhilippinePeso,
  formatTrendIndicator,
  getStatusColor,
  type PhilippineBusinessFormatOptions,
} from "@/utils/dashboard-formatters";

interface TrendData {
  currentValue: number;
  previousValue: number;
  period?: string;
}

interface MetricCardProps {
  title: string;
  value: Money | number | string;
  subtitle?: string;
  trend?: TrendData;
  status?: "success" | "warning" | "error" | "info" | "neutral";
  loading?: boolean;
  compact?: boolean;
  className?: string;
  formatOptions?: PhilippineBusinessFormatOptions;
  // Enterprise features
  target?: number;
  unit?: string;
  precision?: number;
  showTarget?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  // Accessibility
  "aria-label"?: string;
  "data-testid"?: string;
}

interface SkeletonProps {
  className?: string;
}

const MetricSkeleton: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div className={`animate-pulse space-y-3 ${className}`}>
    <div className="h-4 w-1/2 rounded bg-neutral-200" />
    <div className="h-8 w-3/4 rounded bg-neutral-200" />
    <div className="h-3 w-1/3 rounded bg-neutral-200" />
  </div>
);

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  status = "neutral",
  loading = false,
  compact = false,
  className = "",
  formatOptions = {},
  target,
  unit,
  precision = 2,
  showTarget = false,
  actionLabel,
  onAction,
  "aria-label": ariaLabel,
  "data-testid": testId,
}) => {
  // Format the main value based on type
  const formatValue = (val: Money | number | string): string => {
    if (typeof val === "string") {
      return val;
    }

    if (val instanceof Money || typeof val === "number") {
      return formatPhilippinePeso(val, {
        compact: compact,
        precision,
        monospace: true,
        ...formatOptions,
      });
    }

    return String(val);
  };

  // Calculate trend indicator if trend data is provided
  const trendIndicator = trend
    ? formatTrendIndicator(trend.currentValue, trend.previousValue, {
        showPercentage: true,
        showArrow: true,
      })
    : null;

  // Get status colors for enterprise design
  const statusColors = getStatusColor(status);

  // Calculate target progress if target is provided
  const targetProgress =
    target && typeof value === "number" ? Math.round((value / target) * 100) : null;

  if (loading) {
    return (
      <Card
        className={`enterprise-metric-card ${className}`}
        data-testid={testId ? `${testId}-loading` : "metric-card-loading"}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-neutral-600">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <MetricSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`enterprise-metric-card border border-neutral-200 shadow-none transition-colors duration-200 hover:border-neutral-300 ${className}`}
      aria-label={ariaLabel || `${title} metric`}
      data-testid={testId || "metric-card"}
    >
      <CardHeader className={`pb-2 ${compact ? "py-3" : "py-4"}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm leading-none font-medium text-neutral-700">
            {title}
          </CardTitle>

          {/* Status badge for enterprise context */}
          {status !== "neutral" && (
            <Badge
              variant="outline"
              className={`px-2 py-1 text-xs ${statusColors.text} ${statusColors.bg} ${statusColors.border}`}
            >
              {status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className={`${compact ? "py-3" : "py-4"} pt-0`}>
        <div className="space-y-2">
          {/* Main Value Display */}
          <div className="flex items-baseline justify-between">
            <div
              className="font-mono text-2xl leading-none font-bold text-neutral-900"
              data-testid={testId ? `${testId}-value` : "metric-value"}
            >
              {formatValue(value)}
              {unit && <span className="ml-1 text-sm font-normal text-neutral-500">{unit}</span>}
            </div>

            {/* Trend Indicator */}
            {trendIndicator && (
              <div
                className={`text-sm font-medium ${trendIndicator.className} flex items-center`}
                data-testid={testId ? `${testId}-trend` : "metric-trend"}
                aria-label={`Trend: ${trendIndicator.direction} by ${trendIndicator.percentage}%`}
              >
                {trendIndicator.display}
              </div>
            )}
          </div>

          {/* Subtitle or period information */}
          {subtitle && (
            <div
              className="text-sm font-normal text-neutral-500"
              data-testid={testId ? `${testId}-subtitle` : "metric-subtitle"}
            >
              {subtitle}
            </div>
          )}

          {/* Target Progress Bar (Enterprise Feature) */}
          {showTarget && target && targetProgress !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Target Progress</span>
                <span className="font-mono">{targetProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-200">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    targetProgress >= 100
                      ? "bg-green-500"
                      : targetProgress >= 75
                        ? "bg-blue-500"
                        : targetProgress >= 50
                          ? "bg-yellow-500"
                          : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(targetProgress, 100)}%` }}
                />
              </div>
              <div className="font-mono text-xs text-neutral-500">
                Target: {formatPhilippinePeso(target, formatOptions)}
              </div>
            </div>
          )}

          {/* Period Context */}
          {trend?.period && (
            <div
              className="text-xs font-medium text-neutral-400"
              data-testid={testId ? `${testId}-period` : "metric-period"}
            >
              vs {trend.period}
            </div>
          )}

          {/* Action Button for Enterprise Operations */}
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="mt-3 w-full rounded border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors duration-200 hover:bg-neutral-100"
              data-testid={testId ? `${testId}-action` : "metric-action"}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MetricCard;
export type { MetricCardProps, TrendData };
