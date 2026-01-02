import { useEffect, useState } from "react";

import { Turnstile } from "@marsidev/react-turnstile";
import { AlertCircle, Calendar, Mail, Phone, User, Users } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { MultiUnitBookingRequest } from "@/lib/validation/booking-schema";

import { PaymentSummary } from "./PaymentSummary";

interface BookingReviewStepProps {
  formData: Partial<MultiUnitBookingRequest>;
  termsAccepted: boolean;
  onTermsChange: (accepted: boolean) => void;
  turnstileToken: string | null;
  onTurnstileSuccess: (token: string) => void;
  onTurnstileError?: () => void;
}

export function BookingReviewStep({
  formData,
  termsAccepted,
  onTermsChange,
  turnstileToken,
  onTurnstileSuccess,
  onTurnstileError,
}: BookingReviewStepProps) {
  const [turnstileError, setTurnstileError] = useState(false);
  const [turnstileExpired, setTurnstileExpired] = useState(false);

  // Development mode: Skip Turnstile if VITE_SKIP_TURNSTILE is true or no site key
  const isDev = import.meta.env.DEV;
  const skipTurnstile = import.meta.env.VITE_SKIP_TURNSTILE === "true";
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const shouldSkipTurnstile = isDev && (skipTurnstile || !siteKey);

  // Auto-provide mock token in development when skipping (using useEffect to avoid render loops)
  useEffect(() => {
    if (shouldSkipTurnstile && !turnstileToken) {
      onTurnstileSuccess("dev-mock-token");
    }
  }, [shouldSkipTurnstile, turnstileToken, onTurnstileSuccess]);

  const totalUnits = formData.unit_requests?.length || 0;
  const totalGuests =
    formData.unit_requests?.reduce((sum, req) => sum + req.guests_per_unit, 0) || 0;

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-PH", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Booking Details Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Booking Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-sm">Check-in</p>
              <p className="font-medium">{formatDate(formData.check_in?.toISOString())}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Check-out</p>
              <p className="font-medium">{formatDate(formData.check_out?.toISOString())}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm">Total Cabins</p>
                <p className="font-medium">{totalUnits}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-5 w-5" />
              <div>
                <p className="text-muted-foreground text-sm">Total Guests</p>
                <p className="font-medium">{totalGuests}</p>
              </div>
            </div>
          </div>

          {formData.unit_requests && formData.unit_requests.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground mb-2 text-sm">Cabins Requested</p>
                <div className="space-y-2">
                  {formData.unit_requests.map((req, index) => (
                    <div
                      key={index}
                      className="bg-muted flex items-center justify-between rounded-md p-2"
                    >
                      <span className="text-sm">Cabin {index + 1}</span>
                      <span className="text-sm font-medium">{req.guests_per_unit} guests</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contact Information Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-sm">Name</p>
              <p className="font-medium">{formData.guest_name || "Not provided"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-sm">Email</p>
              <p className="font-medium">{formData.email || "Not provided"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-muted-foreground text-sm">Phone</p>
              <p className="font-medium">{formData.phone_number || "Not provided"}</p>
            </div>
          </div>
          {formData.special_requests && (
            <>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm">Special Requests</p>
                <p className="mt-1 text-sm">{formData.special_requests}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Summary */}
      {formData.unit_requests &&
        formData.unit_requests.length > 0 &&
        formData.check_in &&
        formData.check_out && (
          <PaymentSummary
            unitRequests={formData.unit_requests}
            checkIn={new Date(formData.check_in)}
            checkOut={new Date(formData.check_out)}
          />
        )}

      {/* Terms and Conditions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={onTermsChange}
              aria-describedby="terms-description"
            />
            <div className="space-y-1 leading-none">
              <Label
                htmlFor="terms"
                className="cursor-pointer text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I accept the terms and conditions
              </Label>
              <p id="terms-description" className="text-muted-foreground text-sm">
                By checking this box, you agree to our{" "}
                <a href="/terms" className="text-primary underline hover:no-underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="text-primary underline hover:no-underline">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Verification */}
      <Card>
        <CardHeader>
          <CardTitle>Security Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center space-y-4">
            {shouldSkipTurnstile ? (
              // Development mode - Turnstile disabled
              <Alert className="border-amber-500/50 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Development Mode:</strong> Security verification is disabled.
                  {skipTurnstile
                    ? " (VITE_SKIP_TURNSTILE=true)"
                    : " (VITE_TURNSTILE_SITE_KEY not set)"}
                  <br />
                  <span className="text-xs">
                    This would normally require CAPTCHA verification in production.
                  </span>
                </AlertDescription>
              </Alert>
            ) : !turnstileError ? (
              <Turnstile
                siteKey={siteKey || ""}
                onSuccess={(token) => {
                  setTurnstileError(false);
                  setTurnstileExpired(false);
                  onTurnstileSuccess(token);
                }}
                onError={() => {
                  setTurnstileError(true);
                  setTurnstileExpired(false);
                  onTurnstileError?.();
                }}
                onExpire={() => {
                  setTurnstileExpired(true);
                  setTurnstileError(false);
                  onTurnstileSuccess("");
                }}
              />
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Security verification failed. Please refresh the page and try again.
                </AlertDescription>
              </Alert>
            )}

            {turnstileToken && !turnstileError && !turnstileExpired && !shouldSkipTurnstile && (
              <p className="text-muted-foreground text-sm">✓ Verification complete</p>
            )}

            {turnstileExpired && !turnstileError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Security verification has expired. Please complete the CAPTCHA again to continue.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Final Warning */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Please review all information carefully before submitting. You will receive a booking
          reference number after submission.
        </AlertDescription>
      </Alert>
    </div>
  );
}
