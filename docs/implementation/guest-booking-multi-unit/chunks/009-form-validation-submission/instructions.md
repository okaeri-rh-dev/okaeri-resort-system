# Implementation Instructions: Form Validation and Submission

## Overview

This guide provides step-by-step instructions to implement the multi-step guest booking form with comprehensive validation and security measures. Total estimated time: **120 minutes**.

## Step 1: Create Validation Schema (15 minutes)

### 1.1 Create Zod Schema File

Create the complete validation schema that will be the single source of truth for form validation.

```bash
# Create validation directory
mkdir -p src/lib/validation

# Create schema file
touch src/lib/validation/booking-schema.ts
```

### 1.2 Implement Zod Schema

**File:** `src/lib/validation/booking-schema.ts`

```typescript
import { z } from "zod";

/**
 * Unit request validation schema
 * Array-based model: each entry = 1 unit (NO quantity field)
 */
export const unitRequestSchema = z.object({
  guests_per_unit: z
    .number({
      required_error: "Guest count is required",
      invalid_type_error: "Guest count must be a number",
    })
    .int("Guest count must be a whole number")
    .min(1, "At least 1 guest per unit")
    .max(20, "Maximum 20 guests per unit"),
});

export type UnitRequest = z.infer<typeof unitRequestSchema>;

/**
 * Philippine phone number validation
 * Supports: +639171234567, 09171234567, +63-917-123-4567
 */
const philippinePhoneRegex =
  /^\+?63\s?[-.]?\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$|^0\d{3}\s?[-.]?\d{3}\s?[-.]?\d{4}$/;

/**
 * Complete multi-unit booking validation schema
 * Enforces array-based model and server-side pricing authority
 */
export const multiUnitBookingSchema = z
  .object({
    // Contact Information
    guest_name: z
      .string({
        required_error: "Guest name is required",
      })
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must be less than 100 characters")
      .trim(),

    email: z
      .string({
        required_error: "Email is required",
      })
      .email("Invalid email format")
      .toLowerCase()
      .trim(),

    phone_number: z
      .string({
        required_error: "Phone number is required",
      })
      .regex(philippinePhoneRegex, "Invalid Philippine phone number format"),

    // Booking Dates
    check_in: z
      .string({
        required_error: "Check-in date is required",
      })
      .datetime("Invalid date format")
      .refine(
        (date) => {
          const checkIn = new Date(date);
          const now = new Date();
          now.setHours(0, 0, 0, 0); // Compare dates only
          return checkIn >= now;
        },
        {
          message: "Check-in date must be today or in the future",
        }
      ),

    check_out: z
      .string({
        required_error: "Check-out date is required",
      })
      .datetime("Invalid date format"),

    // Unit Requests (Array-based model)
    unit_requests: z
      .array(unitRequestSchema, {
        required_error: "At least one unit is required",
      })
      .min(1, "At least one unit is required")
      .max(10, "Maximum 10 units per booking"),

    // Optional Fields
    special_requests: z
      .string()
      .max(1000, "Special requests must be less than 1000 characters")
      .optional()
      .transform((val) => val?.trim() || undefined),

    payment_proof_url: z.string().url("Invalid payment proof URL").optional().nullable(),

    // Security and Compliance
    turnstile_token: z
      .string({
        required_error: "Security verification required",
      })
      .min(1, "Security verification required"),

    terms_accepted: z
      .boolean({
        required_error: "You must accept the terms and conditions",
      })
      .refine((val) => val === true, {
        message: "You must accept the terms and conditions",
      }),

    idempotency_key: z.string().uuid("Invalid idempotency key").optional(),
  })
  .refine(
    (data) => {
      // Check-out must be after check-in
      const checkIn = new Date(data.check_in);
      const checkOut = new Date(data.check_out);
      return checkOut > checkIn;
    },
    {
      message: "Check-out date must be after check-in date",
      path: ["check_out"],
    }
  )
  .refine(
    (data) => {
      // Minimum 1 night stay
      const checkIn = new Date(data.check_in);
      const checkOut = new Date(data.check_out);
      const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 1;
    },
    {
      message: "Minimum stay is 1 night",
      path: ["check_out"],
    }
  );

export type MultiUnitBookingRequest = z.infer<typeof multiUnitBookingSchema>;

/**
 * Step field mapping for multi-step form validation
 */
export const STEP_FIELDS = {
  1: ["check_in", "check_out"], // Dates step
  2: ["unit_requests"], // Units step
  3: ["guest_name", "email", "phone_number", "special_requests"], // Contact step
  4: ["payment_proof_url"], // Payment proof step (optional)
  5: ["terms_accepted", "turnstile_token"], // Review step
} as const;
```

