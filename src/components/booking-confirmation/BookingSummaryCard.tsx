import { Calendar, MapPin, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

interface BookingSummaryCardProps {
  checkIn: string;
  checkOut: string;
  unitRequests: Array<{ guests_per_unit: number }>;
  specialRequests?: string;
  pricingBreakdown: {
    base_total: number;
    weekend_surcharge: number;
    extra_person_fees: number;
    subtotal: number;
    discount_amount: number;
    total: number;
    nights: number;
  };
  discountApplied?: {
    percent: number;
    amount: number;
    rule_name: string;
  };
}

export function BookingSummaryCard({
  checkIn,
  checkOut,
  unitRequests,
  specialRequests,
  pricingBreakdown,
  discountApplied,
}: BookingSummaryCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PH", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalUnits = unitRequests.length;
  const totalGuests = unitRequests.reduce((sum, req) => sum + req.guests_per_unit, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Booking Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Dates */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-muted-foreground mb-1 text-sm">Check-in</p>
            <p className="font-medium">{formatDate(checkIn)}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1 text-sm">Check-out</p>
            <p className="font-medium">{formatDate(checkOut)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <MapPin className="text-muted-foreground h-4 w-4" />
          <span className="text-muted-foreground">{pricingBreakdown.nights} nights</span>
        </div>

        <Separator />

        {/* Cabins and Guests */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-semibold">
              <Users className="h-4 w-4" />
              Cabins Requested
            </h4>
            <Badge variant="secondary">
              {totalUnits} {totalUnits === 1 ? "cabin" : "cabins"}, {totalGuests}{" "}
              {totalGuests === 1 ? "guest" : "guests"}
            </Badge>
          </div>

          <div className="space-y-2">
            {unitRequests.map((req, index) => (
              <div key={index} className="bg-muted flex justify-between rounded-md p-3 text-sm">
                <span>Cabin {index + 1}</span>
                <span className="font-medium">
                  {req.guests_per_unit} {req.guests_per_unit === 1 ? "guest" : "guests"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Special Requests */}
        {specialRequests && (
          <>
            <Separator />
            <div>
              <p className="text-muted-foreground mb-2 text-sm">Special Requests</p>
              <p className="text-sm">{specialRequests}</p>
            </div>
          </>
        )}

        <Separator />

        {/* Pricing Breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Base Total:</span>
            <span>₱{pricingBreakdown.base_total.toLocaleString("en-PH")}</span>
          </div>

          {pricingBreakdown.weekend_surcharge > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Weekend Surcharge:</span>
              <span>₱{pricingBreakdown.weekend_surcharge.toLocaleString("en-PH")}</span>
            </div>
          )}

          {pricingBreakdown.extra_person_fees > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Extra Person Fees:</span>
              <span>₱{pricingBreakdown.extra_person_fees.toLocaleString("en-PH")}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between font-medium">
            <span>Subtotal:</span>
            <span>₱{pricingBreakdown.subtotal.toLocaleString("en-PH")}</span>
          </div>

          {discountApplied && (
            <div className="flex justify-between text-green-600">
              <div className="flex items-center gap-2">
                <span>Discount ({discountApplied.percent}%)</span>
                <Badge variant="secondary" className="text-xs">
                  {discountApplied.rule_name}
                </Badge>
              </div>
              <span>-₱{discountApplied.amount.toLocaleString("en-PH")}</span>
            </div>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>₱{pricingBreakdown.total.toLocaleString("en-PH")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
