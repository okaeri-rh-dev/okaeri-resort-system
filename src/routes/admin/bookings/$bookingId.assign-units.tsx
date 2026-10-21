/**
 * Admin Unit Assignment Route
 *
 * Route: /admin/bookings/$bookingId/assign-units
 * Displays unit assignment interface for pending guest bookings
 * with payment verification and assignment guards.
 *
 * Guards (render-based):
 * - Loading guard: Shows loading spinner while fetching
 * - Not found guard: Error if booking doesn't exist
 * - Payment verification guard: Blocks if payment not verified
 * - Already assigned guard: Blocks if units already assigned
 */

import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailField,
  Skeleton,
} from "@/components/patterns";
import { useAuthToken } from "@/hooks/useAuthToken";
import { isPaymentReceived, manilaDayOf } from "@/lib/bookings";
import { pluralize } from "@/lib/formatters";
import { formatCurrency, formatDate } from "@/lib/utils";
import { adminBookingDetailQuery } from "@/stores/useBookingStore";
import type { PaymentStatus } from "@/types";

// ============================================
// Types
// ============================================

interface UnitRequest {
  id: string;
  guests_per_unit: number;
}

interface BookingDetail {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  guest_contact: string;
  check_in: string;
  check_out: string;
  total_amount: number;
  payment_status: PaymentStatus;
  unit_assignment_status: "pending" | "assigned" | "partial";
  payment_proof_url: string | null;
  requested_unit_count: number;
  unit_requests: UnitRequest[];
  created_at: string;
}

// ============================================
// Route Definition
// ============================================

export const Route = createFileRoute("/admin/bookings/$bookingId/assign-units")({
  component: AssignUnitsPage,
});

// ============================================
// Guard Components
// ============================================

/**
 * Payment Not Verified Guard
 * Blocks access when payment verification is required
 */
function PaymentNotVerifiedGuard({
  bookingId,
  bookingReference,
}: {
  bookingId: string;
  bookingReference: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/admin/bookings/queue", // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cabin Assignment</h1>
          <p className="text-muted-foreground">Booking: {bookingReference}</p>
        </div>
      </div>

      {/* Guard Alert */}
      <Callout tone="warning" title="Payment Not Verified">
        <div className="space-y-4">
          <p>
            Payment must be verified before assigning cabins to this booking. Please verify the
            payment proof first.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() =>
                navigate({
                  to: `/admin/verify-payment/${bookingId}`, // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Verify Payment
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/admin/bookings/queue", // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
              }
              className="text-foreground"
            >
              Back to Queue
            </Button>
          </div>
        </div>
      </Callout>
    </div>
  );
}

/**
 * Already Assigned Guard
 * Blocks access when units are already assigned
 */
function AlreadyAssignedGuard({
  bookingId,
  bookingReference,
}: {
  bookingId: string;
  bookingReference: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/admin/bookings/queue", // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cabin Assignment</h1>
          <p className="text-muted-foreground">Booking: {bookingReference}</p>
        </div>
      </div>

      {/* Guard Alert */}
      <Callout tone="info" title="Cabins Already Assigned">
        <div className="space-y-4">
          <p>
            Cabins have already been assigned to this booking. You can view the booking details or
            return to the queue.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() =>
                navigate({
                  to: "/admin/bookings/$bookingId",
                  params: { bookingId },
                } as unknown as Parameters<typeof navigate>[0])
              }
            >
              View Booking Details
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                navigate({
                  to: "/admin/bookings/queue",
                } as Parameters<typeof navigate>[0])
              }
              className="text-foreground"
            >
              Back to Queue
            </Button>
          </div>
        </div>
      </Callout>
    </div>
  );
}

/**
 * Loading State Component
 */
