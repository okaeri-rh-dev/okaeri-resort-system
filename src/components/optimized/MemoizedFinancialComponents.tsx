/**
 * Memoized Financial Components
 * Phase 4.4 Week 3.3 - React Performance Optimization
 *
 * High-performance React components optimized for financial calculations and data display.
 * Uses React.memo, useMemo, useCallback, and other optimization techniques to minimize re-renders
 * and expensive calculations, especially for Money class operations and Philippine peso formatting.
 *
 * Key Optimizations:
 * - React.memo for component-level memoization
 * - useMemo for expensive Money calculations
 * - useCallback for stable function references
 * - Shallow comparison for props
 * - Virtual scrolling integration ready
 */

import React, { memo, useMemo, useCallback, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, TrendingDownIcon } from "lucide-react";
import { Money } from "@/lib/money";

// Types for memoized components
interface MemoizedMetricCardProps {
  title: string;
  value: Money;
  previousValue?: Money;
  subtitle?: string;
  status?: "success" | "error" | "warning" | "info" | "neutral";
  loading?: boolean;
  showTrend?: boolean;
  showPercentage?: boolean;
  precision?: number;
  className?: string;
}

interface MemoizedTransactionRowProps {
  id: string;
  date: Date;
  description: string;
  amount: Money;
  category: string;
  status: "pending" | "completed" | "failed";
  paymentMethod: string;
  reference?: string;
  onClick?: (id: string) => void;
}

interface MemoizedFinancialSummaryProps {
  revenue: Money;
  expenses: Money;
  profit: Money;
  profitMargin: number;
  previousRevenue?: Money;
  previousExpenses?: Money;
  period: string;
  loading?: boolean;
}

interface MemoizedTaxCalculationProps {
  grossIncome: Money;
  vatRate: number;
  ewtRate: number;
  otherTaxes: Money;
  netTaxDue: Money;
  dueDate: Date;
  status: "pending" | "filed" | "overdue";
}

interface MemoizedPaymentBreakdownProps {
  payments: Array<{
    method: string;
    amount: Money;
    count: number;
    percentage: number;
  }>;
  total: Money;
  showChart?: boolean;
}

// Utility functions for memoization
const formatPercentage = (value: number, precision: number = 1): string => {
  return `${value.toFixed(precision)}%`;
};

const formatBusinessDate = (date: Date, format: "short" | "long" = "short"): string => {
  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { month: "short", day: "numeric" }
      : { month: "long", day: "numeric", year: "numeric" };

  return date.toLocaleDateString("en-PH", options);
};

const calculateTrend = (
  current: Money,
  previous: Money | undefined
): {
  direction: "up" | "down" | "neutral";
  percentage: number;
  isPositive: boolean;
} => {
  if (!previous || previous.isZero()) {
    return { direction: "neutral", percentage: 0, isPositive: true };
  }

  const change = current.subtract(previous);
  const percentage = change.divide(previous).multiply(new Money(100, "PHP")).toNumber();
  const isPositive = !change.isNegative();
  const direction = change.isZero() ? "neutral" : isPositive ? "up" : "down";

  return { direction, percentage: Math.abs(percentage), isPositive };
};

// Custom comparison functions for React.memo
const areMetricPropsEqual = (
  prev: MemoizedMetricCardProps,
  next: MemoizedMetricCardProps
): boolean => {
  return (
    prev.title === next.title &&
    prev.value.equals(next.value) &&
    prev.previousValue?.equals(next.previousValue) !== false &&
    prev.subtitle === next.subtitle &&
    prev.status === next.status &&
    prev.loading === next.loading &&
    prev.showTrend === next.showTrend &&
    prev.showPercentage === next.showPercentage &&
    prev.precision === next.precision
  );
};

const areTransactionPropsEqual = (
  prev: MemoizedTransactionRowProps,
  next: MemoizedTransactionRowProps
): boolean => {
  return (
    prev.id === next.id &&
    prev.date.getTime() === next.date.getTime() &&
    prev.description === next.description &&
    prev.amount.equals(next.amount) &&
    prev.category === next.category &&
    prev.status === next.status &&
    prev.paymentMethod === next.paymentMethod &&
    prev.reference === next.reference
  );
};

