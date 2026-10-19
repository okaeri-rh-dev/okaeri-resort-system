import type * as React from "react";

import { cn } from "@/lib/utils";

const emphasisClasses = {
  default: "",
  strong: "font-medium",
  figure: "text-lg font-semibold tabular-nums",
  total: "text-2xl font-semibold tabular-nums",
} as const;

export interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /**
   * `strong` for names and key text, `figure` for amounts and counts, `total` for the one
   * headline amount on a page. Figures use tabular numerals.
   */
  emphasis?: keyof typeof emphasisClasses;
  /** `vertical` stacks the label over the value; `horizontal` puts them on one line. */
  direction?: "horizontal" | "vertical";
}

/**
 * A label and value pair on a detail page.
 *
 * @example
 * ```tsx
 * <DetailField label="Guest" value={booking.guest_name} emphasis="strong" />
 * <DetailField label="Total" value={formatCurrency(booking.total_amount)} emphasis="figure" />
 * <DetailField label="Status" value={<StatusBadge tone="success">Paid</StatusBadge>} direction="horizontal" />
 * ```
 */
export function DetailField({
  label,
  value,
  icon,
  emphasis = "default",
  direction = "vertical",
}: DetailFieldProps) {
  const valueClassName = cn(
    "text-foreground min-w-0 text-sm break-words",
    emphasisClasses[emphasis]
  );
  const labelBlock = (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
    </div>
  );

  if (direction === "horizontal") {
    return (
      <div className="flex items-center justify-between gap-4 py-2">
        {labelBlock}
        <div className={valueClassName}>{value}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {labelBlock}
      <div className={valueClassName}>{value}</div>
    </div>
  );
}
