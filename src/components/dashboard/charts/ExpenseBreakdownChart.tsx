/**
 * ExpenseBreakdownChart Component
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Horizontal bar chart for expense category breakdown with Professional Enterprise Design System
 * - Information-dense visualization for operational efficiency
 * - Philippine peso formatting with proper scaling
 * - Category-based expense analysis with budget comparisons
 * - Mobile-responsive design for resort staff
 */

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Money } from "@/lib/money";
import {
  formatPhilippinePeso,
  formatPercentage,
  getStatusColor,
} from "@/utils/dashboard-formatters";

interface ExpenseCategoryData {
  category: string;
  amount: Money | number;
  budget?: Money | number;
  previousAmount?: Money | number;
  color?: string;
  subcategories?: Array<{
    name: string;
    amount: Money | number;
    percentage: number;
  }>;
}

interface ExpenseBreakdownChartProps {
  data: ExpenseCategoryData[];
  title?: string;
  totalBudget?: Money | number;
  loading?: boolean;
  error?: string | null;
  height?: number;
  className?: string;
  showBudgetComparison?: boolean;
  showPercentages?: boolean;
  maxCategories?: number;
  onCategoryClick?: (category: ExpenseCategoryData, index: number) => void;
}

interface ExpenseSummary {
  totalSpent: Money;
  totalBudget: Money;
  budgetUtilization: number;
  overBudgetCategories: number;
  largestExpense: {
    category: string;
    amount: Money;
    percentage: number;
  };
}

// Default category colors for consistent branding
const DEFAULT_COLORS = [
  "#ef4444", // red-500 - Critical expenses
  "#f97316", // orange-500 - High expenses
  "#eab308", // yellow-500 - Medium expenses
  "#22c55e", // green-500 - Low expenses
  "#3b82f6", // blue-500 - Operational
  "#8b5cf6", // violet-500 - Administrative
  "#06b6d4", // cyan-500 - Maintenance
  "#84cc16", // lime-500 - Utilities
];