function LoadingState({ bookingReference }: { bookingReference?: string }) {
  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-32" />
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          {bookingReference && <p className="text-muted-foreground">Booking: {bookingReference}</p>}
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Loading booking details...</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Error State Component
 */
function ErrorState({ error, bookingId }: { error: Error | null; bookingId: string }) {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/admin/bookings/queue", // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cabin Assignment</h1>
          <p className="text-muted-foreground">Booking ID: {bookingId}</p>
        </div>
      </div>

      <Callout tone="danger" title="Error Loading Booking">
        {error?.message || "Failed to load booking details. The booking may not exist."}
      </Callout>

      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground text-center">
            Unable to load booking details. Please try again or contact support if the problem
            persists.
          </p>
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()} variant="outline">
              Retry
            </Button>
            <Button
              onClick={() =>
                navigate({
                  to: "/admin/bookings/queue", // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
              }
            >
              Back to Queue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BookingSummaryCard({
  booking,
  unitRequests,
}: {
  booking: BookingDetail;
  unitRequests: UnitRequest[];
}) {
  const totalGuests = unitRequests.reduce((sum, request) => sum + request.guests_per_unit, 0);

  return (
    <Card padding="none">
      <CardHeader>
        <CardTitle>Booking Summary</CardTitle>
      </CardHeader>
      <CardContent className="@container space-y-4">
        <div className="grid grid-cols-2 gap-4 @lg:grid-cols-3">
          <div className="col-span-2 min-w-0 @lg:col-span-1">
            <DetailField
              label="Guest"
              emphasis="strong"
              value={
                <>
                  {booking.guest_name}
                  <span className="text-muted-foreground block text-xs font-normal">
                    {booking.guest_contact}
                  </span>
                </>
              }
            />
          </div>
          <DetailField
            label="Check-in"
            value={formatDate(new Date(booking.check_in))}
            emphasis="strong"
          />
          <DetailField
            label="Check-out"
            value={formatDate(new Date(booking.check_out))}
            emphasis="strong"
          />
          <DetailField
            label="Total Amount"
            value={formatCurrency(booking.total_amount)}
            emphasis="figure"
          />
          <DetailField label="Cabins requested" value={unitRequests.length} emphasis="figure" />
          <DetailField label="Guests" value={totalGuests} emphasis="figure" />
        </div>

        {unitRequests.length > 1 && (
          <div className="border-t pt-4">
            <p className="text-muted-foreground mb-2 text-sm">Guests per cabin</p>
            <ul className="flex flex-wrap gap-2">
              {unitRequests.map((request, index) => (
                <li key={request.id} className="bg-muted rounded-md border px-3 py-1.5 text-xs">
                  <span className="font-medium">Cabin {index + 1}:</span>{" "}
                  <span className="font-semibold tabular-nums">{request.guests_per_unit}</span>{" "}
                  {pluralize(request.guests_per_unit, "guest")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Component
// ============================================

function AssignUnitsPage() {
  const navigate = useNavigate();
  const { bookingId } = Route.useParams();
  const { token: authToken, isLoading: isAuthLoading, error: authError } = useAuthToken();

  // Fetch booking details with TanStack Query
  const {
    data: booking,
    isLoading,
    error,
  } = useQuery({
    ...adminBookingDetailQuery<BookingDetail>(bookingId),
    enabled: !!authToken, // Only fetch when authenticated
  });

  // ============================================
  // Success Handler
  // ============================================

  const handleAssignmentSuccess = () => {
    toast.success(
      `Cabins successfully assigned to booking ${booking?.booking_reference}. The guest will receive a confirmation email shortly.`
    );

    void navigate({ to: "/admin/bookings/queue" });
  };

  // ============================================
  // Render Guards
  // ============================================

  // Auth loading guard
  if (isAuthLoading) {
    return <LoadingState bookingReference={undefined} />;
  }

  // Auth error guard
  if (authError) {
    return <ErrorState error={authError} bookingId={bookingId} />;
  }

  // Loading guard
  if (isLoading) {
    return <LoadingState bookingReference={undefined} />;
  }

  // Not found guard
  if (error || !booking) {
    return <ErrorState error={error} bookingId={bookingId} />;
  }

  if (!isPaymentReceived(booking.payment_status)) {
    return (
      <PaymentNotVerifiedGuard bookingId={bookingId} bookingReference={booking.booking_reference} />
    );
  }

  // Already assigned guard
  if (booking.unit_assignment_status === "assigned") {
    return (
      <AlreadyAssignedGuard bookingId={bookingId} bookingReference={booking.booking_reference} />
    );
  }

  const unitRequests = booking.unit_requests ?? [];

  // ============================================
  // Main Render
  // ============================================

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/admin/bookings/queue", // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any)
          }
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Queue
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assign Cabins</h1>
          <p className="text-muted-foreground">Booking: {booking.booking_reference}</p>
        </div>
      </div>

      <BookingSummaryCard booking={booking} unitRequests={unitRequests} />

      {/* Payment Status Badge */}
      <Callout tone="success" title="Payment Verified">
        Payment has been verified. You can now proceed with cabin assignment.
      </Callout>

      {/* Unit Assignment Interface */}
      <UnitAssignmentInterface
        bookingId={bookingId}
        bookingReference={booking.booking_reference}
        checkInDate={manilaDayOf(booking.check_in)}
        checkOutDate={manilaDayOf(booking.check_out)}
        unitRequests={unitRequests}
        onAssignmentSuccess={handleAssignmentSuccess}
      />
    </div>
  );
}