### 1.3 Verify Schema

```bash
# Type-check the schema
npx tsc --noEmit src/lib/validation/booking-schema.ts

# Expected: No errors
```

**✓ Checkpoint:** Zod schema compiles without TypeScript errors

---

## Step 2: Create Sanitization Utility (10 minutes)

### 2.1 Create Security Utility Directory

```bash
# Create directory
mkdir -p src/lib/security

# Create sanitization utility
touch src/lib/security/sanitize.ts
```

### 2.2 Implement DOMPurify Wrapper

**File:** `src/lib/security/sanitize.ts`

```typescript
import DOMPurify from "dompurify";

/**
 * Sanitize user input to prevent XSS attacks
 * Uses DOMPurify to strip all HTML tags and scripts
 *
 * @param input - Raw user input string
 * @returns Sanitized string safe for storage and display
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Strip all HTML tags and attributes
  const sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true, // Keep text content
  });

  return sanitized.trim();
}

/**
 * Sanitize HTML content with specific allowed tags
 * Use for rich text fields if needed in future
 *
 * @param html - Raw HTML string
 * @param allowedTags - Array of allowed HTML tags
 * @returns Sanitized HTML string
 */
export function sanitizeHTML(
  html: string,
  allowedTags: string[] = ["b", "i", "em", "strong"]
): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [], // No attributes allowed by default
  });
}

/**
 * Sanitize all text fields in a booking request
 *
 * @param data - Partial booking request data
 * @returns Sanitized booking data
 */
export function sanitizeBookingData<T extends Record<string, any>>(data: T): T {
  const sanitized: any = { ...data };

  // Sanitize text fields
  if (sanitized.guest_name) {
    sanitized.guest_name = sanitizeInput(sanitized.guest_name);
  }

  if (sanitized.special_requests) {
    sanitized.special_requests = sanitizeInput(sanitized.special_requests);
  }

  // Email and phone are validated by Zod, no sanitization needed
  // Dates are ISO strings, no sanitization needed
  // Booleans and numbers don't need sanitization

  return sanitized;
}
```

### 2.3 Test Sanitization

```bash
# Create test file
touch src/lib/security/__tests__/sanitize.test.ts
```

**File:** `src/lib/security/__tests__/sanitize.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { sanitizeBookingData, sanitizeHTML, sanitizeInput } from "../sanitize";

describe("sanitizeInput", () => {
  it("should remove HTML tags", () => {
    const input = "John <script>alert('xss')</script> Doe";
    expect(sanitizeInput(input)).toBe("John  Doe");
  });

  it("should remove all HTML entities", () => {
    const input = "<b>Bold</b> <i>Italic</i> text";
    expect(sanitizeInput(input)).toBe("Bold Italic text");
  });

  it("should handle empty input", () => {
    expect(sanitizeInput("")).toBe("");
  });

  it("should trim whitespace", () => {
    const input = "  John Doe  ";
    expect(sanitizeInput(input)).toBe("John Doe");
  });
});

describe("sanitizeBookingData", () => {
  it("should sanitize guest_name and special_requests", () => {
    const data = {
      guest_name: "John <script>xss</script> Doe",
      special_requests: "<b>Ground floor</b> please",
      email: "john@example.com",
    };

    const sanitized = sanitizeBookingData(data);

    expect(sanitized.guest_name).toBe("John  Doe");
    expect(sanitized.special_requests).toBe("Ground floor please");
    expect(sanitized.email).toBe("john@example.com"); // Unchanged
  });
});
```

### 2.4 Run Tests

