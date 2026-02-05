import { useEffect, useState } from "react";

import { format } from "date-fns";
import { AlertTriangle, Info } from "lucide-react";

import { PricingStatusBadge } from "@/components/pricing/PricingStatusBadge";
import { Alert, AlertDescription } from "@/components/ui/alert";
// Removed unused import: Badge
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { usePricingCalculation } from "@/hooks/usePricingCalculation";
import type { MultiUnitPricingResult, PricingResult } from "@/types/api/pricing";
import type { UnitRequest } from "@/types/guest-booking-multi-unit";

/**
 * Extended UnitRequest that may include a unit_id when provided by the form.
 * The base UnitRequest only has guests_per_unit, but forms may pass unit_id.
 */
interface UnitRequestWithOptionalId extends UnitRequest {
  unit_id?: string;
}

export interface PaymentSummaryProps {
  unitRequests: UnitRequestWithOptionalId[];
  checkIn: Date | undefined;
  checkOut: Date | undefined;
}

export function PaymentSummary({ unitRequests, checkIn, checkOut }: PaymentSummaryProps) {
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);
  const [pricingData, setPricingData] = useState<PricingResult | MultiUnitPricingResult | null>(
    null
  );

  // Initialize pricing calculation hook
  const calculatePricing = usePricingCalculation({
    onSuccess: (data) => {
      setPricingNotice(data.notice);
      setPricingData(data.pricing);
    },
    onError: () => {
      setPricingNotice(null);
      setPricingData(null);
    },
  });

  useEffect(() => {
    // Clear pricing if required fields are missing
    if (unitRequests.length === 0 || !checkIn || !checkOut) {
      setPricingData(null);
      setPricingNotice(null);
      return;
    }

    // Format dates for API
    const checkInStr = format(checkIn, "yyyy-MM-dd");
    const checkOutStr = format(checkOut, "yyyy-MM-dd");

    // Debounce API call by 500ms
    const timer = setTimeout(() => {
      // Calculate total guest count
      const totalGuests = unitRequests.reduce((sum, req) => sum + req.guests_per_unit, 0);

      // Build pricing request based on what data we have
      if (unitRequests.length > 1) {
        // Multi-unit booking - map requests properly (don't send empty strings for unit_id)
        const unitRequestsForApi = unitRequests
          .filter((req): req is UnitRequestWithOptionalId & { unit_id: string } => !!req.unit_id)
          .map((req) => ({
            unit_id: req.unit_id,
            guest_count: req.guests_per_unit,
          }));

        // If no unit IDs present, build without unit_requests
        if (unitRequestsForApi.length > 0) {
          calculatePricing.mutate({
            check_in: checkInStr,
            check_out: checkOutStr,
            guest_count: totalGuests, // Include total at top level
            unit_requests: unitRequestsForApi,
          });
        } else {
          calculatePricing.mutate({
            check_in: checkInStr,
            check_out: checkOutStr,
            guest_count: totalGuests,
          });
        }
      } else if (unitRequests[0]?.unit_id) {
        // Single unit with specific unit ID
        calculatePricing.mutate({
          check_in: checkInStr,
          check_out: checkOutStr,
          guest_count: totalGuests,
          unit_id: unitRequests[0].unit_id,
        });
      } else {
        // Single unit, no specific unit - use simple guest count pricing
        calculatePricing.mutate({
          check_in: checkInStr,
          check_out: checkOutStr,
          guest_count: totalGuests,
        });
      }
    }, 500);

    // Cleanup function to clear timer
    return () => clearTimeout(timer);
  }, [unitRequests, checkIn, checkOut]);

  // Empty state: No units added yet
  if (unitRequests.length === 0 || !checkIn || !checkOut) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Add units to see pricing estimate</AlertDescription>
      </Alert>
    );
  }

  // Loading state: Calculating pricing
  if (calculatePricing.isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Separator />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state: Failed to calculate pricing
  if (calculatePricing.isError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Unable to calculate pricing. Please try again.</AlertDescription>
      </Alert>
    );
  }

  // Success state: Display pricing breakdown
  if (!pricingData) {
    return null;
  }

  // Extract pricing data (handles both single and multi-unit responses)
  const isMultiUnit = "units" in pricingData;
  const pricing = isMultiUnit
    ? {
        nights: pricingData.nights,
        total: pricingData.total,
        downpayment: pricingData.downpayment,
        total_units: pricingData.units.length,
        total_guests: pricingData.units.reduce(
          (sum: number, u) => sum + u.pricing.extraPersons + 2,
          0
        ),
      }
    : {
        nights: pricingData.nights,
        total: pricingData.total,
        downpayment: pricingData.downpayment,
        total_units: 1,
        total_guests: pricingData.extraPersons + 2,
      };

  return (
    <div className="space-y-4">
      {/* Preview Warning Banner */}
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Preview Only - Final pricing calculated by server at booking submission
        </AlertDescription>
      </Alert>

      {/* Pricing Card */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stay Details */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cabins:</span>
              <span className="font-medium">{pricing.total_units}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Guests:</span>
              <span className="font-medium">{pricing.total_guests}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nights:</span>
              <span className="font-medium">{pricing.nights}</span>
            </div>
          </div>

          <Separator />

          {/* Total */}
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>₱{pricing.total.toLocaleString()}</span>
          </div>

          {/* Downpayment Required */}
          <div className="flex justify-between text-base font-semibold">
            <span>Downpayment Required (50%):</span>
            <span className="text-primary">₱{pricing.downpayment.toLocaleString()}</span>
          </div>

          {/* Seasonal Rates Notice */}
          {pricingNotice && (
            <div className="pt-2">
              <PricingStatusBadge
                notice={pricingNotice}
                isLoading={calculatePricing.isPending}
                size="sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Assignment Notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Downpayment secures your booking. Admin assigns specific units after payment verification,
          typically within 4-24 hours.
        </AlertDescription>
      </Alert>
    </div>
  );
}
