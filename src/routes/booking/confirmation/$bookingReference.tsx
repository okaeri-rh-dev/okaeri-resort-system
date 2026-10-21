import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { BookingReferenceDisplay } from "@/components/booking-confirmation/BookingReferenceDisplay";
import { BookingSummaryCard } from "@/components/booking-confirmation/BookingSummaryCard";
import { PaymentInstructions } from "@/components/booking-confirmation/PaymentInstructions";
import { PrintButton } from "@/components/booking-confirmation/PrintButton";
import { StatusTimeline } from "@/components/booking-confirmation/StatusTimeline";
import { ContactChannelList } from "@/components/contact-channels/ContactChannelList";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useActiveContactChannels } from "@/hooks/useContactChannels";
import { GuestLayout } from "@/layouts/GuestLayout";

/**
 * Booking confirmation data structure returned from the API
 */
interface BookingConfirmationData {
  booking_id: string;
  booking_reference: string;
  guest_name: string;
  email: string;
  phone_number: string;
  check_in: string;
  check_out: string;
  unit_requests: Array<{
    guests_per_unit: number;
  }>;
  special_requests?: string;
  total_amount: number;
  downpayment_amount: number;
  discount_applied?: {
    percent: number;
    amount: number;
    rule_name: string;
  };
  pricing_breakdown: {
    base_total: number;
    weekend_surcharge: number;
    extra_person_fees: number;
    subtotal: number;
    discount_amount: number;
    total: number;
    nights: number;
  };
  payment_proof_url?: string | null;
  status: string;
  created_at: string;
}

/**
 * API response wrapper
 */
interface BookingConfirmationResponse {
  success: boolean;
  booking: BookingConfirmationData;
}

/**
 * File-based route for booking confirmation page
 * Route path: /booking/confirmation/$bookingReference
 */
export const Route = createFileRoute("/booking/confirmation/$bookingReference")({
  /**
   * Loader function to fetch booking confirmation data
   * This runs before the component renders, providing type-safe data
   */
  loader: async ({ params }) => {
    const { bookingReference } = params;

    try {
      const response = await fetch(`/api/guest-booking/${bookingReference}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Booking not found");
        }
        throw new Error(`Failed to fetch booking: ${response.statusText}`);
      }

      const data: BookingConfirmationResponse = await response.json();

      if (!data.success || !data.booking) {
        throw new Error("Invalid booking data received");
      }

      return {
        booking: data.booking,
      };
    } catch (error) {
      console.error("[Booking Confirmation] Failed to fetch booking:", error);
      throw error;
    }
  },

  /**
   * Loading component shown while data is being fetched
   */
  pendingComponent: () => (
    <div className="container mx-auto flex min-h-screen items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
        <p className="text-muted-foreground text-sm">Loading your booking confirmation...</p>
      </div>
    </div>
  ),

  /**
   * Error component shown when booking cannot be loaded
   */
  errorComponent: ({ error }) => (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-foreground mb-4 text-2xl font-bold">Booking Not Found</h1>
        <p className="text-muted-foreground mb-6">
          {error instanceof Error && error.message === "Booking not found"
            ? "We couldn't find a booking with this reference number. Please check the reference and try again."
            : "An error occurred while loading your booking confirmation. Please try again later."}
        </p>
        <Button asChild>
          <Link to="/guest-booking">Go to Booking Page</Link>
        </Button>
      </div>
    </div>
  ),

  /**
   * Main component that renders the booking confirmation page
   */
  component: BookingConfirmationComponent,
});

/**
 * Booking confirmation page component
 * Displays all booking details, payment instructions, and status timeline
 */
function BookingConfirmationComponent() {
  const { booking } = Route.useLoaderData();
  const { bookingReference } = Route.useParams();
  const { data: contactChannels = [] } = useActiveContactChannels();

  // Calculate whether payment proof has been uploaded
  const paymentProofUploaded = !!booking.payment_proof_url;

  return (
    <GuestLayout>
      <div>
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-success-foreground mb-2 text-3xl font-bold">Booking Confirmed!</h1>
          <p className="text-muted-foreground">
            Thank you for your booking. Your confirmation details are below.
          </p>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-3xl space-y-6">
          {/* Booking Reference Display - Prominent */}
          <BookingReferenceDisplay reference={bookingReference} />

          {/* Status Timeline */}
          <StatusTimeline />

          {/* Payment Instructions */}
          <PaymentInstructions
            downpaymentAmount={booking.downpayment_amount}
            bookingReference={bookingReference}
            paymentProofUploaded={paymentProofUploaded}
          />

          {/* Booking Summary */}
          <BookingSummaryCard
            checkIn={booking.check_in}
            checkOut={booking.check_out}
            unitRequests={booking.unit_requests}
            specialRequests={booking.special_requests}
            pricingBreakdown={booking.pricing_breakdown}
            discountApplied={booking.discount_applied}
          />

          {/* Print Button */}
          <div className="flex justify-center">
            <PrintButton />
          </div>

          {/* Contact channels - Not printed */}
          {contactChannels.length > 0 && (
            <Alert className="no-print">
              <AlertDescription>
                If you have any questions or need to make changes to your booking, please contact
                us.
                <ContactChannelList channels={contactChannels} className="mt-2" />
              </AlertDescription>
            </Alert>
          )}

          {/* Back to Home Link - Not printed */}
          <div className="no-print flex justify-center">
            <Button variant="outline" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}
