import { useEffect, useState } from "react";

import {
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from "@/components/patterns";
import { PricingStatusBadge } from "@/components/pricing/PricingStatusBadge";
import { usePricingCalculation } from "@/hooks/usePricingCalculation";
import type { ManilaDay } from "@/lib/bookings/stay";
import type { MultiUnitPricingResult, PricingResult } from "@/types/api/pricing";
import type { UnitRequest } from "@/types/guest-booking-multi-unit";

export interface PaymentSummaryProps {
  unitRequests: UnitRequest[];
  checkIn: ManilaDay | undefined;
  checkOut: ManilaDay | undefined;
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

  const totalGuests = unitRequests.reduce((sum, req) => sum + req.guests_per_unit, 0);

  useEffect(() => {
    // Clear pricing if required fields are missing
    if (unitRequests.length === 0 || !checkIn || !checkOut) {
      setPricingData(null);
      setPricingNotice(null);
      return;
    }

    // Debounce API call by 500ms
    const timer = setTimeout(() => {
      // One request per cabin, so the preview prices cabins like the booking endpoint does
      calculatePricing.mutate({
        check_in: checkIn,
        check_out: checkOut,
        guest_count: totalGuests,
        unit_requests: unitRequests.map((req) => ({ guest_count: req.guests_per_unit })),
      });
    }, 500);

    // Cleanup function to clear timer
    return () => clearTimeout(timer);
  }, [unitRequests, checkIn, checkOut]);

  // Empty state: No units added yet
  if (unitRequests.length === 0 || !checkIn || !checkOut) {
    return <Callout tone="info">Add units to see pricing estimate</Callout>;
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
    return <Callout tone="danger">Unable to calculate pricing. Please try again.</Callout>;
  }

  // Success state: Display pricing breakdown
  if (!pricingData) {
    return null;
  }

  const pricing = {
    nights: pricingData.nights,
    total: pricingData.total,
    downpayment: pricingData.downpayment,
    total_units: unitRequests.length,
    total_guests: totalGuests,
  };

  return (
    <div className="space-y-4">
      {/* Preview Warning Banner */}
      <Callout tone="warning">
        Preview Only - Final pricing calculated by server at booking submission
      </Callout>

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
              <PricingStatusBadge notice={pricingNotice} isLoading={calculatePricing.isPending} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin Assignment Notice */}
      <Callout tone="info">
        Downpayment secures your booking. Admin assigns specific units after payment verification,
        typically within 4-24 hours.
      </Callout>
    </div>
  );
}
