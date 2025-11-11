import * as React from "react";

import { AlertTriangle, Home, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NumberInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Props for UnitRequestCard component
 * Represents a single unit request in the booking flow
 */
export interface UnitRequestCardProps {
  /** 0-based index, displayed as "Unit #1", "Unit #2", etc. */
  index: number;
  /** Current number of guests for this unit */
  guestsPerUnit: number;
  /** Callback when guest count changes */
  onGuestsChange: (guests: number) => void;
  /** Callback when remove button is clicked */
  onRemove: () => void;
  /** Disable all interactions */
  disabled?: boolean;
  /** Maximum capacity per unit from pricing_config */
  maxCapacityPerUnit: number;
  /** Base occupancy (no extra person fee) from pricing_config */
  baseOccupancy: number;
  /** Extra person rate per night from pricing_config */
  extraPersonRate: number;
  /** Show remove button (false if only 1 unit in booking) */
  canRemove: boolean;
}

/**
 * UnitRequestCard Component
 *
 * Professional Enterprise card for managing a single unit request.
 * Each card represents exactly 1 unit with variable guest count.
 *
 * Features:
 * - Numbered unit title with Home icon
 * - Guest count input with validation (min=1, max=maxCapacityPerUnit)
 * - Extra person warning indicator (when guests > baseOccupancy)
 * - Remove button (only shown if canRemove=true)
 * - Monospace currency formatting for extra person fees
 *
 * @example
 * ```tsx
 * <UnitRequestCard
 *   index={0}
 *   guestsPerUnit={4}
 *   onGuestsChange={(guests) => handleUpdate(0, guests)}
 *   onRemove={() => handleRemove(0)}
 *   maxCapacityPerUnit={10}
 *   baseOccupancy={2}
 *   extraPersonRate={300}
 *   canRemove={true}
 * />
 * ```
 */
export const UnitRequestCard: React.FC<UnitRequestCardProps> = ({
  index,
  guestsPerUnit,
  onGuestsChange,
  onRemove,
  disabled = false,
  maxCapacityPerUnit,
  baseOccupancy,
  extraPersonRate,
  canRemove,
}) => {
  // Calculate extra person count and total fee
  const extraPersonCount = Math.max(0, guestsPerUnit - baseOccupancy);
  const hasExtraPerson = extraPersonCount > 0;

  /**
   * Handle guest count change with validation
   * Only calls onGuestsChange if value is within valid range
   * Using React.startTransition to defer state updates and prevent
   * "Cannot update component while rendering another component" error
   */
  const handleGuestsChange = React.useCallback(
    (value: number | null) => {
      // Only propagate valid non-null values within range
      // This ensures onChange is called when typing completes a valid number
      if (value !== null && value >= 1 && value <= maxCapacityPerUnit) {
        // Defer state update to avoid setState during render
        React.startTransition(() => {
          onGuestsChange(value);
        });
      }
    },
    [maxCapacityPerUnit, onGuestsChange]
  );

  return (
    <Card
      className={cn("relative border-neutral-200", disabled && "pointer-events-none opacity-60")}
      padding="none"
    >
      {/* Header with title and remove button */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Home className="text-muted-foreground h-4 w-4" aria-hidden="true" />
          <span>Unit #{index + 1}</span>
        </CardTitle>

        {/* Remove button - only show if canRemove is true */}
        {canRemove && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={disabled}
            className="text-muted-foreground hover:text-destructive h-8 w-8"
            aria-label={`Remove Unit #${index + 1}`}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-0">
        {/* Guest count input */}
        <div className="space-y-2">
          <Label htmlFor={`unit-${index}-guests`} className="text-sm font-medium">
            Number of Guests
          </Label>
          <NumberInput
            id={`unit-${index}-guests`}
            value={guestsPerUnit}
            onChange={handleGuestsChange}
            min={1}
            max={maxCapacityPerUnit}
            enforceMinMax={true}
            disabled={disabled}
            className="w-full"
            aria-describedby={hasExtraPerson ? `unit-${index}-extra-person-warning` : undefined}
          />
          <p className="text-muted-foreground text-xs">
            Maximum {maxCapacityPerUnit} guests per unit
          </p>
        </div>

        {/* Extra person warning indicator */}
        {hasExtraPerson && (
          <Alert
            id={`unit-${index}-extra-person-warning`}
            className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950"
          >
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
            <AlertDescription className="text-sm text-yellow-800 dark:text-yellow-200">
              <span className="font-medium">Extra person fee: </span>
              <span className="font-mono">
                ₱{extraPersonRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                /person/night
              </span>
              <span className="ml-1">
                ({extraPersonCount} extra {extraPersonCount === 1 ? "person" : "people"})
              </span>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

UnitRequestCard.displayName = "UnitRequestCard";
