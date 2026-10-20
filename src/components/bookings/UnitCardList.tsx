/**
 * UnitCardList Component
 *
 * Displays selected units with editing capabilities:
 * - Guest count adjustment per unit (primary feature)
 * - Unit removal
 * - Pricing breakdown (collapsible)
 * - Empty state handling
 * - Optional guest assignment button (hidden by default)
 *
 * @module UnitCardList
 */

import { ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { PricingConfig } from "@/hooks/usePricingConfig";
import { formatCurrency } from "@/lib/formatters";
import type { BookingUnit } from "@/types/multi-unit-booking";

// ============================================
// TYPES
// ============================================

export interface UnitCardListProps {
  units: BookingUnit[];
  onRemove: (unitId: string) => void;
  onUpdateGuestCount: (unitId: string, count: number) => void;
  onAssignGuests?: (unitId: string) => void;
  editable?: boolean;
  pricingConfig?: PricingConfig;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UnitCardList({
  units,
  onRemove,
  onUpdateGuestCount,
  onAssignGuests,
  editable = true,
  pricingConfig,
}: UnitCardListProps) {
  if (units.length === 0) {
    return (
      <div
        className="text-muted-foreground py-8 text-center"
        role="status"
        aria-label="No units selected"
      >
        No units selected
      </div>
    );
  }

  return (
    <div className="space-y-4" role="list" aria-label="Selected units">
      {units.map((unit, index) => (
        <UnitCardItem
          key={unit.unit_id}
          unit={unit}
          index={index}
          onRemove={onRemove}
          onUpdateGuestCount={onUpdateGuestCount}
          onAssignGuests={onAssignGuests}
          editable={editable}
          pricingConfig={pricingConfig}
        />
      ))}
    </div>
  );
}

// ============================================
// UNIT CARD ITEM SUB-COMPONENT
// ============================================

interface UnitCardItemProps {
  unit: BookingUnit;
  index: number;
  onRemove: (unitId: string) => void;
  onUpdateGuestCount: (unitId: string, count: number) => void;
  onAssignGuests?: (unitId: string) => void;
  editable: boolean;
  pricingConfig?: PricingConfig;
}

function UnitCardItem({
  unit,
  index,
  onRemove,
  onUpdateGuestCount,
  onAssignGuests,
  editable,
  pricingConfig,
}: UnitCardItemProps) {
  const guestCount = unit.guest_assignment?.num_guests || unit.base_occupancy;

  const handleGuestCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1 && value <= unit.max_occupancy) {
      onUpdateGuestCount(unit.unit_id, value);
    }
  };

  return (
    <Card role="listitem" aria-label={`Unit ${index + 1}: ${unit.unit_name}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Unit Info */}
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" aria-label={`Unit number ${index + 1}`}>
                {index + 1}
              </Badge>
              <h3 className="font-semibold">{unit.unit_name}</h3>
            </div>

            <div className="text-muted-foreground space-y-1 text-sm">
              <p>
                {unit.unit_code} • {unit.unit_type}
              </p>
              <p>Max {unit.max_occupancy} guests</p>
            </div>

            {/* Guest Count Input */}
            {editable && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label htmlFor={`guests-${unit.unit_id}`} className="text-sm font-medium">
                  Guests:
                </label>
                <Input
                  id={`guests-${unit.unit_id}`}
                  type="number"
                  min={1}
                  max={unit.max_occupancy}
                  value={guestCount}
                  onChange={handleGuestCountChange}
                  className="h-10 w-24"
                  aria-label={`Number of guests for ${unit.unit_name}`}
                  aria-describedby={`guests-${unit.unit_id}-description`}
                />
                <span
                  id={`guests-${unit.unit_id}-description`}
                  className="text-muted-foreground sr-only text-xs"
                >
                  Maximum {unit.max_occupancy} guests
                </span>

                {onAssignGuests && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAssignGuests(unit.unit_id)}
                    className="h-10"
                    aria-label={`Assign specific guests to ${unit.unit_name}`}
                  >
                    Assign Guests
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="text-right">
            <p
              className="text-2xl font-semibold"
              aria-label={`Total price ${formatCurrency(unit.pricing.unit_total)}`}
            >
              {formatCurrency(unit.pricing.unit_total)}
            </p>
            <p className="text-muted-foreground text-sm">
              {unit.pricing.nights} night{unit.pricing.nights !== 1 ? "s" : ""}
            </p>

            {editable && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove(unit.unit_id)}
                className="text-destructive hover:text-destructive mt-2 h-10"
                aria-label={`Remove ${unit.unit_name} from booking`}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* Pricing Breakdown (Collapsible) */}
        <Collapsible className="mt-4">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 w-full justify-between"
              aria-label={`Show pricing breakdown for ${unit.unit_name}`}
            >
              <span className="text-xs">Pricing Breakdown</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>
                Base ({unit.pricing.nights} night{unit.pricing.nights !== 1 ? "s" : ""} ×{" "}
                {formatCurrency(pricingConfig?.base_rate ?? unit.base_rate)})
              </span>
              <span className="font-mono">{formatCurrency(unit.pricing.base_total)}</span>
            </div>
            {unit.pricing.weekend_surcharge > 0 && (
              <div className="text-muted-foreground flex justify-between">
                <span>Weekend surcharge</span>
                <span className="font-mono">+{formatCurrency(unit.pricing.weekend_surcharge)}</span>
              </div>
            )}
            {unit.pricing.extra_person_fee > 0 && (
              <div className="text-muted-foreground flex justify-between">
                <span>
                  Extra persons (
                  {(unit.guest_assignment?.num_guests || unit.base_occupancy) - unit.base_occupancy}{" "}
                  × {unit.pricing.nights} night{unit.pricing.nights !== 1 ? "s" : ""} ×{" "}
                  {formatCurrency(pricingConfig?.extra_person_rate ?? unit.extra_person_rate)})
                </span>
                <span className="font-mono">+{formatCurrency(unit.pricing.extra_person_fee)}</span>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
