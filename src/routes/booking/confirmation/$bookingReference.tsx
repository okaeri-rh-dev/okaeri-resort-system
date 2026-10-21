import { createFileRoute, Link } from "@tanstack/react-router";

import { BookingReferenceDisplay } from "@/components/booking-confirmation/BookingReferenceDisplay";
import { BookingSummaryCard } from "@/components/booking-confirmation/BookingSummaryCard";
import { PaymentInstructions } from "@/components/booking-confirmation/PaymentInstructions";
import { PrintButton } from "@/components/booking-confirmation/PrintButton";
import { StatusTimeline } from "@/components/booking-confirmation/StatusTimeline";
import { ContactChannelList } from "@/components/contact-channels/ContactChannelList";
import { Button, Callout } from "@/components/patterns";
import { useActiveContactChannels } from "@/hooks/useContactChannels";
import { GuestLayout } from "@/layouts/GuestLayout";
import { readConfirmationSnapshot } from "@/lib/bookings/confirmation-snapshot";
import { isBookingReference } from "@/lib/bookings/reference";

/**
 * File-based route for booking confirmation page
 * Route path: /booking/confirmation/$bookingReference
 */
export const Route = createFileRoute("/booking/confirmation/$bookingReference")({
  loader: ({ params }) => ({ booking: readConfirmationSnapshot(params.bookingReference) }),
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

  if (!booking) {
    return <SavedBookingUnavailable bookingReference={bookingReference} />;
  }

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
            paymentProofUploaded={booking.payment_proof_attached}
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
            <Callout tone="info" className="print:hidden">
              If you have any questions or need to make changes to your booking, please contact us.
              <ContactChannelList channels={contactChannels} className="mt-2" />
            </Callout>
          )}

          {/* Back to Home Link - Not printed */}
          <div className="flex justify-center print:hidden">
            <Button variant="outline" asChild>
              <Link to="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}

/** Shown on a refresh after the tab closed, on another device, or from a shared link. */
function SavedBookingUnavailable({ bookingReference }: { bookingReference: string }) {
  if (!isBookingReference(bookingReference)) {
    return (
      <GuestLayout width="form" pageHeader={{ title: "Booking reference not valid" }}>
        <div className="space-y-6 text-center">
          <p className="text-muted-foreground break-words">
            &ldquo;{bookingReference}&rdquo; is not a booking reference. Check the reference and try
            again.
          </p>
          <Button size="lg" asChild>
            <Link to="/booking/check-status">Check booking status</Link>
          </Button>
        </div>
      </GuestLayout>
    );
  }

  return (
    <GuestLayout width="form">
      <div className="space-y-6">
        <BookingReferenceDisplay reference={bookingReference} />
        <Callout tone="neutral">
          The booking details show only in the browser tab where you made the booking. To see your
          booking, check its status with this reference and your email.
        </Callout>
        <div className="flex justify-center">
          <Button size="lg" asChild>
            <Link to="/booking/check-status" search={{ reference: bookingReference }}>
              Check booking status
            </Link>
          </Button>
        </div>
      </div>
    </GuestLayout>
  );
}
