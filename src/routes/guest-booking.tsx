import { createFileRoute } from "@tanstack/react-router";

import { GuestBookingForm } from "@/components/guest-booking/GuestBookingForm";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// import { InfoIcon } from "lucide-react";

export const Route = createFileRoute("/guest-booking")({
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
          <h1 className="mb-2 text-3xl font-bold">Book Your Stay</h1>
          <p className="text-muted-foreground">Complete the form below to make a reservation</p>
        </div>

        {/* Info Banner */}
        {/* <Card className="max-w-2xl mx-auto mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <InfoIcon className="h-5 w-5" />
              Booking Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>• No account required - book as a guest</li>
              <li>• Upload your payment proof securely</li>
              <li>• Receive instant booking confirmation via email</li>
              <li>• Track your booking status with the reference number</li>
              <li>• Payment verification usually within 24 hours</li>
            </ul>
          </CardContent>
        </Card> */}

        {/* Booking Form */}
        <GuestBookingForm
          onSuccess={(bookingReference) => {
            // Optionally redirect to success page or status check
            console.log("Booking created:", bookingReference);
          }}
        />
      </div>
    </div>
  );
}
