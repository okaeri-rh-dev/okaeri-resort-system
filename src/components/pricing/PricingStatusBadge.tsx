import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PricingStatusBadgeProps {
  /** Notice message from pricing API (e.g., "Seasonal rates applied (Peak Summer)") */
  notice: string | null;

  /** Whether pricing calculation is in progress */
  isLoading?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * Badge component that displays pricing status and seasonal rate information
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
  size = "md",
}: PricingStatusBadgeProps) {
  // Don't render anything if no notice and not loading
  if (!notice && !isLoading) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "animate-pulse",
          size === "sm" && "px-2 py-0.5 text-xs",
          size === "md" && "px-3 py-1 text-sm",
          size === "lg" && "px-4 py-1.5 text-base",
          className
        )}
      >
        <Minus
          className={cn(
            "mr-1 animate-spin",
            size === "sm" && "h-3 w-3",
            size === "md" && "h-4 w-4",
            size === "lg" && "h-5 w-5"
          )}
        />
        Calculating pricing...
      </Badge>
    );
  }

  // Determine badge variant and icon based on notice content
  const isIncrease =
    notice?.toLowerCase().includes("peak") ||
    notice?.toLowerCase().includes("high season") ||
    notice?.toLowerCase().includes("christmas") ||
    notice?.toLowerCase().includes("holiday");

  const isDecrease =
    notice?.toLowerCase().includes("low") ||
    notice?.toLowerCase().includes("discount") ||
    notice?.toLowerCase().includes("off-season");

  const variant = isIncrease ? "default" : isDecrease ? "secondary" : "outline";
  const Icon = isIncrease ? TrendingUp : isDecrease ? TrendingDown : Minus;

  return (
    <Badge
      variant={variant}
      className={cn(
        "font-normal",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        isIncrease && "bg-orange-500 text-white hover:bg-orange-600",
        isDecrease && "bg-green-500 text-white hover:bg-green-600",
        className
      )}
    >
      <Icon
        className={cn(
          "mr-1",
          size === "sm" && "h-3 w-3",
          size === "md" && "h-4 w-4",
          size === "lg" && "h-5 w-5"
        )}
      />
      {notice}
    </Badge>
  );
}

/**
 * Compact version that shows only an icon with tooltip
 */
export function PricingStatusIcon({
  notice,
  isLoading = false,
  className,
}: Omit<PricingStatusBadgeProps, "size">) {
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
    ? "text-orange-500"
    : isDecrease
      ? "text-green-500"
      : "text-muted-foreground";

  return (
    <span title={notice || "Regular pricing"}>
      <Icon className={cn("h-4 w-4", colorClass, className)} />
    </span>
  );
}
