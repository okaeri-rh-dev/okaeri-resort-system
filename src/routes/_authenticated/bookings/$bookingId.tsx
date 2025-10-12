/**
 * Booking Detail Route
 *
 * Displays comprehensive booking information with:
 * - Booking details and status
 * - Unit assignments
 * - Payment history
 * - Audit trail (Phase 4.5)
 * - Real-time updates (Phase 4.5)
 *
 * @module BookingDetailRoute
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { useBookingRealtime } from "@/hooks/useBookingRealtime";
import { useAuditStore } from "@/stores/useAuditStore";
import { useEffect } from "react";
import { format } from "date-fns";
import { Calendar, Users, CreditCard, MapPin, Edit, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/bookings/$bookingId")({
  component: BookingDetailPage,
});

function BookingDetailPage() {
  const { bookingId } = Route.useParams();
  const setFilters = useAuditStore((state) => state.setFilters);

  // ✅ Enable real-time booking updates (Phase 4.5 - Task 3)
  useBookingRealtime(bookingId);

  // Set audit filters for this booking
  useEffect(() => {
    setFilters({
      entity_type: "booking",
      entity_id: bookingId,
      limit: 10,
    });
  }, [bookingId, setFilters]);

  // Fetch booking data
  const { data: booking, isLoading } = useQuery({
    queryKey: ["bookings", bookingId],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/${bookingId}`);
      if (!response.ok) throw new Error("Failed to fetch booking");
      const data = await response.json();
      return data.data as any;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Booking not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/bookings">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Bookings
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{booking.booking_reference}</h1>
          <p className="text-muted-foreground">Booking Details</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              booking.booking_status === "Confirmed"
                ? "default"
                : booking.booking_status === "Pending"
                  ? "secondary"
                  : booking.booking_status === "CheckedIn"
                    ? "default"
                    : "destructive"
            }
          >
            {booking.booking_status}
          </Badge>
          <Badge
            variant={
              booking.payment_status === "Paid"
                ? "default"
                : booking.payment_status === "Partial"
                  ? "secondary"
                  : "outline"
            }
          >
            {booking.payment_status}
          </Badge>
          <Button size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Guest Information */}
        <Card>
          <CardHeader>
            <CardTitle>Guest Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">{booking.guest_name}</p>
                <p className="text-sm text-muted-foreground">{booking.email}</p>
                <p className="text-sm text-muted-foreground">{booking.contact_number}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Number of Guests</p>
                <p className="text-2xl font-bold">{booking.num_guests}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Check-in</p>
                <p className="text-lg">{format(new Date(booking.check_in), "PPP 'at' p")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Check-out</p>
                <p className="text-lg">{format(new Date(booking.check_out), "PPP 'at' p")}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Unit</p>
                <p className="text-lg font-semibold">
                  {booking.unit?.unit_name || "Multiple Units"}
                </p>
                {booking.unit?.unit_code && (
                  <p className="text-sm text-muted-foreground">{booking.unit.unit_code}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Multi-Unit Details (if applicable) */}
      {booking.is_multi_unit && booking.booking_units?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Units</CardTitle>
            <CardDescription>{booking.booking_units.length} units in this booking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {booking.booking_units.map((bu: any) => (
                <div
                  key={bu.booking_unit_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{bu.unit?.unit_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {bu.assigned_guests} guests • ₱{bu.subtotal.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">₱{bu.unit_price.toLocaleString()}</p>
                    {bu.weekend_surcharge > 0 && (
                      <p className="text-xs text-muted-foreground">
                        +₱{bu.weekend_surcharge.toLocaleString()} weekend
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">₱{booking.base_amount?.toLocaleString() || "0"}</span>
          </div>
          {booking.total_surcharges > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Surcharges</span>
              <span className="font-medium">₱{booking.total_surcharges.toLocaleString()}</span>
            </div>
          )}
          {booking.discount_amount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount</span>
              <span className="font-medium">-₱{booking.discount_amount.toLocaleString()}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>Total Amount</span>
            <span>₱{booking.total_amount.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            <span>Payment Status: {booking.payment_status}</span>
          </div>
        </CardContent>
      </Card>

      {/* Special Requests */}
      {booking.special_requests && (
        <Card>
          <CardHeader>
            <CardTitle>Special Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{booking.special_requests}</p>
          </CardContent>
        </Card>
      )}

      {/* ✅ Audit Trail (Phase 4.5 - Task 2) */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
          <CardDescription>
            Complete history of all changes and actions for this booking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogViewer />
        </CardContent>
      </Card>
    </div>
  );
}
