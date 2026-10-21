import React from "react";

import { Building2, CreditCard, Wallet } from "lucide-react";

import { SelectItem } from "@/components/patterns";
import { SelectControl, type SelectControlProps } from "@/components/payments/SelectControl";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useActiveAccounts } from "@/stores/useAccountStore";
import type { Account, AccountType } from "@/types";

const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

interface AccountSelectorProps extends Omit<
  SelectControlProps,
  "value" | "onValueChange" | "children"
> {
  value?: string;
  onChange: (value: string) => void;
  excludeAccountId?: string; // Useful for transfer forms to exclude selected account
  showBalance?: boolean;
  // Accepted for form integration; the field's validation drives the message
  required?: boolean;
  error?: string;
}

/**
 * The active accounts, grouped by type. Inside a `FormField` it passes the field's id and ARIA
 * props on to the trigger, so the field label names it.
 */
export const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select account",
  disabled = false,
  className,
  excludeAccountId,
  showBalance = false,
  required: _required = false,
  error,
  ...triggerProps
}) => {
  const { data: accounts = [], isLoading, isError } = useActiveAccounts();

  const filteredAccounts = excludeAccountId
    ? accounts.filter((a) => a.account_id !== excludeAccountId)
    : accounts;

  const groupedAccounts = React.useMemo(() => {
    const groups: Record<AccountType, Account[]> = {
      Bank: [],
      "E-Wallet": [],
      Cash: [],
    };

    filteredAccounts.forEach((account) => {
      const type = account.account_type;
      if (groups[type]) {
        groups[type].push(account);
      }
    });

    return groups;
  }, [filteredAccounts]);

  if (isLoading || isError) {
    return (
      <SelectControl
        {...triggerProps}
        value={undefined}
        onValueChange={onChange}
        placeholder={isLoading ? "Loading accounts..." : "Error loading accounts"}
        disabled
        className={cn("w-full", isError && "border-destructive", className)}
      >
        {null}
      </SelectControl>
    );
  }

  return (
    <SelectControl
      {...triggerProps}
      value={value || ""}
      onValueChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={cn("w-full", error && "border-destructive", className)}
    >
      {filteredAccounts.length === 0 ? (
        <div className="text-muted-foreground p-2 text-center text-sm">No accounts available</div>
      ) : (
        Object.entries(groupedAccounts).map(([type, typeAccounts]) => {
          if (typeAccounts.length === 0) return null;

          return (
            <React.Fragment key={type}>
              <div className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">
                {type === "E-Wallet" ? "E-Wallets" : `${type} Accounts`}
              </div>
              {typeAccounts.map((account) => (
                <SelectItem
                  key={account.account_id}
                  value={account.account_id}
                  className="cursor-pointer"
                >
                  <AccountOptionDisplay account={account} showBalance={showBalance} />
                </SelectItem>
              ))}
            </React.Fragment>
          );
        })
      )}
    </SelectControl>
  );
};

interface AccountOptionDisplayProps {
  account: Account;
  showBalance?: boolean;
}

const AccountOptionDisplay: React.FC<AccountOptionDisplayProps> = ({
  account,
  showBalance = false,
}) => {
  const Icon = AccountTypeIcon[account.account_type] || CreditCard;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {account.account_name}
        <span className="text-muted-foreground ml-1 text-xs">({account.account_code})</span>
      </span>
      {showBalance && (
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {formatCurrency(account.initial_balance)}
        </span>
      )}
    </div>
  );
};

export { AccountTypeIcon };
