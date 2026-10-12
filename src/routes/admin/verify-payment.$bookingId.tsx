/**
 * Admin Payment Verification Route
 *
 * Route: /admin/verify-payment/$bookingId
 * Displays payment proof viewer for booking
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { PaymentProofViewer } from "@/components/admin/PaymentProofViewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthToken } from "@/hooks/useAuthToken";
import { formatCurrency, formatDate } from "@/lib/utils";
import { adminBookingDetailQuery } from "@/stores/useBookingStore";

// Type for booking detail response
interface BookingDetail {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  payment_status: "Pending" | "Verified" | "Rejected";
  payment_proof_path: string | null;
  requested_unit_count: number;
  created_at: string;
}

export const Route = createFileRoute("/admin/verify-payment/$bookingId")({
  component: PaymentVerificationPage,
});

function PaymentVerificationPage() {
  const { bookingId } = Route.useParams();
  const { token: authToken, isLoading: isAuthLoading, error: authError } = useAuthToken();

  // Fetch booking details
  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    ...adminBookingDetailQuery<BookingDetail>(bookingId),
    enabled: !!authToken, // Only fetch when authenticated
  });

  const handleStatusChange = () => {
    // Navigate back to queue or to unit assignment if verified
    if (booking?.payment_status === "Verified") {
      window.location.href = `/admin/bookings/${bookingId}/assign-units`;
    } else {
      window.location.href = "/admin/bookings/queue";
    }
  };

  // Auth loading state
  if (isAuthLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Authenticating...</div>
      </div>
    );
  }

  // Auth error state
  if (authError) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-destructive text-center">
          Authentication error: {authError.message || "Please sign in again."}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading booking details...</div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-destructive text-center">
          Error loading booking: {error?.message || "Booking not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8" data-testid="payment-verification">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window.location.href = "/admin/bookings/queue")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Verification</h1>
          <p className="text-muted-foreground">Booking: {booking.booking_reference}</p>
        </div>
      </div>

      {/* Booking Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-sm">Guest</div>
            <div className="font-medium">{booking.guest_name}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Check-in</div>
            <div className="font-medium">{formatDate(new Date(booking.check_in))}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Cabins Requested</div>
            <div className="font-medium">{booking.requested_unit_count}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Total Amount</div>
            <div className="font-mono font-medium">{formatCurrency(booking.total_amount)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Proof Viewer */}
      <PaymentProofViewer
        bookingId={bookingId}
        paymentProofPath={booking.payment_proof_path}
        currentPaymentStatus={booking.payment_status}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
