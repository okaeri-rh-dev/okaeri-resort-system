/**
 * Admin Unit Assignment Route
 *
 * Route: /admin/bookings/$bookingId/assign-units
 * Displays unit assignment interface for pending multi-unit bookings
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
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

import { UnitAssignmentInterface } from "@/components/admin/UnitAssignmentInterface";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthToken } from "@/hooks/useAuthToken";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  payment_status: "Pending" | "Verified" | "Completed" | "Rejected"; // Added Completed to match DB function
  unit_assignment_status: "pending" | "assigned" | "partial";
  payment_proof_path: string | null;
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
      <Card className="border-yellow-500/50 bg-yellow-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 text-yellow-600" />
            <div>
              <CardTitle className="text-yellow-900">Payment Not Verified</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-yellow-900">
            Payment must be verified before assigning units to this booking. Please verify the
            payment proof first.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() =>
                navigate({
                  to: `/admin/verify-payment/${bookingId}`, // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
              }
              className="bg-yellow-600 hover:bg-yellow-700"
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
            >
              Back to Queue
            </Button>
          </div>
        </CardContent>
      </Card>
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
      <Card className="border-blue-500/50 bg-blue-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-1 h-5 w-5 text-blue-600" />
            <div>
              <CardTitle className="text-blue-900">Cabins Already Assigned</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-blue-900">
            Cabins have already been assigned to this booking. You can view the booking details or
            return to the queue.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() =>
                navigate({
                  to: "/admin/bookings/$bookingId",
                  params: { bookingId },
                } as Parameters<typeof navigate>[0])
              }
              className="bg-blue-600 hover:bg-blue-700"
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
            >
              Back to Queue
            </Button>
          </div>
        </CardContent>
      </Card>
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
        <div className="h-9 w-32 animate-pulse rounded bg-gray-200" />
        <div>
          <div className="mb-2 h-8 w-64 animate-pulse rounded bg-gray-200" />
          {bookingReference && <p className="text-muted-foreground">Booking: {bookingReference}</p>}
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-neutral-600">
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

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error Loading Booking</AlertTitle>
        <AlertDescription>
          {error?.message || "Failed to load booking details. The booking may not exist."}
        </AlertDescription>
      </Alert>

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
  } = useQuery<BookingDetail>({
    queryKey: ["booking", bookingId],
    enabled: !!authToken, // Only fetch when authenticated
    queryFn: async () => {
      if (!authToken) {
        throw new Error("Not authenticated. Please sign in again.");
      }

      const response = await fetch(`/api/admin/bookings/${bookingId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: "Failed to fetch booking" }))) as { error?: string };
        throw new Error(errorData.error || "Failed to fetch booking details");
      }

      return response.json() as Promise<BookingDetail>;
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
  });

  // ============================================
  // Success Handler
  // ============================================

  const handleAssignmentSuccess = () => {
    // Show success message (using native alert for simplicity)
    alert(
      `Cabins successfully assigned to booking ${booking?.booking_reference}!\n\nThe guest will receive a confirmation email shortly.`
    );

    // Navigate back to admin queue
    // Using window.location for simplicity and to ensure fresh data load
    window.location.href = "/admin/queue";
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

  // Payment verification guard - Accept both Verified and Completed statuses
  if (!["Verified", "Completed"].includes(booking.payment_status)) {
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

      {/* Booking Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <div className="text-muted-foreground text-sm">Guest</div>
            <div className="font-medium">{booking.guest_name}</div>
            <div className="text-muted-foreground text-xs">{booking.guest_contact}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Check-in</div>
            <div className="font-medium">{formatDate(new Date(booking.check_in))}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Check-out</div>
            <div className="font-medium">{formatDate(new Date(booking.check_out))}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-sm">Total Amount</div>
            <div className="font-mono font-medium">{formatCurrency(booking.total_amount)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Status Badge */}
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">Payment Verified</AlertTitle>
        <AlertDescription className="text-green-800">
          Payment has been verified. You can now proceed with unit assignment.
        </AlertDescription>
      </Alert>

      {/* Unit Assignment Interface */}
      <UnitAssignmentInterface
        bookingId={bookingId}
        checkInDate={booking.check_in}
        checkOutDate={booking.check_out}
        unitRequests={booking.unit_requests || []}
        onAssignmentSuccess={handleAssignmentSuccess}
      />
    </div>
  );
}
