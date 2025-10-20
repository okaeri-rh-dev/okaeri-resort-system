// src/components/entity-detail/DetailField.tsx

import React from "react";

import { cn } from "@/lib/utils";

/**
 * Props for DetailField component
 */
export interface DetailFieldProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  valueClassName?: string;
  labelClassName?: string;
  direction?: "horizontal" | "vertical"; // Layout direction
}

/**
 * Standardized label-value pair with professional formatting
 *
 * Supports two layout modes:
 * - Vertical: Label above value (default)
 * - Horizontal: Label and value side-by-side
 *
 * @example
 * ```typescript
 * // Basic vertical field
 * <DetailField label="Guest Name" value={booking.guest_name} />
 *
 * // Financial field (monospace, bold)
 * <DetailField
 *   label="Total Amount"
 *   value={formatCurrency(booking.total_amount)}
 *   valueClassName="font-mono font-semibold text-lg"
 * />
 *
 * // Field with icon
 * <DetailField
 *   label="Check-in Date"
 *   value={formatFullDate(booking.check_in)}
 *   icon={<Calendar className="h-4 w-4 text-neutral-500" />}
 * />
 *
 * // Horizontal layout
 * <DetailField
 *   label="Status"
 *   value={<StatusBadge status={booking.booking_status} />}
 *   direction="horizontal"
 * />
 * ```
 */
export function DetailField({
  label,
  value,
  icon,
  valueClassName,
  labelClassName,
  direction = "vertical",
}: DetailFieldProps) {
  if (direction === "horizontal") {
    return (
      <div className="flex items-center justify-between gap-4 py-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className={cn("text-sm font-medium text-neutral-600", labelClassName)}>
            {label}
          </span>
        </div>
        <div className={cn("text-sm text-neutral-900", valueClassName)}>{value}</div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <label className={cn("text-sm font-medium text-neutral-600", labelClassName)}>
          {label}
        </label>
      </div>
      <div className={cn("text-sm text-neutral-900", valueClassName)}>{value}</div>
    </div>
  );
}
