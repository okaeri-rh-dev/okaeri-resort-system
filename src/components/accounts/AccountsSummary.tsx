import React from "react";

import { Building2, CreditCard, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAccountBalances } from "@/stores/useAccountStore";
import type { AccountType } from "@/types";

// Icon mapping
const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

interface AccountsSummaryProps {
  className?: string;
  showDetails?: boolean;
}

export const AccountsSummary: React.FC<AccountsSummaryProps> = ({
  className,
  showDetails = true,
}) => {
  const { data: accounts = [], isLoading, isError } = useAccountBalances();

  // Calculate totals
  const totals = React.useMemo(() => {
    return accounts.reduce(
      (acc, account) => ({
        totalBalance: acc.totalBalance + account.current_balance,
        totalPayments: acc.totalPayments + account.total_payments,
        totalExpenses: acc.totalExpenses + account.total_expenses,
        byType: {
          ...acc.byType,
          [account.account_type]:
            (acc.byType[account.account_type as AccountType] || 0) + account.current_balance,
        },
      }),
      {
        totalBalance: 0,
        totalPayments: 0,
        totalExpenses: 0,
        byType: {} as Record<AccountType, number>,
      }
    );
  }, [accounts]);

  const formatCurrency = (amount: number) => {
    return `₱${Math.abs(amount).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-4 h-8 w-40" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn("border-destructive", className)}>
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>Failed to load account balances</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Total Balance</CardTitle>
        <CardDescription>Across {accounts.length} active accounts</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Total Balance */}
        <div className="mb-4">
          <span
            className={cn(
              "text-3xl font-bold tabular-nums",
              totals.totalBalance < 0 && "text-destructive"
            )}
          >
            {totals.totalBalance < 0 ? "-" : ""}
            {formatCurrency(totals.totalBalance)}
          </span>
        </div>

        {/* Money In/Out */}
        {showDetails && (
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Received</p>
                <p className="font-semibold text-green-600 tabular-nums">
                  +{formatCurrency(totals.totalPayments)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Spent</p>
                <p className="font-semibold text-red-600 tabular-nums">
                  -{formatCurrency(totals.totalExpenses)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Balance by Type */}
        {showDetails && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-xs font-medium">By Account Type</p>
            {(["Bank", "E-Wallet", "Cash"] as AccountType[]).map((type) => {
              const Icon = AccountTypeIcon[type];
              const balance = totals.byType[type] || 0;
              const accountCount = accounts.filter((a) => a.account_type === type).length;

              if (accountCount === 0) return null;

              return (
                <div
                  key={type}
                  className="bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        type === "Bank" && "text-blue-600",
                        type === "E-Wallet" && "text-green-600",
                        type === "Cash" && "text-amber-600"
                      )}
                    />
                    <span className="text-sm">
                      {type === "E-Wallet" ? "E-Wallets" : type}
                      <span className="text-muted-foreground ml-1 text-xs">({accountCount})</span>
                    </span>
                  </div>
                  <span
                    className={cn("font-medium tabular-nums", balance < 0 && "text-destructive")}
                  >
                    {formatCurrency(balance)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Compact version for sidebar or smaller spaces
interface AccountsSummaryCompactProps {
  className?: string;
}

export const AccountsSummaryCompact: React.FC<AccountsSummaryCompactProps> = ({ className }) => {
  const { data: accounts = [], isLoading } = useAccountBalances();

  const totalBalance = React.useMemo(() => {
    return accounts.reduce((sum, account) => sum + account.current_balance, 0);
  }, [accounts]);

  const formatCurrency = (amount: number) => {
    return `₱${Math.abs(amount).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  if (isLoading) {
    return <Skeleton className={cn("h-10 w-full", className)} />;
  }

  return (
    <div
      className={cn(
        "bg-muted/50 flex items-center justify-between rounded-lg px-3 py-2",
        className
      )}
    >
      <span className="text-muted-foreground text-sm">Total Balance</span>
      <span className={cn("font-semibold tabular-nums", totalBalance < 0 && "text-destructive")}>
        {totalBalance < 0 ? "-" : ""}
        {formatCurrency(totalBalance)}
      </span>
    </div>
  );
};