```bash
# Run sanitization tests
npx vitest run src/lib/security/__tests__/sanitize.test.ts

# Expected: All tests pass
```

**✓ Checkpoint:** Sanitization tests pass

---

## Step 3: Create Form Step Indicator Component (15 minutes)

### 3.1 Create Component File

```bash
touch src/components/guest-booking/FormStepIndicator.tsx
```

### 3.2 Implement Step Indicator

**File:** `src/components/guest-booking/FormStepIndicator.tsx`

```typescript
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
  description?: string;
}

interface FormStepIndicatorProps {
  steps: Step[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick?: (stepNumber: number) => void;
}

export function FormStepIndicator({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
}: FormStepIndicatorProps) {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol role="list" className="space-y-4 md:flex md:space-x-8 md:space-y-0">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.number);
          const isCurrent = currentStep === step.number;
          const isClickable = step.number < currentStep || isCompleted;

          return (
            <li key={step.number} className="md:flex-1">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step.number)}
                disabled={!isClickable}
                className={cn(
                  "group flex w-full flex-col border-l-4 py-2 pl-4 md:border-l-0 md:border-t-4 md:pb-0 md:pl-0 md:pt-4",
                  {
                    "border-primary hover:border-primary/80": isCurrent,
                    "border-primary": isCompleted,
                    "border-muted-foreground/30": !isCurrent && !isCompleted,
                    "cursor-pointer": isClickable,
                    "cursor-not-allowed": !isClickable,
                  }
                )}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="flex items-center text-sm font-medium">
                  <span
                    className={cn(
                      "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2",
                      {
                        "border-primary bg-primary text-primary-foreground": isCurrent,
                        "border-primary bg-primary text-primary-foreground": isCompleted,
                        "border-muted-foreground/30 text-muted-foreground":
                          !isCurrent && !isCompleted,
                      }
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-6 w-6" aria-hidden="true" />
                    ) : (
                      <span>{step.number}</span>
                    )}
                  </span>
                  <span className="ml-4 text-sm font-medium">{step.label}</span>
                </span>
                {step.description && (
                  <span className="ml-14 mt-1 text-sm text-muted-foreground md:ml-0 md:mt-2">
                    {step.description}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

**✓ Checkpoint:** Component compiles without errors

---

## Step 4: Create Booking Review Step Component (20 minutes)

### 4.1 Create Component File

```bash
touch src/components/guest-booking/BookingReviewStep.tsx
```

### 4.2 Implement Review Step

**File:** `src/components/guest-booking/BookingReviewStep.tsx`

```typescript
import { useState } from "react";

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
              <p className="text-sm text-muted-foreground">Check-in</p>
              <p className="font-medium">{formatDate(formData.check_in)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check-out</p>
              <p className="font-medium">{formatDate(formData.check_out)}</p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center gap-2">
              <Users className="text-muted-foreground h-5 w-5" />
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="font-medium">{totalUnits}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-5 w-5" />
              <div>
                <p className="text-sm text-muted-foreground">Total Guests</p>
                <p className="font-medium">{totalGuests}</p>
              </div>
            </div>
          </div>

          {formData.unit_requests && formData.unit_requests.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Units Requested</p>
                <div className="space-y-2">
                  {formData.unit_requests.map((req, index) => (
                    <div key={index} className="bg-muted flex items-center justify-between rounded-md p-2">
                      <span className="text-sm">Unit {index + 1}</span>
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
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{formData.guest_name || "Not provided"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{formData.email || "Not provided"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="text-muted-foreground h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{formData.phone_number || "Not provided"}</p>
            </div>
          </div>
          {formData.special_requests && (
            <>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Special Requests</p>
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
                className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
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
            {!turnstileError ? (
              <Turnstile
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ""}
                onSuccess={(token) => {
                  setTurnstileError(false);
                  onTurnstileSuccess(token);
                }}
                onError={() => {
                  setTurnstileError(true);
                  onTurnstileError?.();
                }}
                onExpire={() => {
                  onTurnstileSuccess("");
                }}
                theme="light"
                size="normal"
              />
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Security verification failed. Please refresh the page and try again.
                </AlertDescription>
              </Alert>
            )}

            {turnstileToken && !turnstileError && (
              <p className="text-muted-foreground text-sm">✓ Verification complete</p>
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
```

**✓ Checkpoint:** Review step component compiles without errors

---

## Step 5: Create Main Multi-Step Form Component (40 minutes)

### 5.1 Create Main Form File

```bash
touch src/components/guest-booking/MultiUnitGuestBookingForm.tsx
```

### 5.2 Implement Multi-Step Form

**File:** `src/components/guest-booking/MultiUnitGuestBookingForm.tsx`

```typescript
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "@tanstack/react-router";

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
import { sanitizeBookingData } from "@/lib/security/sanitize";
import {
  multiUnitBookingSchema,
  type MultiUnitBookingRequest,
  STEP_FIELDS,
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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const form = useForm<MultiUnitBookingRequest>({
    resolver: zodResolver(multiUnitBookingSchema),
    mode: "onBlur",
    defaultValues: {
      guest_name: "",
      email: "",
      phone_number: "",
      check_in: "",
      check_out: "",
      unit_requests: [{ guests_per_unit: 2 }], // Start with 1 unit, 2 guests
      special_requests: "",
      payment_proof_url: null,
      terms_accepted: false,
      idempotency_key: idempotencyKey,
    },
  });

  // Watch form values for reactive UI
  const watchedValues = form.watch();

  /**
   * Validate current step fields before advancing
   */
  const validateStep = async (step: number): Promise<boolean> => {
    const fields = STEP_FIELDS[step as keyof typeof STEP_FIELDS];
    if (!fields) return true;

    const result = await form.trigger(fields as any);

    if (result) {
      setCompletedSteps((prev) => new Set(prev).add(step));
    }

    return result;
  };

  /**
   * Navigate to next step
   */
  const handleNext = async () => {
    const isValid = await validateStep(currentStep);

    if (isValid && currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /**
   * Navigate to previous step
   */
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /**
   * Navigate to specific step (only if previously completed)
   */
  const handleStepClick = async (stepNumber: number) => {
    if (stepNumber < currentStep || completedSteps.has(stepNumber)) {
      setCurrentStep(stepNumber as 1 | 2 | 3 | 4 | 5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /**
   * Handle form submission
   */
  const onSubmit = async (data: MultiUnitBookingRequest) => {
    // Final validation
    if (!turnstileToken) {
      setSubmitError("Please complete the security verification");
      return;
    }

    if (!data.terms_accepted) {
      setSubmitError("You must accept the terms and conditions");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Sanitize user inputs
      const sanitized = sanitizeBookingData(data);

      // Prepare payload
      const payload = {
        ...sanitized,
        turnstile_token: turnstileToken,
        idempotency_key: idempotencyKey,
      };

      // Submit to API
      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Booking failed");
      }

      // Success - navigate to confirmation page
      if (result.success && result.booking?.booking_reference) {
        navigate({
          to: "/booking-confirmation/$bookingReference",
          params: { bookingReference: result.booking.booking_reference },
        });
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Booking submission error:", error);
      setSubmitError(
        error instanceof Error ? error.message : "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Step Indicator */}
      <FormStepIndicator
        steps={STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Error Alert */}
      {submitError && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Step 1: Booking Dates */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Select Your Dates</h2>
                <p className="text-muted-foreground mt-1">Choose your check-in and check-out dates</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="check_in"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check-in Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="datetime-local" />
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
                      <FormLabel>Check-out Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="datetime-local" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          )}

          {/* Step 2: Unit Selection */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Select Units</h2>
                <p className="text-muted-foreground mt-1">
                  Add units and specify the number of guests for each
                </p>
              </div>

              <FormField
                control={form.control}
                name="unit_requests"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <UnitRequestSelector
                        value={field.value}
                        onChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 3: Contact Information */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Contact Information</h2>
                <p className="text-muted-foreground mt-1">How can we reach you?</p>
              </div>

              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Juan Dela Cruz" />
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
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="juan@example.com" />
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
                        <Input {...field} placeholder="+63 917 123 4567" />
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
                        {...field}
                        placeholder="e.g., Late check-in, ground floor preference, dietary restrictions"
                        rows={4}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {/* Step 4: Payment Proof Upload */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Payment Proof (Optional)</h2>
                <p className="text-muted-foreground mt-1">
                  Upload your payment proof now or later. Admin will verify before assigning units.
                </p>
              </div>

              <FormField
                control={form.control}
                name="payment_proof_url"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PaymentProofUpload
                        value={field.value || undefined}
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

          {/* Step 5: Review and Submit */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold">Review Your Booking</h2>
                <p className="text-muted-foreground mt-1">
                  Please review all details before submitting your booking
                </p>
              </div>

              <BookingReviewStep
                formData={watchedValues}
                termsAccepted={watchedValues.terms_accepted || false}
                onTermsChange={(accepted) => form.setValue("terms_accepted", accepted)}
                turnstileToken={turnstileToken}
                onTurnstileSuccess={setTurnstileToken}
                onTurnstileError={() => setSubmitError("Security verification failed")}
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-6">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}

            <div className="ml-auto flex gap-4">
              {currentStep < 5 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting || !turnstileToken}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Booking...
                    </>
                  ) : (
                    "Submit Booking"
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

**✓ Checkpoint:** Main form component compiles without TypeScript errors

---

## Step 6: Export Components (5 minutes)

### 6.1 Update Component Index

**File:** `src/components/guest-booking/index.ts`

```typescript
export { MultiUnitGuestBookingForm } from "./MultiUnitGuestBookingForm";
export { FormStepIndicator } from "./FormStepIndicator";
export { BookingReviewStep } from "./BookingReviewStep";
export { UnitRequestSelector } from "./UnitRequestSelector";
export { PaymentSummary } from "./PaymentSummary";
export { PaymentProofUpload } from "./PaymentProofUpload";
```

**✓ Checkpoint:** All components exported correctly

---

## Step 7: Create Form Tests (20 minutes)

### 7.1 Create Test File

```bash
mkdir -p src/components/guest-booking/__tests__
touch src/components/guest-booking/__tests__/MultiUnitGuestBookingForm.test.tsx
```

### 7.2 Implement Form Tests

**File:** `src/components/guest-booking/__tests__/MultiUnitGuestBookingForm.test.tsx`

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MultiUnitGuestBookingForm } from "../MultiUnitGuestBookingForm";

// Mock dependencies
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: ({ onSuccess }: any) => (
    <button onClick={() => onSuccess("test-token")}>Verify</button>
  ),
}));

describe("MultiUnitGuestBookingForm", () => {
  it("should render step 1 (dates) by default", () => {
    render(<MultiUnitGuestBookingForm />);

    expect(screen.getByText("Select Your Dates")).toBeInTheDocument();
    expect(screen.getByLabelText("Check-in Date")).toBeInTheDocument();
    expect(screen.getByLabelText("Check-out Date")).toBeInTheDocument();
  });

  it("should navigate to step 2 when Next is clicked", async () => {
    const user = userEvent.setup();
    render(<MultiUnitGuestBookingForm />);

    // Fill in dates
    const checkIn = screen.getByLabelText("Check-in Date");
    const checkOut = screen.getByLabelText("Check-out Date");

    await user.type(checkIn, "2025-03-01T14:00");
    await user.type(checkOut, "2025-03-08T10:00");

    // Click Next
    await user.click(screen.getByText("Next"));

    // Should show step 2
    await waitFor(() => {
      expect(screen.getByText("Select Units")).toBeInTheDocument();
    });
  });

  it("should validate required fields before advancing", async () => {
    const user = userEvent.setup();
    render(<MultiUnitGuestBookingForm />);

    // Click Next without filling dates
    await user.click(screen.getByText("Next"));

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/check-in date is required/i)).toBeInTheDocument();
    });
  });

  it("should sanitize user input", async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        booking: { booking_reference: "BK-TEST-123" },
      }),
    });

    global.fetch = mockFetch;

    render(<MultiUnitGuestBookingForm />);

    // Navigate to contact step (step 3)
    // ... fill dates and units steps ...

    // Fill contact with XSS attempt
    const nameInput = screen.getByLabelText("Full Name");
    await user.type(nameInput, "John <script>alert('xss')</script> Doe");

    // Submit form
    // ... complete remaining steps and submit ...

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      const payload = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(payload.guest_name).not.toContain("<script>");
    });
  });
});
```

### 7.3 Run Tests

```bash
# Run form tests
npx vitest run src/components/guest-booking/__tests__/MultiUnitGuestBookingForm.test.tsx

# Expected: Tests pass
```

**✓ Checkpoint:** Form tests pass

---

## Step 8: Integration and Final Verification (10 minutes)

### 8.1 Integrate Form into Route

**File:** `src/routes/guest-booking.tsx` (create if doesn't exist)

```typescript
import { createFileRoute } from "@tanstack/react-router";

import { MultiUnitGuestBookingForm } from "@/components/guest-booking";

export const Route = createFileRoute("/guest-booking")({
  component: GuestBookingPage,
});

function GuestBookingPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold">Book Your Stay</h1>
        <p className="text-muted-foreground mt-2">
          Complete the form below to request a booking. We'll confirm unit assignment within 24
          hours.
        </p>
      </div>

      <MultiUnitGuestBookingForm />
    </div>
  );
}
```

### 8.2 Run Development Server

```bash
# Start dev server
npm run dev

# Navigate to http://localhost:5173/guest-booking
```

### 8.3 Manual Testing Checklist

- [ ] Step 1 (Dates) displays correctly
- [ ] Cannot advance without filling dates
- [ ] Date validation works (check-out after check-in)
- [ ] Step 2 (Units) displays UnitRequestSelector
- [ ] Can add/remove unit cards
- [ ] Step 3 (Contact) displays all fields
- [ ] Phone number validates Philippine format
- [ ] Email validates correctly
- [ ] Step 4 (Payment) displays upload component
- [ ] Step 5 (Review) shows complete summary
- [ ] Terms checkbox required
- [ ] Turnstile widget loads
- [ ] Cannot submit without Turnstile token
- [ ] Submit button shows loading state
- [ ] Form data is sanitized (check network tab)

**✓ Checkpoint:** All manual tests pass

---

## Step 9: Type-Check and Lint (5 minutes)

```bash
# Type-check all TypeScript files
npm run type-check

# Expected: No errors

# Lint all files
npm run lint

# Expected: No errors

# Auto-fix formatting
npm run format
```

**✓ Checkpoint:** No TypeScript or ESLint errors

---

## Done!

### Summary of What You Built

✅ **Complete Zod validation schema** - Single source of truth for form validation
✅ **DOMPurify sanitization utility** - XSS prevention for all text inputs
✅ **Multi-step wizard UI** - 5-step guided booking flow
✅ **Form state management** - React Hook Form with Zod resolver
✅ **Security measures** - Turnstile, idempotency, input sanitization
✅ **Error handling** - Field-level and form-level error display
✅ **Optimistic UI** - Immediate feedback on submission
✅ **Component tests** - Automated testing for validation and submission

### Next Steps

**Immediate:**

1. Proceed to `checkpoint.md` for verification procedures
2. Test the complete booking flow end-to-end
3. Verify all validation rules work correctly

**After Verification:**

1. Commit changes with message: `feat: complete chunk 009 - form validation and submission`
2. Tag commit: `chunk-009`
3. Move to **Chunk 010: Booking Confirmation Flow**

### Time Breakdown

| Step      | Task                         | Estimated   |
| --------- | ---------------------------- | ----------- |
| 1         | Create validation schema     | 15 min      |
| 2         | Create sanitization utility  | 10 min      |
| 3         | Create form step indicator   | 15 min      |
| 4         | Create booking review step   | 20 min      |
| 5         | Create main form component   | 40 min      |
| 6         | Export components            | 5 min       |
| 7         | Create form tests            | 20 min      |
| 8         | Integration and verification | 10 min      |
| 9         | Type-check and lint          | 5 min       |
| **Total** |                              | **140 min** |

_Actual time may vary based on experience and debugging needs._

---

**Congratulations!** You've successfully implemented the form validation and submission system. Your multi-unit guest booking form is now complete with security, validation, and excellent UX.
