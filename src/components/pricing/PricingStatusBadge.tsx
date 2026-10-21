import { Loader2, Minus, TrendingDown, TrendingUp } from "lucide-react";

import { StatusBadge, type StatusTone } from "@/components/patterns";
import { cn } from "@/lib/utils";

interface PricingStatusBadgeProps {
  /** Notice message from pricing API (e.g., "Seasonal rates applied (Peak Summer)") */
  notice: string | null;

  /** Whether pricing calculation is in progress */
  isLoading?: boolean;

  /** Placement only (margin, flex position). */
  className?: string;
}

/**
 * Badge component that displays pricing status and seasonal rate information. Higher rates
 * read as `warning`, lower rates as `success`; the notice text carries the meaning.
 *
 * @example
 * ```tsx
 * <PricingStatusBadge
 *   notice="Seasonal rates applied (Christmas & New Year)"
 *   isLoading={false}
 * />
 * ```
 */
export function PricingStatusBadge({
  notice,
  isLoading = false,
  className,
}: PricingStatusBadgeProps) {
  if (!notice && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <StatusBadge tone="neutral" className={className}>
        <Loader2 className="mr-1 size-3.5 animate-spin" aria-hidden="true" />
        Calculating pricing...
      </StatusBadge>
    );
  }

  const isIncrease =
    notice?.toLowerCase().includes("peak") ||
    notice?.toLowerCase().includes("high season") ||
    notice?.toLowerCase().includes("christmas") ||
    notice?.toLowerCase().includes("holiday");

  const isDecrease =
    notice?.toLowerCase().includes("low") ||
    notice?.toLowerCase().includes("discount") ||
    notice?.toLowerCase().includes("off-season");

  const tone: StatusTone = isIncrease ? "warning" : isDecrease ? "success" : "neutral";
  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;

  return (
    <StatusBadge tone={tone} className={className}>
      <Icon className="mr-1 size-3.5" aria-hidden="true" />
      {notice}
    </StatusBadge>
  );
}

/**
 * Compact version that shows only an icon with tooltip
 */
export function PricingStatusIcon({
  notice,
  isLoading = false,
  className,
}: PricingStatusBadgeProps) {
  if (!notice && !isLoading) {
    return null;
  }

  if (isLoading) {
    return <Minus className={cn("text-muted-foreground h-4 w-4 animate-spin", className)} />;
  }

  const isIncrease =
    notice?.toLowerCase().includes("peak") || notice?.toLowerCase().includes("high season");
  const isDecrease =
    notice?.toLowerCase().includes("low") || notice?.toLowerCase().includes("discount");

  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;
  const colorClass = isIncrease
    ? "text-warning-foreground"
    : isDecrease
      ? "text-success-foreground"
      : "text-muted-foreground";

  return (
    <span title={notice || "Regular pricing"}>
      <Icon className={cn("h-4 w-4", colorClass, className)} />
    </span>
  );
}
