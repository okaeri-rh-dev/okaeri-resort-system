import { createFileRoute } from "@tanstack/react-router";

import { MultiUnitGuestBookingForm } from "@/components/guest-booking";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GuestLayout } from "@/layouts/GuestLayout";

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
    <GuestLayout
      pageHeader={{
        title: "Book Your Stay",
        description:
          "Complete the form below to request a booking. We'll confirm unit assignment within 24 hours.",
      }}
    >
      <MultiUnitGuestBookingForm />
    </GuestLayout>
  );
}
