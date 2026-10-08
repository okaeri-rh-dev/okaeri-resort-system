import { useEffect, useEffectEvent, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { useNavigate } from "@tanstack/react-router";
// Removed unused imports: format, cn
import { AlertCircle, ArrowLeft, ArrowRight, CreditCard, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { PaymentMethodsDisplay } from "@/components/shared/PaymentMethodsDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ResponsiveDatePicker } from "@/components/ui/responsive-date-picker";
import { Textarea } from "@/components/ui/textarea";
import { logger } from "@/lib/logger";
import { sanitizeBookingFormData } from "@/lib/security/sanitize";
import { hasProperty, isObject } from "@/lib/type-guards";
import {
  multiUnitBookingSchema,
  STEP_FIELDS,
  type MultiUnitBookingRequest,
} from "@/lib/validation/booking-schema";

import { BookingReviewStep } from "./BookingReviewStep";
import { FormStepIndicator } from "./FormStepIndicator";
import { PaymentProofUpload } from "./PaymentProofUpload";
import { UnitRequestSelector } from "./UnitRequestSelector";

const isDevelopment = import.meta.env.DEV;

const STEPS = [
  { number: 1, label: "Dates", description: "Select your stay dates" },
  { number: 2, label: "Cabins", description: "Choose units and guests" },
  { number: 3, label: "Contact", description: "Your information" },
  {
    number: 4,
    label: "Payment Proof",
    description: isDevelopment ? "Upload payment (optional)" : "Upload payment (required)",
  },
  { number: 5, label: "Review", description: "Confirm and submit" },
];

export function MultiUnitGuestBookingForm() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(() => {
    // Initialize with dev mock token if bypass is enabled
    const isDev = import.meta.env.DEV;
    const skipTurnstile = import.meta.env.VITE_SKIP_TURNSTILE === "true";
    return isDev && skipTurnstile ? "dev-mock-token" : null;
  });
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const turnstileRef = useRef<TurnstileInstance>(null);

  const isDev = import.meta.env.DEV;
  const skipTurnstile = import.meta.env.VITE_SKIP_TURNSTILE === "true";

  const form = useForm<MultiUnitBookingRequest>({
    resolver: zodResolver(multiUnitBookingSchema),
    defaultValues: {
      guest_name: "",
      email: "",
      phone_number: "",
      check_in: new Date(),
      check_out: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      unit_requests: [{ guests_per_unit: 2 }],
      special_requests: "",
      payment_proof_url: undefined,
      terms_accepted: false,
      idempotency_key: idempotencyKey,
      turnstile_token: isDev && skipTurnstile ? "dev-mock-token" : "", // ← Added: Register token field with form
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  // Destructure formState to enable proper subscription
  const {
    isValid,
    isDirty,
    errors,
    isValidating,
    isSubmitting: _formIsSubmitting,
  } = form.formState;

  // Form initialization tracking (debug logs removed for production)
  useEffect(() => {
    // Form state initialization - debug mode disabled to prevent data leakage
  }, []);

  // Extract form.setValue into useEffectEvent to remove form from dependencies
  const adjustCheckOutDate = useEffectEvent((checkIn: Date, checkOut: Date) => {
    if (checkIn && checkOut && checkOut <= checkIn) {
      // Set check-out to the day after check-in
      const newCheckOut = new Date(checkIn);
      newCheckOut.setDate(newCheckOut.getDate() + 1);
      form.setValue("check_out", newCheckOut, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  });

  // Auto-adjust check-out date when check-in changes
  useEffect(() => {
    adjustCheckOutDate(watchedValues.check_in, watchedValues.check_out);
  }, [watchedValues.check_in, watchedValues.check_out]);

  // Zod validation utility (debug logs removed for production)
  const testZodValidation = () => {
    if (!import.meta.env.DEV) return;

    const currentValues = form.getValues();
    const result = multiUnitBookingSchema.safeParse(currentValues);

    // Debug logs removed to prevent sensitive data leakage

    return result;
  };

  // Sync turnstile token state with form field
  useEffect(() => {
    if (turnstileToken) {
      form.setValue("turnstile_token", turnstileToken, {
        shouldValidate: true, // Trigger validation
        shouldDirty: true, // Mark as changed
      });
    }
  }, [turnstileToken, form]);

  const validateStep = async (step: number): Promise<boolean> => {
    const stepKey = step as keyof typeof STEP_FIELDS;
    const fields = STEP_FIELDS[stepKey];

    // Handle case where step has no validation fields
    if (!fields || fields.length < 1) {
      logger.debug(`Step ${step} has no validation fields`);
      return true;
    }

    // Trigger validation for step fields with proper typing
    const isValid = await form.trigger(fields as unknown as (keyof MultiUnitBookingRequest)[]);
    return isValid;
  };

  const handleNext = async () => {
    const isValid = await validateStep(currentStep);
    if (!isValid) {
      return;
    }

    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStepClick = (step: number) => {
    if (completedSteps.has(step - 1) || step === 1) {
      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const onSubmit = async (data: MultiUnitBookingRequest) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // FALLBACK: Sync token from native Turnstile widget if React state is empty
      // This handles the case where token expires and user re-verifies, but
      // the @marsidev/react-turnstile callback doesn't fire reliably
      let effectiveToken = turnstileToken;
      if (!effectiveToken && typeof window !== "undefined" && window.turnstile) {
        const widgetToken = window.turnstile.getResponse();
        if (widgetToken) {
          setTurnstileToken(widgetToken);
          form.setValue("turnstile_token", widgetToken, {
            shouldValidate: true,
            shouldDirty: true,
          });
          effectiveToken = widgetToken;
        }
      }

      if (!effectiveToken) {
        setSubmitError("Please complete the security verification");
        return;
      }

      const sanitized = sanitizeBookingFormData(data);

      // Convert Date objects to ISO strings for API
      const payload = {
        ...sanitized,
        check_in: data.check_in.toISOString(),
        check_out: data.check_out.toISOString(),
        // Convert null to undefined for payment_proof_url (API expects undefined, not null)
        payment_proof_url: data.payment_proof_url || undefined,
        turnstile_token: effectiveToken,
        idempotency_key: idempotencyKey,
      };

      const response = await fetch("/api/guest-booking/multi-unit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          throw new Error(
            `Too many requests. Please try again${retryAfter ? ` in ${retryAfter} seconds` : " later"}.`
          );
        }

        if (
          response.status === 409 &&
          isObject(result) &&
          hasProperty(result, "is_duplicate") &&
          result.is_duplicate
        ) {
          // Idempotent duplicate - continue with cached result (silent)
        } else {
          let errorMsg = "Booking failed";
          if (isObject(result)) {
            if (hasProperty(result, "error")) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const errorValue = (result as any).error;
              if (isObject(errorValue) && hasProperty(errorValue, "message")) {
                errorMsg = String(errorValue.message);
              } else {
                errorMsg = String(errorValue);
              }
            } else if (hasProperty(result, "message")) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              errorMsg = String((result as any).message);
            }
          }
          throw new Error(errorMsg);
        }
      }

      // Store booking data for confirmation page (backup in case of issues)
      sessionStorage.setItem(
        "lastBookingConfirmation",
        JSON.stringify({
          bookingReference:
            isObject(result) &&
            hasProperty(result, "booking") &&
            isObject(result.booking) &&
            hasProperty(result.booking, "booking_reference")
              ? result.booking.booking_reference
              : null,
          bookingData: result,
          timestamp: Date.now(),
        })
      );

      // Navigate to confirmation page using TanStack Router
      if (
        isObject(result) &&
        hasProperty(result, "booking") &&
        isObject(result.booking) &&
        hasProperty(result.booking, "booking_reference")
      ) {
        navigate({
          to: "/booking/confirmation/$bookingReference",
          params: { bookingReference: String(result.booking.booking_reference) },
        });
      } else {
        throw new Error("Booking reference not returned from API");
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An unexpected error occurred");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <FormStepIndicator
        steps={STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Dates */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Select Your Stay Dates</h2>
                <p className="text-muted-foreground">Choose your check-in and check-out dates</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="check_in"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-In Date</FormLabel>
                      <FormControl>
                        <ResponsiveDatePicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          placeholder="Pick a date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="check_out"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Check-Out Date</FormLabel>
                      <FormControl>
                        <ResponsiveDatePicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={(date) =>
                            !watchedValues.check_in || date <= watchedValues.check_in
                          }
                          placeholder="Pick a date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* Step 2: Units */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Choose Cabins and Guests</h2>
                <p className="text-muted-foreground">
                  Select how many units you need and guests per unit
                </p>
              </div>

              <FormField
                control={form.control}
                name="unit_requests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cabin Requests</FormLabel>
                    <FormControl>
                      <UnitRequestSelector value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 3: Contact */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Your Information</h2>
                <p className="text-muted-foreground">Provide your contact details</p>
              </div>

              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Juan Dela Cruz" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="juan@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input type="tel" placeholder="+63 912 345 6789" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="special_requests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Special Requests (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any special requests or requirements?"
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 4: Payment Proof */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Upload Payment Proof</h2>
                <p className="text-muted-foreground">
                  {isDevelopment
                    ? "Upload your payment receipt (optional - you can do this later)"
                    : "Upload your payment receipt (required for booking confirmation)"}
                </p>
              </div>

              {/* Development mode indicator */}
              {isDevelopment && (
                <Alert className="border-yellow-400 bg-yellow-50">
                  <AlertDescription className="text-yellow-800">
                    🔧 Development Mode: Payment proof is optional for testing. In production, this
                    will be required.
                  </AlertDescription>
                </Alert>
              )}

              {/* Payment Instructions - Dynamic from database */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="h-5 w-5" />
                    Payment Methods
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <PaymentMethodsDisplay variant="card" />

                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Use your booking reference number as the payment description/note.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>

              <FormField
                control={form.control}
                name="payment_proof_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Payment Receipt {isDevelopment ? "(Optional)" : "(Required)"}
                    </FormLabel>
                    <FormControl>
                      <PaymentProofUpload
                        value={field.value}
                        onChange={field.onChange}
                        bookingReference={`TEMP-${idempotencyKey.slice(0, 8)}`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 5: Review */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Review Your Booking</h2>
                <p className="text-muted-foreground">
                  Please review your booking details before submitting
                </p>
              </div>

              <BookingReviewStep
                formData={watchedValues}
                termsAccepted={watchedValues.terms_accepted}
                onTermsChange={(checked) => {
                  // Ensure boolean type and trigger validation
                  const boolValue = checked === true;
                  form.setValue("terms_accepted", boolValue, {
                    shouldValidate: true,
                    shouldDirty: true,
                    shouldTouch: true,
                  });
                }}
                turnstileToken={turnstileToken}
                onTurnstileSuccess={setTurnstileToken}
                turnstileRef={turnstileRef}
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || isSubmitting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            {currentStep < STEPS.length ? (
              <Button type="button" onClick={handleNext} disabled={isSubmitting}>
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                {/* Comprehensive Debug Panel - remove after fixing */}
                {import.meta.env.DEV && (
                  <div className="mb-4 rounded bg-gray-100 p-3 text-xs text-gray-500">
                    <div className="mb-2 font-bold">🔍 Debug Panel</div>

                    {/* Environment Info */}
                    <div className="mb-2">
                      <strong>Environment:</strong>
                      <br />
                      DEV: {String(import.meta.env.DEV)}
                      <br />
                      SKIP_TURNSTILE: {String(import.meta.env.VITE_SKIP_TURNSTILE)}
                      <br />
                      skipTurnstile var: {String(skipTurnstile)}
                      <br />
                      isDev var: {String(isDev)}
                    </div>

                    {/* Form State */}
                    <div className="mb-2">
                      <strong>Form State:</strong>
                      <br />
                      isValid: {String(isValid)}
                      <br />
                      isDirty: {String(isDirty)}
                      <br />
                      isValidating: {String(isValidating)}
                    </div>

                    {/* Critical Fields */}
                    <div className="mb-2">
                      <strong>Critical Values:</strong>
                      <br />
                      turnstile_token: "{form.getValues("turnstile_token")}" (length:{" "}
                      {form.getValues("turnstile_token")?.length || 0})<br />
                      payment_proof: {JSON.stringify(form.getValues("payment_proof_url"))}
                      <br />
                      special_requests: "{form.getValues("special_requests")}" (type:{" "}
                      {typeof form.getValues("special_requests")})<br />
                      terms_accepted: {String(form.getValues("terms_accepted"))}
                      <br />
                      idempotency_key: {form.getValues("idempotency_key")?.slice(0, 8)}...
                    </div>

                    {/* All Errors */}
                    <div className="mb-2">
                      <strong>Errors:</strong>
                      <br />
                      {Object.keys(errors).length > 0
                        ? JSON.stringify(errors, null, 2)
                        : "No visible errors"}
                    </div>

                    {/* Manual Validation Buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void form.trigger();
                        }}
                        className="mt-2 rounded bg-blue-500 px-2 py-1 text-xs text-white"
                      >
                        Force Validate
                      </button>

                      <button
                        type="button"
                        onClick={testZodValidation}
                        className="mt-2 rounded bg-green-500 px-2 py-1 text-xs text-white"
                      >
                        Test Raw Zod
                      </button>
                    </div>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={
                    isSubmitting || !turnstileToken || !isValid || !watchedValues.terms_accepted
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Booking"
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
