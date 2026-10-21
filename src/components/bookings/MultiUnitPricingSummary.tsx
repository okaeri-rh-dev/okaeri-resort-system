/**
 * MultiUnitPricingSummary Component
 *
 * Shows comprehensive pricing breakdown for all units:
 * - Per-unit pricing with nights calculation
 * - Weekend surcharges and extra person fees
 * - Subtotal calculation
 * - Bulk discount (if applicable)
 * - Total amount
 * - Promotional message for bulk discounts
 *
 * @module MultiUnitPricingSummary
 */

import {
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import type { BookingUnit } from "@/types/multi-unit-booking";

// ============================================
// TYPES
// ============================================

export interface MultiUnitPricingSummaryProps {
  units: BookingUnit[];
  discount?: number;
  showBreakdown?: boolean;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MultiUnitPricingSummary({
  units,
  discount = 0,
  showBreakdown = true,
}: MultiUnitPricingSummaryProps) {
  const subtotal = units.reduce((sum, unit) => sum + unit.pricing.unit_total, 0);
  const total = subtotal - discount;
  const hasMultipleUnits = units.length > 1;
  const shouldShowBulkDiscountPromo = units.length >= 3 && discount === 0;

  return (
    <Card role="region" aria-label="Pricing summary">
      <CardHeader>
        <CardTitle>Pricing Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Per-Unit Breakdown */}
        {showBreakdown &&
          hasMultipleUnits &&
          units.map((unit, index) => (
            <div key={unit.unit_id} className="space-y-1">
              <div
                className="flex justify-between font-medium"
                aria-label={`Cabin ${index + 1} ${unit.unit_name} total`}
              >
                <span>
                  Cabin {index + 1}: {unit.unit_name}
                </span>
                <span className="tabular-nums">{formatCurrency(unit.pricing.unit_total)}</span>
              </div>
              <div className="text-muted-foreground pl-4 text-sm">
                {unit.pricing.nights} night{unit.pricing.nights !== 1 ? "s" : ""} ×{" "}
                {formatCurrency(unit.base_rate)}
                {unit.pricing.weekend_surcharge > 0 &&
                  ` + ${formatCurrency(unit.pricing.weekend_surcharge)} weekend`}
                {unit.pricing.extra_person_fee > 0 &&
                  ` + ${formatCurrency(unit.pricing.extra_person_fee)} extra persons`}
              </div>
            </div>
          ))}

        {hasMultipleUnits && showBreakdown && <Separator aria-hidden="true" />}

        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between" aria-label={`Subtotal ${formatCurrency(subtotal)}`}>
            <span>Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>

          {discount > 0 && (
            <div
              className="text-success-foreground flex justify-between"
              aria-label={`Bulk discount ${formatCurrency(discount)}`}
            >
              <span>Bulk Discount</span>
              <span className="tabular-nums">-{formatCurrency(discount)}</span>
            </div>
          )}

          <Separator aria-hidden="true" />

          <div
            className="flex justify-between text-lg font-semibold"
            aria-label={`Total amount ${formatCurrency(total)}`}
          >
            <span>TOTAL</span>
            <span className="tabular-nums">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Bulk Discount Promotional Message */}
        {shouldShowBulkDiscountPromo && (
          <Callout tone="info">Book 3+ units to get a bulk discount!</Callout>
        )}

        {/* Discount Applied Message */}
        {discount > 0 && (
          <Callout tone="success">
            Bulk discount applied! You saved {formatCurrency(discount)}
          </Callout>
        )}
      </CardContent>
    </Card>
  );
}
