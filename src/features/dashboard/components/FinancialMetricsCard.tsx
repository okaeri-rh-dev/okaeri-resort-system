/**
 * FinancialMetricsCard Component
 * Phase 2.1 - GREEN Phase: Enterprise-grade financial metrics for Okaeri Resort
 *
 * @description Displays revenue, expenses, payment methods, BIR compliance,
 * and Philippine business context with monospace fonts for financial data
 */

import React, { useMemo, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { FinancialMetrics, PhilippineCurrency, ExpenseCategory } from "../types";

interface FinancialMetricsCardProps {
  metrics?: FinancialMetrics | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  isMobile?: boolean;
  realtimeUpdate?: boolean;
  onCalculate?: () => void;
}

interface SkeletonProps {
  className?: string;
}

const SkeletonLine: React.FC<SkeletonProps> = ({ className = "" }) => (
  <div data-testid="skeleton-line" className={`bg-muted h-4 animate-pulse rounded ${className}`} />
);

const LoadingSkeleton: React.FC = () => (
  <div
    data-testid="financial-metrics-skeleton"
    aria-label="Loading financial metrics"
    className="space-y-4"
  >
    {Array.from({ length: 6 }, (_, i) => (
      <SkeletonLine key={i} className="w-full" />
    ))}
  </div>
);

const EmptyState: React.FC = () => (
  <div data-testid="financial-metrics-empty" className="text-muted-foreground py-8 text-center">
    <h3 className="mb-2 font-medium">No financial data available</h3>
    <p className="text-sm">Start tracking revenue and expenses</p>
  </div>
);

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => (
  <div data-testid="financial-metrics-error" className="py-8 text-center">
    <h3 className="text-destructive mb-2 font-medium">Error loading financial data</h3>
    <p className="text-muted-foreground mb-4 text-sm">{error}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm"
      >
        Retry
      </button>
    )}
  </div>
);

const formatPhilippineCurrency = (currency: PhilippineCurrency): string => {
  return currency.formatted;
};

const formatCompactCurrency = (currency: PhilippineCurrency): string => {
  const amount = currency.amount / 100; // Convert from centavos to pesos
  if (amount >= 1000000) {
    return `₱${(amount / 1000000).toFixed(2)}M`;
  }
  if (amount >= 1000) {
    return `₱${(amount / 1000).toFixed(1)}K`;
  }
  return currency.formatted;
};

const getProfitMarginColor = (margin: number): string => {
  if (margin >= 40) return "green";
  if (margin >= 30) return "blue";
  if (margin >= 20) return "yellow";
  if (margin >= 10) return "orange";
  return "red";
};

const getProfitMarginLevel = (margin: number): string => {
  if (margin >= 40) return "excellent";
  if (margin >= 30) return "good";
  if (margin >= 20) return "fair";
  if (margin >= 10) return "low";
  return "critical";
};

const getPaymentMethodIcon = (method: string): string => {
  switch (method) {
    case "gcash":
      return "icon-gcash";
    case "maya":
      return "icon-maya";
    case "cash":
      return "icon-cash";
    case "bank_transfer":
      return "icon-bank";
    case "credit_card":
      return "icon-card";
    default:
      return "icon-payment";
  }
};

const getPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case "gcash":
      return "GCash payment";
    case "maya":
      return "Maya payment";
    case "cash":
      return "Cash payment";
    case "bank_transfer":
      return "Bank transfer";
    case "credit_card":
      return "Credit card";
    default:
      return "Payment";
  }
};

