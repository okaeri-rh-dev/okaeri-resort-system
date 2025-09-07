/**
 * PaymentMethodChart Component
 * Phase 4.4 Week 1.2 - Professional Enterprise Dashboard Components
 *
 * Payment method pie chart with Philippine digital payment integration (GCash/Maya)
 * - Information-dense visualization for business operations
 * - Philippine payment method context (GCash, Maya, cash, bank transfer)
 * - Professional styling following Enterprise Design System
 * - Mobile-responsive design for resort staff
 */

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Smartphone, Banknote, CreditCard, Building } from "lucide-react";
import { Money } from "@/lib/money";
import {
  formatPhilippinePeso,
  formatPaymentMethod,
  formatPercentage,
} from "@/utils/dashboard-formatters";

interface PaymentMethodData {
  method: string;
  amount: Money | number;
  count: number;
  previousAmount?: Money | number;
  color?: string;
}

interface PaymentMethodChartProps {
  data: PaymentMethodData[];
  title?: string;
  loading?: boolean;
  error?: string | null;
  size?: number;
  className?: string;
  showTransactionCount?: boolean;
  showTrends?: boolean;
  onMethodClick?: (method: PaymentMethodData, index: number) => void;
}

interface PaymentSummary {
  totalAmount: Money;
  totalTransactions: number;
  digitalPaymentPercentage: number;
  mostPopularMethod: {
    method: string;
    amount: Money;
    percentage: number;
    count: number;
  };
  averageTransactionValue: Money;
}

// Payment method configurations for Philippine context
const PAYMENT_METHOD_CONFIG = {
  cash: {
    label: "Cash",
    icon: Banknote,
    color: "#22c55e", // green-500
    isDigital: false,
  },
  gcash: {
    label: "GCash",
    icon: Smartphone,
    color: "#3b82f6", // blue-500
    isDigital: true,
  },
  maya: {
    label: "Maya",
    icon: Smartphone,
    color: "#f97316", // orange-500
    isDigital: true,
  },
  paymaya: {
    label: "Maya",
    icon: Smartphone,
    color: "#f97316", // orange-500
    isDigital: true,
  },
  bank_transfer: {
    label: "Bank Transfer",
    icon: Building,
    color: "#8b5cf6", // violet-500
    isDigital: true,
  },
  credit_card: {
    label: "Credit Card",
    icon: CreditCard,
    color: "#06b6d4", // cyan-500
    isDigital: true,
  },
  debit_card: {
    label: "Debit Card",
    icon: CreditCard,
    color: "#06b6d4", // cyan-500
    isDigital: true,
  },
  online_banking: {
    label: "Online Banking",
    icon: Building,
    color: "#84cc16", // lime-500
    isDigital: true,
  },
};