const ExpenseBreakdownChart: React.FC<ExpenseBreakdownChartProps> = ({
  data,
  title = "Expense Breakdown",
  totalBudget,
  loading = false,
  error = null,
  height = 320,
  className = "",
  showBudgetComparison = true,
  showPercentages = true,
  maxCategories = 8,
  onCategoryClick,
}) => {
  // Process and sort expense data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Convert amounts to numbers and sort by amount (descending)
    const processed = data
      .map((item, index) => ({
        ...item,
        amount: typeof item.amount === "number" ? new Money(item.amount * 100) : item.amount,
        budget: item.budget
          ? typeof item.budget === "number"
            ? new Money(item.budget * 100)
            : item.budget
          : undefined,
        previousAmount: item.previousAmount
          ? typeof item.previousAmount === "number"
            ? new Money(item.previousAmount * 100)
            : item.previousAmount
          : undefined,
        color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
        numericAmount: typeof item.amount === "number" ? item.amount : item.amount.toNumber(),
      }))
      .sort((a, b) => b.numericAmount - a.numericAmount)
      .slice(0, maxCategories);

    return processed;
  }, [data, maxCategories]);

  // Calculate summary metrics
  const expenseSummary = useMemo((): ExpenseSummary | null => {
    if (!processedData || processedData.length === 0) return null;

    const totalSpent = processedData.reduce((sum, item) => sum.add(item.amount), new Money(0));

    const totalBudgetAmount = totalBudget
      ? typeof totalBudget === "number"
        ? new Money(totalBudget * 100)
        : totalBudget
      : processedData.reduce((sum, item) => {
          const budget = item.budget || new Money(0);
          return sum.add(budget);
        }, new Money(0));

    const budgetUtilization =
      totalBudgetAmount.toNumber() > 0
        ? (totalSpent.toNumber() / totalBudgetAmount.toNumber()) * 100
        : 0;

    const overBudgetCategories = processedData.filter((item) => {
      if (!item.budget) return false;
      return item.amount.toNumber() > item.budget.toNumber();
    }).length;

    const largestExpense = processedData[0];
    const largestPercentage =
      totalSpent.toNumber() > 0
        ? (largestExpense.amount.toNumber() / totalSpent.toNumber()) * 100
        : 0;

    return {
      totalSpent,
      totalBudget: totalBudgetAmount,
      budgetUtilization,
      overBudgetCategories,
      largestExpense: {
        category: largestExpense.category,
        amount: largestExpense.amount,
        percentage: largestPercentage,
      },
    };
  }, [processedData, totalBudget]);

  // Calculate chart dimensions
  const maxAmount = useMemo(() => {
    if (!processedData || processedData.length === 0) return 0;
    return Math.max(...processedData.map((item) => item.numericAmount));
  }, [processedData]);

  // Loading state
  if (loading) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="h-6 w-3/4 animate-pulse rounded bg-neutral-200" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
                <div className="h-6 animate-pulse rounded bg-neutral-200" />
              </div>
            ))}
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
              <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
              <p className="text-sm text-red-600">Error loading expense data</p>
              <p className="text-xs text-neutral-500">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!processedData || processedData.length === 0) {
    return (
      <Card className={`${className}`}>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-center">
            <div className="space-y-2">
              <p className="text-sm text-neutral-500">No expense data available</p>
              <p className="text-xs text-neutral-400">
                Expenses will appear when transactions are recorded
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`} data-testid="expense-breakdown-chart">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>

          {/* Budget Status Badge */}
          {expenseSummary && showBudgetComparison && (
            <Badge
              variant="outline"
              className={`gap-1 ${
                expenseSummary.budgetUtilization > 100
                  ? "border-red-200 bg-red-50 text-red-600"
                  : expenseSummary.budgetUtilization > 80
                    ? "border-yellow-200 bg-yellow-50 text-yellow-600"
                    : "border-green-200 bg-green-50 text-green-600"
              }`}
            >
              {expenseSummary.budgetUtilization > 100 && <AlertTriangle className="h-3 w-3" />}
              {expenseSummary.budgetUtilization.toFixed(0)}% Budget
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Summary Metrics */}
          {expenseSummary && (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-neutral-500">Total Spent</div>
                <div className="font-mono font-semibold" data-testid="expense-total">
                  {formatPhilippinePeso(expenseSummary.totalSpent, { compact: true })}
                </div>
              </div>

              {showBudgetComparison && (
                <div>
                  <div className="text-xs font-medium text-neutral-500">Total Budget</div>
                  <div className="font-mono text-neutral-600" data-testid="expense-budget">
                    {formatPhilippinePeso(expenseSummary.totalBudget, { compact: true })}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-neutral-500">Largest Category</div>
                <div className="font-medium" data-testid="largest-category">
                  {expenseSummary.largestExpense.category}
                </div>
                <div className="text-xs text-neutral-400">
                  {formatPercentage(expenseSummary.largestExpense.percentage, 1)}
                </div>
              </div>

              {expenseSummary.overBudgetCategories > 0 && (
                <div>
                  <div className="text-xs font-medium text-neutral-500">Over Budget</div>
                  <div className="font-medium text-red-600" data-testid="over-budget-count">
                    {expenseSummary.overBudgetCategories} categories
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Horizontal Bar Chart */}
          <div className="space-y-3" style={{ height: height - 160 }}>
            {processedData.map((category, index) => {
              const percentage = maxAmount > 0 ? (category.numericAmount / maxAmount) * 100 : 0;
              const totalSpentAmount =
                expenseSummary?.totalSpent.toNumber() || category.numericAmount;
              const categoryPercentage =
                totalSpentAmount > 0 ? (category.numericAmount / totalSpentAmount) * 100 : 0;

              const isOverBudget =
                category.budget && category.amount.toNumber() > category.budget.toNumber();
              const budgetUsage = category.budget
                ? (category.amount.toNumber() / category.budget.toNumber()) * 100
                : null;

              return (
                <div
                  key={category.category}
                  className={`space-y-1 ${onCategoryClick ? "cursor-pointer rounded p-2 hover:bg-neutral-50" : ""}`}
                  onClick={() => onCategoryClick?.(category, index)}
                  data-testid={`expense-category-${index}`}
                >
                  {/* Category Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-sm"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm font-medium text-neutral-700">
                        {category.category}
                      </span>
                      {isOverBudget && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-mono font-semibold">
                        {formatPhilippinePeso(category.amount, { compact: true })}
                      </span>
                      {showPercentages && (
                        <span className="font-mono text-xs text-neutral-500">
                          {formatPercentage(categoryPercentage, 1)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="relative h-6 w-full overflow-hidden rounded-full bg-neutral-200">
                      <div
                        className="flex h-6 items-center justify-end rounded-full pr-2 transition-all duration-500"
                        style={{
                          width: `${Math.max(percentage, 8)}%`, // Minimum 8% width for visibility
                          backgroundColor: category.color,
                          opacity: isOverBudget ? 0.9 : 0.8,
                        }}
                      >
                        <span className="text-xs font-medium text-white">
                          {formatPhilippinePeso(category.amount, {
                            compact: true,
                            showCurrency: false,
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Budget Comparison */}
                    {showBudgetComparison && category.budget && (
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          Budget: {formatPhilippinePeso(category.budget, { compact: true })}
                        </span>
                        <span
                          className={`font-mono ${isOverBudget ? "text-red-600" : "text-neutral-600"}`}
                        >
                          {budgetUsage !== null ? `${budgetUsage.toFixed(0)}%` : "—"}
                        </span>
                      </div>
                    )}

                    {/* Previous Period Comparison */}
                    {category.previousAmount && category.previousAmount.toNumber() > 0 && (
                      <div className="flex items-center justify-between text-xs text-neutral-500">
                        <span>
                          Previous:{" "}
                          {formatPhilippinePeso(category.previousAmount, { compact: true })}
                        </span>
                        <div
                          className={`flex items-center gap-1 ${
                            category.amount.toNumber() > category.previousAmount.toNumber()
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          <TrendingUp
                            className={`h-3 w-3 ${
                              category.amount.toNumber() <= category.previousAmount.toNumber()
                                ? "rotate-180"
                                : ""
                            }`}
                          />
                          <span className="font-mono">
                            {formatPercentage(
                              Math.abs(
                                ((category.amount.toNumber() - category.previousAmount.toNumber()) /
                                  category.previousAmount.toNumber()) *
                                  100
                              ),
                              1
                            )}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chart Legend */}
          <div className="border-t border-neutral-200 pt-3">
            <div className="flex flex-wrap gap-4 text-xs text-neutral-500">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-neutral-400" />
                <span>Amount spent per category</span>
              </div>
              {showBudgetComparison && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-500" />
                  <span>Over budget</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpenseBreakdownChart;
export type { ExpenseBreakdownChartProps, ExpenseCategoryData, ExpenseSummary };
