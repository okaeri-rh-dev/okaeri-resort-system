import * as React from "react";

import { Plus } from "lucide-react";

import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@/components/patterns";
import { fetchRates } from "@/lib/api/guest-booking-client";
import type { PricingConfig, UnitRequest } from "@/types/guest-booking-multi-unit";

import { UnitRequestCard } from "./UnitRequestCard";

/**
 * Props for UnitRequestSelector component
 */
export interface UnitRequestSelectorProps {
  /** Array of unit requests (each entry = 1 unit with guests_per_unit) */
  value: UnitRequest[];
  /** Callback when unit requests array changes */
  onChange: (requests: UnitRequest[]) => void;
  /** Disable all interactions */
  disabled?: boolean;
  /** Maximum total units allowed per booking */
  maxTotalUnits?: number;
}

/**
 * UnitRequestSelector Component
 *
 * Professional Enterprise container for managing multiple unit requests.
 * Fetches static rates on mount and provides UI for adding/removing units.
 *
 * Features:
 * - Fetches pricing configuration from API on mount
 * - Displays static rate information card (reference only)
 * - Info banner with booking instructions and totals
 * - Array of UnitRequestCard components
 * - Add/Remove unit functionality with validation
 * - Max units warning when limit reached
 * - Loading state with Skeleton components
 * - Error state with a danger Callout
 *
 * Business Logic:
 * - Each array entry = exactly 1 unit
 * - New units default to baseOccupancy guests
 * - Calculates total units and total guests
 * - Enforces maxTotalUnits limit (default: 10)
 *
 * @example
 * ```tsx
 * const [unitRequests, setUnitRequests] = useState<UnitRequest[]>([
 *   { guests_per_unit: 2 }
 * ]);
 *
 * <UnitRequestSelector
 *   value={unitRequests}
 *   onChange={setUnitRequests}
 *   maxTotalUnits={10}
 * />
 * ```
 */
export const UnitRequestSelector: React.FC<UnitRequestSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  maxTotalUnits = 10,
}) => {
  // State for pricing configuration
  const [pricingConfig, setPricingConfig] = React.useState<PricingConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * Fetch static rates on component mount
   */
  React.useEffect(() => {
    const loadRates = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const rates = await fetchRates();
        setPricingConfig(rates);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load pricing information";
        setError(errorMessage);
        console.error("Error fetching rates:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadRates();
  }, []); // Run once on mount

  /**
   * Calculate totals from current unit requests
   */
  const totalUnits = value.length;
  const totalGuests = value.reduce((sum, request) => sum + request.guests_per_unit, 0);

  /**
   * Check if max units limit reached
   */
  const isMaxUnitsReached = totalUnits >= maxTotalUnits;

  /**
   * Handle adding a new unit request
   * Defaults to baseOccupancy guests
   */
  const handleAddRequest = () => {
    if (isMaxUnitsReached || !pricingConfig) return;

    const newRequest: UnitRequest = {
      guests_per_unit: pricingConfig.base_occupancy,
    };

    onChange([...value, newRequest]);
  };

  /**
   * Handle updating a specific unit request
   */
  const handleUpdateRequest = (index: number, guests: number) => {
    const updated = value.map((request, i) =>
      i === index ? { ...request, guests_per_unit: guests } : request
    );
    onChange(updated);
  };

  /**
   * Handle removing a unit request
   */
  const handleRemoveRequest = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Loading state
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading rates" className="space-y-4">
        {[4, 3].map((lines) => (
          <Card key={lines} className="space-y-4 p-4" padding="none">
            <div className="space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: lines }, (_, line) => (
                <Skeleton key={line} className={line === lines - 1 ? "h-4 w-1/2" : "h-4 w-full"} />
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  // Error state
  if (error || !pricingConfig) {
    return (
      <Callout tone="danger">
        {error || "Failed to load pricing information. Please refresh the page."}
      </Callout>
    );
  }

  return (
    <div className="space-y-4">
      {/* Info banner with instructions and totals */}
      <Callout tone="info">
        <p className="mb-1">
          Add cabins and specify guests for each. Admin assigns specific cabins after booking
          confirmation.
        </p>
        <p className="font-medium">
          Total: {totalUnits} cabin{totalUnits !== 1 ? "s" : ""}, {totalGuests} guest
          {totalGuests !== 1 ? "s" : ""}
        </p>
      </Callout>

      {/* Static Rate Display Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Current Rates (Reference Only)</CardTitle>
        </CardHeader>
        <CardContent className="@container space-y-4">
          {/* Rate grid - 2 columns on desktop, 1 on mobile */}
          <div className="grid grid-cols-1 gap-3 @md:grid-cols-2">
            {/* Base Rate */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Base Rate</p>
              <p className="text-lg font-semibold tabular-nums">
                ₱{pricingConfig.base_rate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                /night
              </p>
            </div>

            {/* Weekend Rate */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Weekend Rate</p>
              <p className="text-lg font-semibold tabular-nums">
                ₱{pricingConfig.weekend_rate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                /night
              </p>
            </div>

            {/* Base Occupancy */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Base Occupancy</p>
              <p className="text-lg font-semibold">{pricingConfig.base_occupancy} guests</p>
            </div>

            {/* Extra Person Rate */}
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">Extra Person</p>
              <p className="text-lg font-semibold tabular-nums">
                ₱
                {pricingConfig.extra_person_rate.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
                /night
              </p>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-muted-foreground border-t pt-3 text-xs">
            Final pricing calculated based on your specific dates and unit requests.
          </p>
        </CardContent>
      </Card>

      {/* Unit Cards or Empty State */}
      {value.length === 0 ? (
        // Empty state - dashed border card with Add button
        <Card className="bg-muted/30 border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4 text-center text-sm">
              No units selected. Click below to add your first unit request.
            </p>
            <Button onClick={handleAddRequest} disabled={disabled} variant="outline" size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Add Unit Request
            </Button>
          </CardContent>
        </Card>
      ) : (
        // Unit request cards
        <div className="space-y-3">
          {value.map((request, index) => (
            <UnitRequestCard
              key={index}
              index={index}
              guestsPerUnit={request.guests_per_unit}
              onGuestsChange={(guests) => handleUpdateRequest(index, guests)}
              onRemove={() => handleRemoveRequest(index)}
              disabled={disabled}
              maxCapacityPerUnit={pricingConfig.max_capacity_per_unit}
              baseOccupancy={pricingConfig.base_occupancy}
              extraPersonRate={pricingConfig.extra_person_rate}
              canRemove={value.length > 1}
            />
          ))}
        </div>
      )}

      {/* Add Another Unit button (if not at max) */}
      {value.length > 0 && !isMaxUnitsReached && (
        <Button onClick={handleAddRequest} disabled={disabled} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Another Cabin
        </Button>
      )}

      {/* Max units warning */}
      {isMaxUnitsReached && (
        <Callout tone="warning">
          Maximum of {maxTotalUnits} cabins per booking reached. Contact us directly for larger
          group bookings.
        </Callout>
      )}
    </div>
  );
};

UnitRequestSelector.displayName = "UnitRequestSelector";
