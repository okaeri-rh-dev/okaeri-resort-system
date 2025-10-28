import { useEffect, useState } from "react";

import { AlertTriangle, Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { previewPricing } from "@/lib/api/guest-booking-client";
import type { PricingPreview, UnitRequest } from "@/types/guest-booking-multi-unit";

export interface PaymentSummaryProps {
  unitRequests: UnitRequest[];
  checkIn: Date | undefined;
  checkOut: Date | undefined;
}

export function PaymentSummary({ unitRequests, checkIn, checkOut }: PaymentSummaryProps) {
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear pricing if required fields are missing
    if (unitRequests.length === 0 || !checkIn || !checkOut) {
      setPricing(null);
      return;
    }

    // Capture dates to satisfy TypeScript null safety
    const checkInDate = checkIn;
    const checkOutDate = checkOut;

    // Debounce API call by 500ms
    const timer = setTimeout(() => {
      // Defensive guard (should never hit, but satisfies TypeScript)
      if (!checkInDate || !checkOutDate) return;

      async function fetchPricing() {
        setLoading(true);
        setError(null);
        try {
          const response = await previewPricing({
            unit_requests: unitRequests,
            check_in: checkInDate.toISOString(),
            check_out: checkOutDate.toISOString(),
          });
          setPricing(response.pricing);
        } catch (err) {
          console.error("[PaymentSummary] Pricing preview error:", err);
          setError("Unable to calculate pricing. Please try again.");
          setPricing(null);
        } finally {
          setLoading(false);
        }
      }
      fetchPricing();
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
  if (loading) {
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
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // Success state: Display pricing breakdown
  if (!pricing) {
    return null;
  }

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
              <span className="text-muted-foreground">Units:</span>
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

          {/* Pricing Components */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Base Total:</span>
              <span className="font-medium">₱{pricing.base_total.toLocaleString()}</span>
            </div>
            {pricing.weekend_surcharge > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Weekend Surcharge:</span>
                <span className="font-medium">₱{pricing.weekend_surcharge.toLocaleString()}</span>
              </div>
            )}
            {pricing.extra_person_fees > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Extra Person Fees:</span>
                <span className="font-medium">₱{pricing.extra_person_fees.toLocaleString()}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Subtotal */}
          <div className="flex justify-between text-sm font-medium">
            <span>Subtotal:</span>
            <span>₱{pricing.subtotal.toLocaleString()}</span>
          </div>

          {/* Discount (if applicable) */}
          {pricing.discount && (
            <>
              <div className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    Discount ({pricing.discount.percent}%):
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {pricing.discount.rule_name}
                  </Badge>
                </div>
                <span className="font-medium text-green-600">
                  -₱{pricing.discount.amount.toLocaleString()}
                </span>
              </div>
              <Separator />
            </>
          )}

          {/* Total */}
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>₱{pricing.total.toLocaleString()}</span>
          </div>

          {/* Downpayment Required */}
          <div className="flex justify-between text-lg font-bold">
            <span>Downpayment Required ({pricing.downpayment_percent}%):</span>
            <span className="text-primary">₱{pricing.downpayment_required.toLocaleString()}</span>
          </div>
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
