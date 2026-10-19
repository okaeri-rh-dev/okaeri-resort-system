import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ListCardRowProps {
  label: string;
  value: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * One label and value line inside a `ListCard`, label left and value right.
 *
 * @example
 * ```tsx
 * <ListCardRow label="Amount" value={formatCurrency(payment.amount)} />
 * ```
 */
export function ListCardRow({ label, value, className }: ListCardRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <div className="text-foreground min-w-0 text-right text-sm tabular-nums">{value}</div>
    </div>
  );
}
