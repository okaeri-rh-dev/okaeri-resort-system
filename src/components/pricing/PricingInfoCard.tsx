import * as React from "react";

import { Settings } from "lucide-react";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/patterns";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/utils";

export interface PricingInfoCardProps {
  /**
   * Optional callback when edit button is clicked
   * If not provided, uses default navigation to /units/pricing
   */
  onEdit?: () => void;

  /**
   * Optional: Hide edit button (useful for read-only views)
   * @default false
   */
  readOnly?: boolean;
}

/**
 * PricingInfoCard Component
 *
 * Displays current pricing configuration in a compact, professional card.
 * Shows rates, capacity settings, and payment terms with an edit button
 * in the card header for quick access to pricing management.
 *
 * Features:
 * - Fetches pricing data using TanStack Query
 * - Loading state with skeleton
 * - Error state with retry button
 * - Grid layout: 2-3 columns responsive
 * - Currency formatting (PHP peso)
 * - Edit button in header for admin access
 *
 * Usage:
 * ```tsx
 * // Default: navigates to /units/pricing on edit
 * <PricingInfoCard />
 *
 * // Custom edit handler
 * <PricingInfoCard onEdit={() => navigate({ to: "/settings/pricing" })} />
 *
 * // Read-only mode
 * <PricingInfoCard readOnly />
 * ```
 */
export const PricingInfoCard: React.FC<PricingInfoCardProps> = ({ onEdit, readOnly = false }) => {
  const { data: pricing, isLoading, error, refetch } = usePricingConfig();

  // Loading state
  if (isLoading) {
    return (
      <Card role="status" aria-label="Loading pricing">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !pricing) {
    return (
      <Callout tone="danger" title="Couldn't load pricing">
        <div className="flex items-center justify-between gap-4">
          <span>
            {error instanceof Error
              ? error.message
              : "Failed to load pricing configuration. Please try again."}
          </span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </Callout>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Current Pricing Configuration</CardTitle>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              Edit Pricing
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="@container space-y-4">
        {/* Rates Grid */}
        <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
          {/* Base Rate */}
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Base Rate</p>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {formatCurrency(pricing.base_rate)}
              <span className="text-muted-foreground text-sm font-normal">/night</span>
            </p>
          </div>

          {/* Weekend Rate */}
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Weekend Rate</p>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {formatCurrency(pricing.weekend_rate)}
              <span className="text-muted-foreground text-sm font-normal">/night</span>
            </p>
          </div>

          {/* Extra Person */}
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Extra Person</p>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {formatCurrency(pricing.extra_person_rate)}
              <span className="text-muted-foreground text-sm font-normal">/night</span>
            </p>
          </div>
        </div>

        {/* Capacity & Payment Terms */}
        <div className="border-border border-t pt-3">
          <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
            {/* Base Occupancy */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Base Occupancy</p>
              <p className="text-lg font-semibold tabular-nums">
                {pricing.base_occupancy}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {pricing.base_occupancy === 1 ? "guest" : "guests"}
                </span>
              </p>
            </div>

            {/* Max Capacity */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Max Capacity</p>
              <p className="text-lg font-semibold tabular-nums">
                {pricing.max_capacity_per_unit}{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {pricing.max_capacity_per_unit === 1 ? "guest" : "guests"}
                </span>
              </p>
            </div>

            {/* Downpayment */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Downpayment</p>
              <p className="text-lg font-semibold tabular-nums">
                {pricing.downpayment_percent}
                <span className="text-muted-foreground text-sm font-normal">%</span>
              </p>
            </div>
          </div>
        </div>

        {/* Info Footer */}
        <p className="text-muted-foreground border-border border-t pt-3 text-xs">
          These rates are used for all booking calculations. Weekend rates apply to Friday and
          Saturday nights. Extra person fees apply to guests beyond base occupancy.
        </p>
      </CardContent>
    </Card>
  );
};