const PaymentMethodChart: React.FC<PaymentMethodChartProps> = ({
  data,
  title = "Payment Methods",
  loading = false,
  error = null,
  size = 200,
  className = "",
  showTransactionCount = true,
  showTrends = true,
  onMethodClick,
}) => {
  // Process payment data
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    return data
      .map((item) => {
        const config = PAYMENT_METHOD_CONFIG[item.method.toLowerCase()] || {
          label: formatPaymentMethod(item.method),
          icon: CreditCard,
          color: "#6b7280", // gray-500
          isDigital: false,
        };

        return {
          ...item,
          amount: typeof item.amount === "number" ? new Money(item.amount * 100) : item.amount,
          previousAmount: item.previousAmount
            ? typeof item.previousAmount === "number"
              ? new Money(item.previousAmount * 100)
              : item.previousAmount
            : undefined,
          config,
          numericAmount: typeof item.amount === "number" ? item.amount : item.amount.toNumber(),
        };
      })
      .sort((a, b) => b.numericAmount - a.numericAmount);
  }, [data]);

  // Calculate summary metrics
  const paymentSummary = useMemo((): PaymentSummary | null => {
    if (!processedData || processedData.length === 0) return null;

    const totalAmount = processedData.reduce((sum, item) => sum.add(item.amount), new Money(0));
    const totalTransactions = processedData.reduce((sum, item) => sum + item.count, 0);

    const digitalMethods = processedData.filter((item) => item.config.isDigital);
    const digitalAmount = digitalMethods.reduce((sum, item) => sum.add(item.amount), new Money(0));
    const digitalPaymentPercentage =
      totalAmount.toNumber() > 0 ? (digitalAmount.toNumber() / totalAmount.toNumber()) * 100 : 0;

    const mostPopularMethod = processedData[0];
    const mostPopularPercentage =
      totalAmount.toNumber() > 0
        ? (mostPopularMethod.amount.toNumber() / totalAmount.toNumber()) * 100
        : 0;

    const averageTransactionValue =
      totalTransactions > 0 ? new Money(totalAmount.toNumber() / totalTransactions) : new Money(0);

    return {
      totalAmount,
      totalTransactions,
      digitalPaymentPercentage,
      mostPopularMethod: {
        method: mostPopularMethod.config.label,
        amount: mostPopularMethod.amount,
        percentage: mostPopularPercentage,
        count: mostPopularMethod.count,
      },
      averageTransactionValue,
    };
  }, [processedData]);

  // Generate pie chart segments
  const pieSegments = useMemo(() => {
    if (!processedData || processedData.length === 0 || !paymentSummary) return [];

    let cumulativeAngle = 0;
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    return processedData.map((item) => {
      const percentage = (item.numericAmount / paymentSummary.totalAmount.toNumber()) * 100;
      const angle = (percentage / 100) * 360;

      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;

      // Convert to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      // Calculate path coordinates
      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        "Z",
      ].join(" ");

      cumulativeAngle += angle;

      return {
        ...item,
        percentage,
        pathData,
        startAngle,
        endAngle,
      };
    });
  }, [processedData, paymentSummary, size]);

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
            <div
              className={`mx-auto animate-pulse rounded-full bg-neutral-200`}
              style={{ width: size, height: size }}
            />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-neutral-200" />
              ))}
            </div>
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
              <p className="text-sm text-red-600">Error loading payment data</p>
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
              <p className="text-sm text-neutral-500">No payment data available</p>
              <p className="text-xs text-neutral-400">
                Payment methods will appear when transactions are processed
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className}`} data-testid="payment-method-chart">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>

          {/* Digital Payment Badge */}
          {paymentSummary && (
            <Badge
              variant="outline"
              className={`gap-1 ${
                paymentSummary.digitalPaymentPercentage > 70
                  ? "border-green-200 bg-green-50 text-green-600"
                  : paymentSummary.digitalPaymentPercentage > 40
                    ? "border-blue-200 bg-blue-50 text-blue-600"
                    : "border-orange-200 bg-orange-50 text-orange-600"
              }`}
            >
              <Smartphone className="h-3 w-3" />
              {paymentSummary.digitalPaymentPercentage.toFixed(0)}% Digital
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Summary Metrics */}
          {paymentSummary && (
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs font-medium text-neutral-500">Total Value</div>
                <div className="font-mono font-semibold" data-testid="payment-total">
                  {formatPhilippinePeso(paymentSummary.totalAmount, { compact: true })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-neutral-500">Transactions</div>
                <div className="font-semibold" data-testid="transaction-count">
                  {paymentSummary.totalTransactions.toLocaleString()}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-neutral-500">Most Popular</div>
                <div className="font-medium" data-testid="most-popular-method">
                  {paymentSummary.mostPopularMethod.method}
                </div>
                <div className="text-xs text-neutral-400">
                  {formatPercentage(paymentSummary.mostPopularMethod.percentage, 1)}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium text-neutral-500">Avg. Transaction</div>
                <div className="font-mono font-medium" data-testid="average-transaction">
                  {formatPhilippinePeso(paymentSummary.averageTransactionValue, { compact: true })}
                </div>
              </div>
            </div>
          )}

          {/* Pie Chart and Legend Container */}
          <div className="flex flex-col items-center gap-6 lg:flex-row">
            {/* SVG Pie Chart */}
            <div className="flex-shrink-0">
              <svg
                width={size}
                height={size}
                className="drop-shadow-sm"
                data-testid="payment-pie-chart"
              >
                {pieSegments.map((segment, index) => (
                  <g key={segment.method}>
                    <path
                      d={segment.pathData}
                      fill={segment.config.color}
                      stroke="white"
                      strokeWidth="2"
                      className={`transition-opacity duration-200 ${
                        onMethodClick ? "cursor-pointer hover:opacity-80" : ""
                      }`}
                      onClick={() => onMethodClick?.(segment, index)}
                      data-testid={`payment-segment-${index}`}
                    >
                      <title>
                        {segment.config.label}: {formatPhilippinePeso(segment.amount)} (
                        {formatPercentage(segment.percentage, 1)})
                      </title>
                    </path>
                  </g>
                ))}

                {/* Center Circle for Donut Effect */}
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={size / 6}
                  fill="white"
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />

                {/* Center Text */}
                <text
                  x={size / 2}
                  y={size / 2 - 8}
                  textAnchor="middle"
                  className="fill-neutral-700 text-xs font-semibold"
                >
                  {processedData.length}
                </text>
                <text
                  x={size / 2}
                  y={size / 2 + 8}
                  textAnchor="middle"
                  className="fill-neutral-500 text-xs"
                >
                  methods
                </text>
              </svg>
            </div>

            {/* Legend */}
            <div className="min-w-0 flex-1 space-y-2">
              {pieSegments.map((segment, index) => {
                const Icon = segment.config.icon;
                const trend =
                  segment.previousAmount && segment.previousAmount.toNumber() > 0
                    ? ((segment.amount.toNumber() - segment.previousAmount.toNumber()) /
                        segment.previousAmount.toNumber()) *
                      100
                    : null;

                return (
                  <div
                    key={segment.method}
                    className={`flex items-center justify-between rounded p-2 ${
                      onMethodClick ? "cursor-pointer hover:bg-neutral-50" : ""
                    }`}
                    onClick={() => onMethodClick?.(segment, index)}
                    data-testid={`payment-method-${index}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: segment.config.color }}
                        />
                        <Icon className="h-4 w-4 flex-shrink-0 text-neutral-600" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-neutral-700">
                          {segment.config.label}
                        </div>
                        {showTransactionCount && (
                          <div className="text-xs text-neutral-500">
                            {segment.count} transactions
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 items-center gap-2">
                      <div className="text-right">
                        <div className="font-mono text-sm font-semibold">
                          {formatPhilippinePeso(segment.amount, { compact: true })}
                        </div>
                        <div className="font-mono text-xs text-neutral-500">
                          {formatPercentage(segment.percentage, 1)}
                        </div>
                      </div>

                      {/* Trend Indicator */}
                      {showTrends && trend !== null && Math.abs(trend) > 1 && (
                        <div
                          className={`flex items-center gap-1 ${
                            trend > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          <TrendingUp className={`h-3 w-3 ${trend < 0 ? "rotate-180" : ""}`} />
                          <span className="font-mono text-xs">
                            {formatPercentage(Math.abs(trend), 0)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Digital Payment Insight */}
          {paymentSummary && (
            <div className="border-t border-neutral-200 pt-3">
              <div className="space-y-1 text-xs text-neutral-500">
                <div>
                  <span className="font-medium">Digital payments:</span>{" "}
                  {formatPercentage(paymentSummary.digitalPaymentPercentage, 1)}(
                  {formatPhilippinePeso(
                    processedData
                      .filter((item) => item.config.isDigital)
                      .reduce((sum, item) => sum.add(item.amount), new Money(0)),
                    { compact: true }
                  )}
                  )
                </div>
                <div>
                  <span className="font-medium">Philippine mobile payments (GCash/Maya):</span>{" "}
                  {formatPercentage(
                    (processedData
                      .filter((item) =>
                        ["gcash", "maya", "paymaya"].includes(item.method.toLowerCase())
                      )
                      .reduce((sum, item) => sum + item.numericAmount, 0) /
                      paymentSummary.totalAmount.toNumber()) *
                      100,
                    1
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentMethodChart;
export type { PaymentMethodChartProps, PaymentMethodData, PaymentSummary };