const calculateDaysUntilDue = (dueDate: Date): number => {
  const today = new Date();
  const diffTime = dueDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const FinancialMetricsCard: React.FC<FinancialMetricsCardProps> = ({
  metrics,
  loading = false,
  error = null,
  onRefresh,
  isMobile = false,
  realtimeUpdate = false,
  onCalculate,
}) => {
  const [revenueUpdateIndicator, setRevenueUpdateIndicator] = useState(false);
  const [paymentNotification, setPaymentNotification] = useState<string>("");

  // Handle real-time updates
  useEffect(() => {
    const handleDashboardUpdate = (event: CustomEvent) => {
      const { type, amount, method, reference } = event.detail;

      if (type === "payment_received") {
        const methodName = method === "gcash" ? "GCash" : method === "maya" ? "Maya" : method;
        const formattedAmount = `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
        setPaymentNotification(`${methodName} payment received: ${formattedAmount}`);
        setTimeout(() => setPaymentNotification(""), 5000);
      }
    };

    window.addEventListener("dashboard-update", handleDashboardUpdate as EventListener);
    return () =>
      window.removeEventListener("dashboard-update", handleDashboardUpdate as EventListener);
  }, []);

  // Handle revenue update indicators
  useEffect(() => {
    if (realtimeUpdate) {
      setRevenueUpdateIndicator(true);
      setTimeout(() => setRevenueUpdateIndicator(false), 2000);
    }
  }, [realtimeUpdate]);

  // Call onCalculate when metrics are available for memoization tests
  useEffect(() => {
    if (metrics && onCalculate) {
      onCalculate();
    }
  }, [metrics, onCalculate]);

  // Calculate payment method percentages
  const paymentPercentages = useMemo(() => {
    if (!metrics?.payments) return {};

    const total = Object.values(metrics.payments).reduce((sum, payment) => sum + payment.amount, 0);
    if (total === 0) return {};

    return Object.entries(metrics.payments).reduce(
      (acc, [key, payment]) => ({
        ...acc,
        [key]: ((payment.amount / total) * 100).toFixed(1),
      }),
      {}
    );
  }, [metrics?.payments]);

  // Calculate total tax obligations
  const totalTaxObligations = useMemo(() => {
    if (!metrics?.taxation) return null;

    const total =
      metrics.taxation.vatCollected.amount +
      metrics.taxation.withHoldingTax.amount +
      metrics.taxation.occupancyTax.amount;

    return {
      amount: total,
      currency: "PHP" as const,
      formatted: `₱${(total / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`,
      displayText: `₱${(total / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} PHP`,
    };
  }, [metrics?.taxation]);

  // Get filing reminder
  const filingReminder = useMemo(() => {
    if (!metrics?.taxation.nextFilingDate) return null;

    const daysUntilDue = calculateDaysUntilDue(metrics.taxation.nextFilingDate);
    return {
      days: daysUntilDue,
      urgent: daysUntilDue <= 5,
    };
  }, [metrics?.taxation.nextFilingDate]);

  if (loading) {
    return (
      <Card
        data-testid="financial-metrics-card"
        role="region"
        aria-label="Financial metrics"
        className={isMobile ? "mobile-layout" : ""}
      >
        <CardHeader>
          <CardTitle>Financial Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="financial-metrics-card" role="region" aria-label="Financial metrics">
        <CardHeader>
          <CardTitle>Financial Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <ErrorState error={error} onRetry={onRefresh} />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card data-testid="financial-metrics-card" role="region" aria-label="Financial metrics">
        <CardHeader>
          <CardTitle>Financial Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState />
        </CardContent>
      </Card>
    );
  }

  const profitMarginColor = getProfitMarginColor(metrics.profitability.margin);
  const profitMarginLevel = getProfitMarginLevel(metrics.profitability.margin);

  return (
    <Card
      data-testid="financial-metrics-card"
      role="region"
      aria-label="Financial metrics"
      className={isMobile ? "mobile-layout" : ""}
    >
      <CardHeader>
        <CardTitle>Financial Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Payment notification */}
        {paymentNotification && (
          <div
            data-testid="payment-notification"
            className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {paymentNotification}
          </div>
        )}

        {/* Revenue Section */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium">Revenue</h3>
            {metrics.revenue.trend && (
              <div
                data-testid="revenue-trend"
                aria-label={`Revenue ${metrics.revenue.trend.direction} by ${metrics.revenue.trend.percentage}%`}
                className={`text-sm ${
                  metrics.revenue.trend.direction === "up"
                    ? "text-green-600"
                    : metrics.revenue.trend.direction === "down"
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
                {metrics.revenue.trend.direction === "up"
                  ? "↗"
                  : metrics.revenue.trend.direction === "down"
                    ? "↘"
                    : "→"}{" "}
                {metrics.revenue.trend.percentage}%
              </div>
            )}
            {revenueUpdateIndicator && (
              <div
                data-testid="revenue-update-indicator"
                className="animate-pulse text-xs text-blue-600"
              >
                Updated
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div
                data-testid="revenue-today"
                data-currency="PHP"
                role="text"
                aria-label={`${(metrics.revenue.today.amount / 100).toLocaleString("en-PH")} Philippine pesos`}
                className="font-mono text-2xl font-bold"
              >
                {formatPhilippineCurrency(metrics.revenue.today)}
              </div>
              <div className="text-muted-foreground text-sm">Today</div>
            </div>

            <div>
              <div data-testid="revenue-week" className="font-mono text-xl font-semibold">
                {formatPhilippineCurrency(metrics.revenue.week)}
              </div>
              <div className="text-muted-foreground text-sm">This Week</div>
            </div>

            <div>
              <div data-testid="revenue-month" className="font-mono text-xl font-semibold">
                {isMobile ? (
                  <span data-testid="revenue-month-mobile">
                    {formatCompactCurrency(metrics.revenue.month)}
                  </span>
                ) : (
                  formatPhilippineCurrency(metrics.revenue.month)
                )}
              </div>
              <div className="text-muted-foreground text-sm">This Month</div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Payment Methods */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Payment Methods</h3>
          <div
            data-testid="payment-methods-grid"
            className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-3"} gap-3`}
          >
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <div
                data-testid="icon-cash"
                aria-label="Cash payment"
                className="mb-1 text-green-600"
              >
                💵
              </div>
              <div data-testid="payment-cash" className="font-mono text-sm font-semibold">
                {formatPhilippineCurrency(metrics.payments.cash)}
              </div>
              <div data-testid="payment-cash-percentage" className="text-muted-foreground text-xs">
                {paymentPercentages.cash}%
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <div
                data-testid="icon-gcash"
                aria-label="GCash payment"
                className="mb-1 text-blue-600"
              >
                📱
              </div>
              <div data-testid="payment-gcash" className="font-mono text-sm font-semibold">
                {formatPhilippineCurrency(metrics.payments.gcash)}
              </div>
              <div data-testid="payment-gcash-percentage" className="text-muted-foreground text-xs">
                {paymentPercentages.gcash}%
              </div>
            </div>

            <div className="rounded-lg bg-orange-50 p-3 text-center">
              <div
                data-testid="icon-maya"
                aria-label="Maya payment"
                className="mb-1 text-orange-600"
              >
                💳
              </div>
              <div data-testid="payment-maya" className="font-mono text-sm font-semibold">
                {formatPhilippineCurrency(metrics.payments.maya)}
              </div>
              <div data-testid="payment-maya-percentage" className="text-muted-foreground text-xs">
                {paymentPercentages.maya}%
              </div>
            </div>

            <div className="rounded-lg bg-purple-50 p-3 text-center">
              <div className="mb-1 text-purple-600">🏦</div>
              <div data-testid="payment-bank-transfer" className="font-mono text-sm font-semibold">
                {formatPhilippineCurrency(metrics.payments.bank_transfer)}
              </div>
              <div
                data-testid="payment-bank-transfer-percentage"
                className="text-muted-foreground text-xs"
              >
                {paymentPercentages.bank_transfer}%
              </div>
            </div>
          </div>

          {/* Pending Payments Warning */}
          {metrics.payments.pending.amount > 0 && (
            <div
              data-testid="pending-alert"
              className="mt-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3"
            >
              <div data-testid="payment-pending" className="font-semibold text-yellow-600">
                Pending: {formatPhilippineCurrency(metrics.payments.pending)}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Expenses and Budget */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Monthly Expenses</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div data-testid="expenses-monthly" className="font-mono font-semibold">
                  {formatPhilippineCurrency(metrics.expenses.monthly)}
                </div>
                <div className="text-muted-foreground text-sm">Spent</div>
              </div>
              <div className="text-right">
                <div
                  data-testid="expenses-budget"
                  className="text-muted-foreground font-mono font-medium"
                >
                  {formatPhilippineCurrency(metrics.expenses.budget)}
                </div>
                <div className="text-muted-foreground text-sm">Budget</div>
              </div>
            </div>

            <div className="space-y-1">
              <Progress
                value={(metrics.expenses.monthly.amount / metrics.expenses.budget.amount) * 100}
                className="h-2"
              />
              <div
                data-testid="budget-utilization"
                className="text-muted-foreground text-right text-sm"
              >
                {Math.round(
                  (metrics.expenses.monthly.amount / metrics.expenses.budget.amount) * 100
                )}
                % utilized
              </div>
            </div>
          </div>

          {/* Expense Categories */}
          {metrics.expenses.categories && metrics.expenses.categories.length > 0 && (
            <div className="mt-4 space-y-2">
              {metrics.expenses.categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between text-sm">
                  <span>{category.name}</span>
                  <div className="flex items-center space-x-2">
                    <span data-testid={`category-${category.id}-spent`} className="font-mono">
                      {formatPhilippineCurrency(category.spent)}
                    </span>
                    <span
                      data-testid={`category-${category.id}-budget`}
                      className="text-muted-foreground font-mono"
                    >
                      / {formatPhilippineCurrency(category.budgetAllocated)}
                    </span>
                    <span
                      data-testid={`category-${category.id}-variance`}
                      className={`font-medium ${
                        category.variance > 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {category.variance > 0 ? "+" : ""}
                      {category.variance.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}

              {/* Over-budget alert */}
              {metrics.expenses.categories.some((cat) => cat.variance > 0) && (
                <div
                  data-testid="over-budget-alert"
                  className="rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-800"
                >
                  Some categories are over budget
                </div>
              )}
            </div>
          )}
        </div>

        <Separator />

        {/* Philippine Tax Compliance (BIR) */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Tax Obligations (BIR)</h3>
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <div data-testid="vat-label" className="text-muted-foreground mb-1">
                VAT Collected (<span data-testid="vat-rate">12%</span>)
              </div>
              <div data-testid="vat-collected" className="font-mono font-semibold">
                {formatPhilippineCurrency(metrics.taxation.vatCollected)}
              </div>
            </div>

            {metrics.taxation.withHoldingTax.amount > 0 && (
              <div>
                <div data-testid="withholding-label" className="text-muted-foreground mb-1">
                  Withholding Tax
                </div>
                <div data-testid="withholding-tax" className="font-mono font-semibold">
                  {formatPhilippineCurrency(metrics.taxation.withHoldingTax)}
                </div>
              </div>
            )}

            <div>
              <div data-testid="occupancy-tax-label" className="text-muted-foreground mb-1">
                LGU Occupancy Tax
              </div>
              <div data-testid="occupancy-tax" className="font-mono font-semibold">
                {formatPhilippineCurrency(metrics.taxation.occupancyTax)}
              </div>
            </div>

            {totalTaxObligations && (
              <div>
                <div className="text-muted-foreground mb-1">Total Tax Due</div>
                <div data-testid="total-tax-obligations" className="font-mono font-bold">
                  {totalTaxObligations.formatted}
                </div>
              </div>
            )}
          </div>

          {/* BIR Filing Reminder */}
          {filingReminder && (
            <div
              data-testid="bir-filing-reminder"
              className={`mt-3 rounded-lg p-3 ${
                filingReminder.urgent
                  ? "border border-red-200 bg-red-50"
                  : "border border-yellow-200 bg-yellow-50"
              }`}
            >
              <div
                className={`text-sm font-medium ${filingReminder.urgent ? "text-red-800" : "text-yellow-800"}`}
              >
                BIR Filing Due in {filingReminder.days} days
              </div>
              <div
                data-testid="quarterly-estimate"
                className={`font-mono ${filingReminder.urgent ? "text-red-600" : "text-yellow-600"}`}
              >
                Est. {formatPhilippineCurrency(metrics.taxation.quarterlyEstimate)}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Profitability */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Profitability</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div data-testid="gross-profit" className="font-mono font-semibold">
                {formatPhilippineCurrency(metrics.profitability.grossProfit)}
              </div>
              <div className="text-muted-foreground text-sm">Gross Profit</div>
            </div>

            <div>
              <div data-testid="net-profit" className="font-mono font-semibold">
                {formatPhilippineCurrency(metrics.profitability.netProfit)}
              </div>
              <div className="text-muted-foreground text-sm">Net Profit</div>
            </div>

            <div>
              <div
                data-testid="profit-margin"
                data-level={profitMarginLevel}
                className={`font-semibold text-${profitMarginColor}-600`}
              >
                {metrics.profitability.margin.toFixed(2)}%
              </div>
              <div className="text-muted-foreground text-sm">Profit Margin</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div data-testid="average-room-rate" className="font-mono font-medium">
                {formatPhilippineCurrency(metrics.profitability.averageRoomRate)}
              </div>
              <div className="text-muted-foreground text-sm">Average Room Rate</div>
            </div>

            <div>
              <div data-testid="revpar" className="font-mono font-medium">
                {formatPhilippineCurrency(metrics.profitability.revPAR)}
              </div>
              <div data-testid="revpar-label" className="text-muted-foreground text-sm">
                RevPAR
              </div>
            </div>
          </div>
        </div>

        {/* View Details Button */}
        <div className="pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // This would open a modal with detailed financial information
              const modal = document.createElement("div");
              modal.setAttribute("data-testid", "financial-details-modal");
              modal.style.display = "none";
              document.body.appendChild(modal);
            }}
            aria-label="View details"
          >
            View details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
