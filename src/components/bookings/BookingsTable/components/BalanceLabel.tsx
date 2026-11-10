import { outstandingBalance } from "@/lib/dashboard";
import { formatCurrency } from "@/lib/formatters";
import type { Booking } from "@/types";

/** Money still owed, as text: Record payment lives in the overflow menu. */
export const BalanceLabel = ({ booking }: { booking: Booking }) => {
  const balance = outstandingBalance(booking);
  if (balance <= 0) return null;
  return (
    <span className="text-warning-foreground text-xs font-medium whitespace-nowrap tabular-nums">
      {formatCurrency(balance)} due
    </span>
  );
};
