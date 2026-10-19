import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface MobileCardRowProps {
  label: string;
  value: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * One label and value line inside a `MobileCard`, label left and value right.
 *
 * @example
 * ```tsx
 * <MobileCardRow label="Amount" value={formatCurrency(payment.amount)} />
 * ```
 */
export function MobileCardRow({ label, value, className }: MobileCardRowProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <div className="text-foreground min-w-0 text-right text-sm tabular-nums">{value}</div>
    </div>
  );
}
