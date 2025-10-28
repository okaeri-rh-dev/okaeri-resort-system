import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { sanitizeBookingFormData } from "@/lib/security/sanitize";
import {
  multiUnitBookingSchema,
  STEP_FIELDS,
  type MultiUnitBookingRequest,
} from "@/lib/validation/booking-schema";

import { BookingReviewStep } from "./BookingReviewStep";
import { FormStepIndicator } from "./FormStepIndicator";
import { PaymentProofUpload } from "./PaymentProofUpload";
import { UnitRequestSelector } from "./UnitRequestSelector";

const STEPS = [
  { number: 1, label: "Dates", description: "Select your stay dates" },
  { number: 2, label: "Units", description: "Choose units and guests" },
  { number: 3, label: "Contact", description: "Your information" },
  { number: 4, label: "Payment Proof", description: "Upload payment (optional)" },
  { number: 5, label: "Review", description: "Confirm and submit" },
];

export function MultiUnitGuestBookingForm() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<MultiUnitBookingRequest>({
    resolver: zodResolver(multiUnitBookingSchema),
    defaultValues: {
      guest_name: "",
      email: "",
      phone_number: "",
      check_in: "",
      check_out: "",
      unit_requests: [{ guests_per_unit: 2 }],
      special_requests: "",
      payment_proof_url: null,
      terms_accepted: false,
      idempotency_key: idempotencyKey,
    },
    mode: "onChange",
  });

  const watchedValues = form.watch();

  const validateStep = async (step: number): Promise<boolean> => {
    const stepKey = step as keyof typeof STEP_FIELDS;
    const fields = STEP_FIELDS[stepKey];

    // Handle case where step has no validation fields
    if (!fields || fields.length === 0) {
      console.debug(`Step ${step} has no validation fields`);
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
      if (!turnstileToken) {
        setSubmitError("Please complete the security verification");
        return;
      }

      const sanitized = sanitizeBookingFormData(data);

      const payload = {
        ...sanitized,
        turnstile_token: turnstileToken,
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

      const result: any = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          throw new Error(
            `Too many requests. Please try again${retryAfter ? ` in ${retryAfter} seconds` : " later"}.`
          );
        }

        if (response.status === 409 && result.is_duplicate) {
          // Idempotent duplicate - continue with cached result
          console.log("Duplicate submission detected, using cached result");
        } else {
          throw new Error(result.error || result.message || "Booking failed");
        }
      }

      // Store booking data for confirmation page (backup in case of issues)
      sessionStorage.setItem(
        "lastBookingConfirmation",
        JSON.stringify({
          bookingReference: result.booking?.booking_reference,
          bookingData: result,
          timestamp: Date.now(),
        })
      );

      // Navigate to confirmation page using TanStack Router
      if (result.booking?.booking_reference) {
        navigate({
          to: "/booking-confirmation/$bookingReference",
          params: { bookingReference: result.booking.booking_reference },
        });
      } else {
        throw new Error("Booking reference not returned from API");
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "An unexpected error occurred");
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
                    <FormItem>
                      <FormLabel>Check-In Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          min={new Date().toISOString().slice(0, 16)}
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
                    <FormItem>
                      <FormLabel>Check-Out Date & Time</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          min={watchedValues.check_in || new Date().toISOString().slice(0, 16)}
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
                <h2 className="text-2xl font-bold">Choose Units and Guests</h2>
                <p className="text-muted-foreground">
                  Select how many units you need and guests per unit
                </p>
              </div>

              <FormField
                control={form.control}
                name="unit_requests"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Requests</FormLabel>
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
                  Upload your payment receipt (optional - you can do this later)
                </p>
              </div>

              <FormField
                control={form.control}
                name="payment_proof_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Receipt</FormLabel>
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
                onTermsChange={(checked) => form.setValue("terms_accepted", checked)}
                turnstileToken={turnstileToken}
                onTurnstileSuccess={setTurnstileToken}
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
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  !turnstileToken ||
                  !form.formState.isValid ||
                  !watchedValues.terms_accepted
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
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}
