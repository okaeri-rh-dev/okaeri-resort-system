import React from "react";
import { format, differenceInDays } from "date-fns";
import { CheckCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/validations";

import type { StepProps } from "../types";
import type { Unit } from "@/types";

interface BookingReviewProps extends StepProps {
  units?: Unit[];
}

export function BookingReview({ form, calculatedTotal = 0, units = [] }: BookingReviewProps) {
  const values = form.getValues();
  const selectedUnit = units.find((u) => u.id === values.unit_id);
  const nights = differenceInDays(new Date(values.check_out), new Date(values.check_in));

  if (!selectedUnit) {
    return <div>Please complete all previous steps</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="text-green-700 font-medium">Please review your booking details</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Accommodation</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit:</span>
                  <span className="font-medium">{selectedUnit.unit_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="secondary">{selectedUnit.unit_type}</Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Stay Details</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in:</span>
                  <span>{format(new Date(values.check_in), "PPP")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out:</span>
                  <span>{format(new Date(values.check_out), "PPP")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nights:</span>
                  <span>
                    {nights} {nights === 1 ? "night" : "nights"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guests:</span>
                  <span>
                    {values.num_guests} {values.num_guests === 1 ? "guest" : "guests"}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Guest Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span>{values.guest_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{values.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span>{values.contact_number}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <h3 className="font-semibold mb-2">Payment</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method:</span>
                  <Badge>{values.payment_method}</Badge>
                </div>
              </div>
            </div>

            {values.special_requests && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-2">Special Requests</h3>
                  <p className="text-sm text-muted-foreground">{values.special_requests}</p>
                </div>
              </>
            )}

            <Separator />

            <div className="pt-2">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Amount:</span>
                <span className="text-green-600">{formatCurrency(calculatedTotal)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        By confirming this booking, you agree to our terms and conditions.
      </div>
    </div>
  );
}
