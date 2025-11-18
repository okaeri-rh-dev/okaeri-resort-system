import { createFileRoute } from "@tanstack/react-router";

import { MultiUnitGuestBookingForm } from "@/components/guest-booking";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const Route = createFileRoute("/booking/")({
  component: GuestBookingPage,
});

function GuestBookingPage() {
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

  if (!turnstileSiteKey) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            CAPTCHA configuration is missing. Please contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="from-primary/5 to-background min-h-screen bg-gradient-to-b">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-4xl font-bold">Book Your Stay</h1>
          <p className="text-muted-foreground mt-2">
            Complete the form below to request a booking. We'll confirm unit assignment within 24
            hours.
          </p>
        </div>

        {/* Multi-Unit Booking Form */}
        <MultiUnitGuestBookingForm />
      </div>
    </div>
  );
}
