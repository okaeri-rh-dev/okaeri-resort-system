import React from "react";

import { Building2, CreditCard, Wallet } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useActiveAccounts } from "@/stores/useAccountStore";
import type { Account, AccountType } from "@/types";

// Icon mapping for account types
const AccountTypeIcon: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  Bank: Building2,
  "E-Wallet": Wallet,
  Cash: CreditCard,
};

// Color mapping for account types
const AccountTypeColor: Record<AccountType, string> = {
  Bank: "text-blue-600",
  "E-Wallet": "text-green-600",
  Cash: "text-amber-600",
};

interface AccountSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  excludeAccountId?: string; // Useful for transfer forms to exclude selected account
  showBalance?: boolean;
  required?: boolean;
  error?: string;
}

export const AccountSelector: React.FC<AccountSelectorProps> = ({
  value,
  onChange,
  placeholder = "Select account",
  disabled = false,
  className,
  excludeAccountId,
  showBalance = false,
  // required is passed through props but not used directly - it's for form integration
  required: _required = false,
  error,
}) => {
  const { data: accounts = [], isLoading, isError } = useActiveAccounts();

  // Filter out excluded account if specified
  const filteredAccounts = excludeAccountId
    ? accounts.filter((a) => a.account_id !== excludeAccountId)
    : accounts;

  // Group accounts by type for better organization
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

  if (isLoading) {
    return (
      <Select disabled>
        <SelectTrigger className={cn("w-full", className)}>
          <SelectValue placeholder="Loading accounts..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (isError) {
    return (
      <Select disabled>
        <SelectTrigger className={cn("border-destructive w-full", className)}>
          <SelectValue placeholder="Error loading accounts" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value || ""} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn("w-full", error && "border-destructive focus:ring-destructive", className)}
      >
        <SelectValue placeholder={placeholder}>
          {value && (
            <AccountOptionDisplay
              account={filteredAccounts.find((a) => a.account_id === value)}
              showBalance={showBalance}
            />
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {filteredAccounts.length === 0 ? (
          <div className="text-muted-foreground p-2 text-center text-sm">No accounts available</div>
        ) : (
          // Render accounts grouped by type
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
      </SelectContent>
    </Select>
  );
};

// Helper component for rendering account option
interface AccountOptionDisplayProps {
  account?: Account;
  showBalance?: boolean;
}

const AccountOptionDisplay: React.FC<AccountOptionDisplayProps> = ({
  account,
  showBalance = false,
}) => {
  if (!account) return null;

  const Icon = AccountTypeIcon[account.account_type] || CreditCard;
  const colorClass = AccountTypeColor[account.account_type] || "text-gray-600";

  return (
    <div className="flex items-center gap-2">
      <Icon className={cn("h-4 w-4 flex-shrink-0", colorClass)} />
      <span className="truncate">
        {account.account_name}
        <span className="text-muted-foreground ml-1 text-xs">({account.account_code})</span>
      </span>
      {showBalance && (
        <span className="text-muted-foreground ml-auto text-xs">
          ₱{account.initial_balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </span>
      )}
    </div>
  );
};

// Export type icons and colors for reuse
export { AccountTypeIcon, AccountTypeColor };