/**
 * Memoized Metric Card with optimized Money calculations
 */
export const MemoizedMetricCard = memo<MemoizedMetricCardProps>(
  ({
    title,
    value,
    previousValue,
    subtitle,
    status = "neutral",
    loading = false,
    showTrend = false,
    showPercentage = false,
    precision = 0,
    className = "",
  }) => {
    // Memoized calculations
    const formattedValue = useMemo(() => {
      return loading ? "..." : value.format({ precision });
    }, [value, loading, precision]);

    const trend = useMemo(() => {
      return showTrend ? calculateTrend(value, previousValue) : null;
    }, [value, previousValue, showTrend]);

    const statusColor = useMemo(() => {
      const colors = {
        success: "text-green-600 bg-green-50 border-green-200",
        error: "text-red-600 bg-red-50 border-red-200",
        warning: "text-yellow-600 bg-yellow-50 border-yellow-200",
        info: "text-blue-600 bg-blue-50 border-blue-200",
        neutral: "text-neutral-600 bg-neutral-50 border-neutral-200",
      };
      return colors[status];
    }, [status]);

    const TrendIcon = useMemo(() => {
      if (!trend) return null;
      if (trend.direction === "up") return trend.isPositive ? TrendingUpIcon : ArrowUpIcon;
      if (trend.direction === "down") return trend.isPositive ? ArrowDownIcon : TrendingDownIcon;
      return null;
    }, [trend]);

    if (loading) {
      return (
        <Card className={`${statusColor} ${className}`}>
          <CardContent className="p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 w-3/4 rounded bg-neutral-200"></div>
              <div className="h-6 w-1/2 rounded bg-neutral-200"></div>
              <div className="h-3 w-2/3 rounded bg-neutral-200"></div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={`${statusColor} ${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-600">{title}</h3>
            {trend && TrendIcon && (
              <TrendIcon
                className={`h-4 w-4 ${trend.isPositive ? "text-green-500" : "text-red-500"}`}
              />
            )}
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-neutral-900">{formattedValue}</p>

            {trend && (
              <Badge variant={trend.isPositive ? "default" : "destructive"}>
                {trend.isPositive ? "+" : "-"}
                {formatPercentage(trend.percentage, 1)}
              </Badge>
            )}
          </div>

          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </CardContent>
      </Card>
    );
  },
  areMetricPropsEqual
);

MemoizedMetricCard.displayName = "MemoizedMetricCard";

/**
 * Memoized Transaction Row for virtual scrolling
 */
export const MemoizedTransactionRow = memo<MemoizedTransactionRowProps>(
  ({ id, date, description, amount, category, status, paymentMethod, reference, onClick }) => {
    const handleClick = useCallback(() => {
      onClick?.(id);
    }, [onClick, id]);

    const formattedAmount = useMemo(() => {
      return amount.format({ precision: 2 });
    }, [amount]);

    const formattedDate = useMemo(() => {
      return formatBusinessDate(date, "short");
    }, [date]);

    const statusColor = useMemo(() => {
      const colors = {
        pending: "bg-yellow-100 text-yellow-800",
        completed: "bg-green-100 text-green-800",
        failed: "bg-red-100 text-red-800",
      };
      return colors[status];
    }, [status]);

    return (
      <div
        className="flex cursor-pointer items-center justify-between border-b border-neutral-100 p-3 transition-colors hover:bg-neutral-50"
        onClick={handleClick}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <p className="truncate text-sm font-medium text-neutral-900">{description}</p>
              <div className="mt-1 flex items-center space-x-2">
                <span className="text-xs text-neutral-500">{formattedDate}</span>
                <Badge variant="outline" className="text-xs">
                  {category}
                </Badge>
                <Badge className={`text-xs ${statusColor}`}>{status}</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p
            className={`text-sm font-semibold ${amount.isNegative() ? "text-red-600" : "text-green-600"}`}
          >
            {formattedAmount}
          </p>
          <p className="text-xs text-neutral-500">{paymentMethod}</p>
          {reference && <p className="text-xs text-neutral-400">#{reference}</p>}
        </div>
      </div>
    );
  },
  areTransactionPropsEqual
);

MemoizedTransactionRow.displayName = "MemoizedTransactionRow";

/**
 * Memoized Financial Summary with complex calculations
 */
export const MemoizedFinancialSummary = memo<MemoizedFinancialSummaryProps>(
  ({
    revenue,
    expenses,
    profit,
    profitMargin,
    previousRevenue,
    previousExpenses,
    period,
    loading = false,
  }) => {
    // Memoized complex calculations
    const calculations = useMemo(() => {
      if (loading) return null;

      const revenueTrend = calculateTrend(revenue, previousRevenue);
      const expenseTrend = calculateTrend(expenses, previousExpenses);
      const previousProfit =
        previousRevenue && previousExpenses
          ? previousRevenue.subtract(previousExpenses)
          : undefined;
      const profitTrend = calculateTrend(profit, previousProfit);

      return {
        revenueTrend,
        expenseTrend,
        profitTrend,
        expenseRatio: revenue.isZero()
          ? 0
          : expenses.divide(revenue).multiply(new Money(100, "PHP")).toNumber(),
      };
    }, [revenue, expenses, profit, previousRevenue, previousExpenses, loading]);

    const formattedValues = useMemo(
      () => ({
        revenue: revenue.format({ precision: 0 }),
        expenses: expenses.format({ precision: 0 }),
        profit: profit.format({ precision: 0 }),
        profitMargin: formatPercentage(profitMargin, 1),
      }),
      [revenue, expenses, profit, profitMargin]
    );

    if (loading) {
      return (
        <Card>
          <CardHeader>
            <div className="animate-pulse space-y-2">
              <div className="h-5 w-1/3 rounded bg-neutral-200"></div>
              <div className="h-4 w-1/2 rounded bg-neutral-200"></div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-1/4 rounded bg-neutral-200"></div>
                  <div className="h-6 w-1/3 rounded bg-neutral-200"></div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
          <p className="text-sm text-neutral-600">{period}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-neutral-600">Revenue</h4>
                {calculations?.revenueTrend &&
                  calculations.revenueTrend.direction !== "neutral" && (
                    <Badge
                      variant={calculations.revenueTrend.isPositive ? "default" : "destructive"}
                    >
                      {calculations.revenueTrend.isPositive ? "+" : "-"}
                      {formatPercentage(calculations.revenueTrend.percentage, 1)}
                    </Badge>
                  )}
              </div>
              <p className="mt-1 text-xl font-bold text-green-600">{formattedValues.revenue}</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-neutral-600">Expenses</h4>
                {calculations?.expenseTrend &&
                  calculations.expenseTrend.direction !== "neutral" && (
                    <Badge
                      variant={calculations.expenseTrend.isPositive ? "destructive" : "default"}
                    >
                      {calculations.expenseTrend.isPositive ? "+" : "-"}
                      {formatPercentage(calculations.expenseTrend.percentage, 1)}
                    </Badge>
                  )}
              </div>
              <p className="mt-1 text-xl font-bold text-red-600">{formattedValues.expenses}</p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-neutral-600">Net Profit</h4>
                {calculations?.profitTrend && calculations.profitTrend.direction !== "neutral" && (
                  <Badge variant={calculations.profitTrend.isPositive ? "default" : "destructive"}>
                    {calculations.profitTrend.isPositive ? "+" : "-"}
                    {formatPercentage(calculations.profitTrend.percentage, 1)}
                  </Badge>
                )}
              </div>
              <p
                className={`mt-1 text-xl font-bold ${profit.isNegative() ? "text-red-600" : "text-green-600"}`}
              >
                {formattedValues.profit}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Profit Margin</span>
              <span className="font-medium">{formattedValues.profitMargin}</span>
            </div>
            <Progress value={Math.max(0, Math.min(100, profitMargin))} className="h-2" />

            {calculations && (
              <div className="flex justify-between text-sm text-neutral-500">
                <span>Expense Ratio</span>
                <span>{formatPercentage(calculations.expenseRatio, 1)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

MemoizedFinancialSummary.displayName = "MemoizedFinancialSummary";

/**
 * Memoized Tax Calculation Component
 */
export const MemoizedTaxCalculation = memo<MemoizedTaxCalculationProps>(
  ({ grossIncome, vatRate, ewtRate, otherTaxes, netTaxDue, dueDate, status }) => {
    const calculations = useMemo(() => {
      const vatAmount = grossIncome.multiply(new Money(vatRate / 100, "PHP"));
      const ewtAmount = grossIncome.multiply(new Money(ewtRate / 100, "PHP"));
      const totalTaxes = vatAmount.add(ewtAmount).add(otherTaxes);

      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      const isOverdue = daysUntilDue < 0;
      const isUrgent = daysUntilDue <= 7 && daysUntilDue >= 0;

      return {
        vatAmount,
        ewtAmount,
        totalTaxes,
        daysUntilDue,
        isOverdue,
        isUrgent,
      };
    }, [grossIncome, vatRate, ewtRate, otherTaxes, dueDate]);

    const statusColor = useMemo(() => {
      const colors = {
        pending: "border-yellow-200 bg-yellow-50",
        filed: "border-green-200 bg-green-50",
        overdue: "border-red-200 bg-red-50",
      };
      return colors[status];
    }, [status]);

    const urgencyBadge = useMemo(() => {
      if (calculations.isOverdue) return { variant: "destructive" as const, text: "OVERDUE" };
      if (calculations.isUrgent) return { variant: "outline" as const, text: "DUE SOON" };
      return null;
    }, [calculations.isOverdue, calculations.isUrgent]);

    return (
      <Card className={statusColor}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">BIR Tax Calculation</CardTitle>
            {urgencyBadge && <Badge variant={urgencyBadge.variant}>{urgencyBadge.text}</Badge>}
          </div>
          <p className="text-sm text-neutral-600">
            Due: {formatBusinessDate(dueDate, "long")}
            {calculations.daysUntilDue > 0 && ` (${calculations.daysUntilDue} days)`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-neutral-600">Gross Income</span>
              <p className="font-semibold">{grossIncome.format({ precision: 2 })}</p>
            </div>

            <div>
              <span className="text-neutral-600">VAT ({formatPercentage(vatRate)})</span>
              <p className="font-semibold">{calculations.vatAmount.format({ precision: 2 })}</p>
            </div>

            <div>
              <span className="text-neutral-600">EWT ({formatPercentage(ewtRate)})</span>
              <p className="font-semibold">{calculations.ewtAmount.format({ precision: 2 })}</p>
            </div>

            <div>
              <span className="text-neutral-600">Other Taxes</span>
              <p className="font-semibold">{otherTaxes.format({ precision: 2 })}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold">Net Tax Due</span>
              <span className="text-xl font-bold text-red-600">
                {netTaxDue.format({ precision: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

MemoizedTaxCalculation.displayName = "MemoizedTaxCalculation";

/**
 * Memoized Payment Breakdown with chart-ready data
 */
export const MemoizedPaymentBreakdown = memo<MemoizedPaymentBreakdownProps>(
  ({ payments, total, showChart = false }) => {
    const sortedPayments = useMemo(() => {
      return [...payments].sort((a, b) => b.amount.subtract(a.amount).toNumber());
    }, [payments]);

    const chartData = useMemo(() => {
      if (!showChart) return null;

      return sortedPayments.map((payment) => ({
        name: payment.method,
        value: payment.amount.toNumber(),
        percentage: payment.percentage,
        count: payment.count,
      }));
    }, [sortedPayments, showChart]);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
          <p className="text-sm text-neutral-600">Total: {total.format({ precision: 0 })}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sortedPayments.map((payment) => (
              <div key={payment.method} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{payment.method}</p>
                    <p className="text-xs text-neutral-500">{payment.count} transactions</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold">{payment.amount.format({ precision: 0 })}</p>
                  <p className="text-xs text-neutral-500">
                    {formatPercentage(payment.percentage, 1)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Chart data would be used by external chart component */}
          {chartData && (
            <div className="mt-4 text-xs text-neutral-500">Chart data ready for visualization</div>
          )}
        </CardContent>
      </Card>
    );
  }
);

MemoizedPaymentBreakdown.displayName = "MemoizedPaymentBreakdown";

// Export all memoized components
export {
  MemoizedMetricCard,
  MemoizedTransactionRow,
  MemoizedFinancialSummary,
  MemoizedTaxCalculation,
  MemoizedPaymentBreakdown,
};

// Export utility functions for external use
export { formatPercentage, formatBusinessDate, calculateTrend };
