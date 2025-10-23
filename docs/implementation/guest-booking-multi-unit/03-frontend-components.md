# Frontend Components for Multi-Unit Guest Booking

## Overview

React components for multi-unit guest booking with array-based model, server-side pricing, and proper validation.

**Key Principles:**

- Array-based: Each card = 1 unit (NO quantity field)
- Server-side pricing ONLY (all calculations via PostgreSQL function)
- Static rate display (no client-side pricing calculations)
- NO unit types exposed to guests
- React Hook Form + Zod validation
- shadcn/ui components

## Prerequisites

- API endpoints deployed
- TypeScript types available
- shadcn/ui installed
- React Hook Form + Zod configured

**Important Note on Pricing:**
The `PaymentSummary` component displays **server-computed** pricing from the `/api/guest-booking/preview-pricing` endpoint. Frontend shows real-time pricing calculated by the PostgreSQL function:

- Base rates
- Weekend surcharges
- Extra person fees
- Applied discounts (if any)
- Total and required downpayment (configurable, default 50%)

The frontend makes API calls to get pricing previews but performs **zero calculations locally**. All pricing logic resides in the PostgreSQL `calculate_booking_pricing()` function.

## Component Architecture

```
MultiUnitGuestBookingForm (main form)
├── UnitRequestSelector (container)
│   └── UnitRequestCard[] (one per unit, NO quantity)
├── StaticRateDisplay (shows base rates fetched from API)
└── PaymentProofUpload (file upload)
```

## Core Components

### UnitRequestCard (Single Unit)

**File:** `src/components/guest-booking/UnitRequestCard.tsx`

```tsx
import { Home, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UnitRequestCardProps {
  index: number;
  guestsPerUnit: number;
  onGuestsChange: (guests: number) => void;
  onRemove: () => void;
  disabled?: boolean;
  maxCapacityPerUnit: number;
  baseOccupancy: number;
  extraPersonRate: number;
  canRemove: boolean;
}

export function UnitRequestCard({
  index,
  guestsPerUnit,
  onGuestsChange,
  onRemove,
  disabled,
  maxCapacityPerUnit,
  baseOccupancy,
  extraPersonRate,
  canRemove,
}: UnitRequestCardProps) {
  const handleGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;
    if (value >= 1 && value <= maxCapacityPerUnit) {
      onGuestsChange(value);
    }
  };

  const extraPersons = Math.max(0, guestsPerUnit - baseOccupancy);

  return (
    <Card className="relative">
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Unit #{index + 1}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`guests-${index}`}>Guests per unit</Label>
          <Input
            id={`guests-${index}`}
            type="number"
            min="1"
            max={maxCapacityPerUnit}
            value={guestsPerUnit}
            onChange={handleGuestsChange}
            disabled={disabled}
          />
          <p className="text-muted-foreground text-xs">
            Maximum {maxCapacityPerUnit} guests per unit
            {extraPersons > 0 && (
              <span className="mt-1 block text-yellow-600">
                Extra person fee: ₱{extraPersonRate}/person/night ({extraPersons} extra person
                {extraPersons > 1 ? "s" : ""})
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
```

### File Upload Security (Payment Proofs)

**Purpose**: Validate payment proof files before upload to prevent malicious files and ensure compatibility.

#### Upload Workflow

**Timing**: Payment proof uploaded **during booking submission** as part of the form flow.

**Complete Flow:**

```
1. Guest fills booking form (dates, units, contact info)
2. Guest selects payment proof file
3. File validated (type, size, magic number)
4. File compressed if needed (images to ~2MB)
5. File uploaded to signed URL
6. Booking submitted with payment_proof_url
```

#### Phase 1 Validation & Compression

**Two-Tier File Upload Strategy:**

- Client Optimization: Frontend compresses images to ~2MB for faster uploads (Canvas API)
- Server Security Boundary: 5MB hard maximum enforced by server (files exceeding are REJECTED)
- Allowed Formats: JPEG, PNG, PDF only
- Validation: Magic number verification (file header validation)

**Implementation Example:**

```typescript
const MAGIC_NUMBERS = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
} as const;

async function validateFileContent(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const magic = MAGIC_NUMBERS[file.type as keyof typeof MAGIC_NUMBERS];

  if (!magic) return false;

  return magic.every((byte, i) => bytes[i] === byte);
}

async function compressImage(file: File): Promise<File> {
  // Only compress images (not PDFs)
  if (file.type === 'application/pdf') return file;

  const targetSize = 2 * 1024 * 1024; // 2MB target
  if (file.size <= targetSize) return file; // Already small enough

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    if (!ctx) throw new Error('Canvas not supported');

    return await new Promise<File>((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        // Progressive quality reduction
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob(
            (blob) => {
              if (blob && (blob.size <= targetSize || quality <= 0.5)) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              } else {
                quality -= 0.1;
                tryCompress();
              }
            },
            'image/jpeg',
            quality
          );
        };
        tryCompress();
      };

      img.onerror = () => reject(new Error('Image load failed'));
      img.src = URL.createObjectURL(file);
    });
  } catch (error) {
    // Fallback: Upload uncompressed if under 5MB
    if (file.size <= 5 * 1024 * 1024) {
      console.warn('Compression failed, uploading uncompressed file');
      return file;
    }
    throw new Error('File too large and compression failed');
  }
}

// Usage in file input handler with comprehensive error handling
const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  // Clear previous errors
  setError(null);
  setIsValidating(true);

  try {
    // 1. Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError({
        type: 'FILE_TYPE_INVALID',
        message: 'Only JPEG, PNG, and PDF files are allowed',
        severity: 'error'
      });
      toast.error('Invalid file type. Please upload JPEG, PNG, or PDF only.');
      return;
    }

    // 2. Check file size (5MB server limit)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      setError({
        type: 'FILE_SIZE_EXCEEDED',
        message: `File size (${sizeMB}MB) exceeds 5MB limit`,
        severity: 'error'
      });
      toast.error(`File too large (${sizeMB}MB). Maximum size is 5MB.`);
      return;
    }

    // 3. Validate magic numbers
    const isValid = await validateFileContent(file);
    if (!isValid) {
      setError({
        type: 'FILE_CONTENT_INVALID',
        message: 'File appears corrupted or tampered with',
        severity: 'error'
      });
      toast.error('Invalid or corrupted file. Please try another file.');
      return;
    }

    // 4. Compress image if needed
    const compressedFile = await compressImage(file);
    const compressionRatio = ((1 - compressedFile.size / file.size) * 100).toFixed(0);

    if (compressedFile.size < file.size) {
      toast.info(`Image compressed by ${compressionRatio}% for faster upload.`);
    }

    // Success - file is valid and compressed
    setError(null);
    onFileSelect(compressedFile);
    toast.success('File validated and ready for upload.');

  } catch (error) {
    console.error('[FILE_UPLOAD] Validation error:', error);
    setError({
      type: 'VALIDATION_FAILED',
      message: 'Failed to validate file. Please try again.',
      severity: 'error'
    });
    toast.error('File validation failed. Please try again or contact support.');
  } finally {
    setIsValidating(false);
  }
};

// Error state type definition
interface FileValidationError {
  type: 'FILE_TYPE_INVALID' | 'FILE_SIZE_EXCEEDED' | 'FILE_CONTENT_INVALID' | 'VALIDATION_FAILED';
  message: string;
  severity: 'error' | 'warning' | 'info';
}

// Component state
const [error, setError] = useState<FileValidationError | null>(null);
const [isValidating, setIsValidating] = useState(false);

// UI error display
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Upload Error</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
  </Alert>
)}

// Validation loading state
{isValidating && (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" />
    <span>Validating file...</span>
  </div>
)}
```

#### Security Measures

**Phase 1 (Current):**

- File type validation (JPEG, PNG, PDF)
- Magic number verification (header check)
- Client-side compression (images to <2MB)
- Server size limit (5MB hard maximum)
- Admin manual review (primary security layer)

**Phase 2 Enhancements (Future):**

- Cloudflare Images integration for image uploads
- Third-party PDF scanning (VirusTotal API free tier)
- EXIF data stripping for privacy
- Automated malware scanning

**Why Manual Review for Phase 1:**

- Admin verifies payment anyway
- Avoids complex scanning infrastructure
- Free tier friendly
- Sufficient for small resort volume

**Client-Side Image Compression (Optional):**

```typescript
import imageCompression from "browser-image-compression";

const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 2,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  return await imageCompression(file, options);
};
```

### UnitRequestSelector (Container)

**File:** `src/components/guest-booking/UnitRequestSelector.tsx`

```tsx
import { useEffect, useState } from "react";

import { Info, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { StandardUnitRates, UnitRequest } from "@/types/guest-booking-multi-unit";

import { UnitRequestCard } from "./UnitRequestCard";

interface UnitRequestSelectorProps {
  value: UnitRequest[];
  onChange: (requests: UnitRequest[]) => void;
  disabled?: boolean;
  maxTotalUnits?: number;
}

export function UnitRequestSelector({
  value,
  onChange,
  disabled,
  maxTotalUnits = 10,
}: UnitRequestSelectorProps) {
  const [unitRates, setUnitRates] = useState<StandardUnitRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRates() {
      try {
        const response = await fetch("/api/guest-booking/rates");
        const data = await response.json();

        if (data.success) {
          setUnitRates(data.rates);
        } else {
          setError("Failed to load pricing information");
        }
      } catch (err) {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchRates();
  }, []);

  const totalUnits = value.length; // Array length = total units

  const handleAddRequest = () => {
    if (totalUnits < maxTotalUnits) {
      onChange([...value, { guests_per_unit: unitRates?.base_occupancy || 2 }]);
    }
  };

  const handleUpdateRequest = (index: number, guests: number) => {
    const newRequests = [...value];
    newRequests[index] = { guests_per_unit: guests };
    onChange(newRequests);
  };

  const handleRemoveRequest = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !unitRates) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || "Unable to load pricing"}</AlertDescription>
      </Alert>
    );
  }

  const totalGuests = value.reduce((sum, r) => sum + r.guests_per_unit, 0);

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Add units and specify guests for each. Admin assigns specific units after confirmation.
          {totalUnits > 0 && (
            <span className="mt-2 block font-medium">
              Total: {totalUnits} unit{totalUnits !== 1 ? "s" : ""}, {totalGuests} guest
              {totalGuests !== 1 ? "s" : ""}
            </span>
          )}
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Base Rate:</span>
              <span className="ml-2 font-medium">₱{unitRates.base_rate}/night</span>
            </div>
            <div>
              <span className="text-muted-foreground">Weekend Rate:</span>
              <span className="ml-2 font-medium">₱{unitRates.weekend_rate}/night</span>
            </div>
            <div>
              <span className="text-muted-foreground">Base Occupancy:</span>
              <span className="ml-2 font-medium">{unitRates.base_occupancy} guests</span>
            </div>
            <div>
              <span className="text-muted-foreground">Extra Person:</span>
              <span className="ml-2 font-medium">₱{unitRates.extra_person_rate}/night</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {value.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed py-12 text-center">
          <p className="text-muted-foreground mb-4">No units selected</p>
          <Button onClick={handleAddRequest} disabled={disabled}>
            <Plus className="mr-2 h-4 w-4" />
            Add Unit Request
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {value.map((request, index) => (
            <UnitRequestCard
              key={index}
              index={index}
              guestsPerUnit={request.guests_per_unit}
              onGuestsChange={(guests) => handleUpdateRequest(index, guests)}
              onRemove={() => handleRemoveRequest(index)}
              disabled={disabled}
              maxCapacityPerUnit={unitRates.max_capacity_per_unit}
              baseOccupancy={unitRates.base_occupancy}
              extraPersonRate={unitRates.extra_person_rate}
              canRemove={value.length > 1}
            />
          ))}
        </div>
      )}

      {value.length > 0 && totalUnits < maxTotalUnits && (
        <Button onClick={handleAddRequest} disabled={disabled} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Another Unit
        </Button>
      )}

      {totalUnits >= maxTotalUnits && (
        <Alert variant="warning">
          <AlertDescription>Maximum of {maxTotalUnits} units per booking reached</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

### PaymentSummary (Server-Side Pricing Preview)

**File:** `src/components/guest-booking/PaymentSummary.tsx`

**Important**: This component fetches pricing previews from `/api/guest-booking/preview-pricing`, which calls the PostgreSQL `calculate_booking_pricing()` function server-side. It is NOT a client-side pricing calculator.

```tsx
import { useEffect, useState } from "react";

import { AlertTriangle, Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UnitRequest } from "@/types/guest-booking-multi-unit";

interface PaymentSummaryProps {
  unitRequests: UnitRequest[];
  checkIn: Date;
  checkOut: Date;
}

interface PricingPreview {
  nights: number;
  total_units: number;
  total_guests: number;
  base_total: number;
  weekend_surcharge: number;
  extra_person_fees: number;
  subtotal: number;
  discount?: {
    percent: number;
    amount: number;
    rule_name: string;
  };
  total: number;
  downpayment_required: number;
  downpayment_percent: number;
}

export function PaymentSummary({ unitRequests, checkIn, checkOut }: PaymentSummaryProps) {
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unitRequests.length === 0 || !checkIn || !checkOut) {
      setPricing(null);
      return;
    }

    async function fetchPricing() {
      setLoading(true);
      try {
        // SERVER-SIDE PREVIEW: Endpoint calls PostgreSQL calculate_booking_pricing() function
        // This is NOT a client-side calculation - it's a server-side wrapper for UX
        const response = await fetch("/api/guest-booking/preview-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unit_requests: unitRequests,
            check_in: checkIn.toISOString(),
            check_out: checkOut.toISOString(),
          }),
        });

        const data = await response.json();
        if (data.success) {
          setPricing(data.pricing);
        }
      } catch (error) {
        console.error("Pricing preview error:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPricing();
  }, [unitRequests, checkIn, checkOut]);

  if (unitRequests.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Add units to see pricing</AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calculating...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="bg-muted h-4 animate-pulse rounded" />
            <div className="bg-muted h-4 animate-pulse rounded" />
            <div className="bg-muted h-4 animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pricing) return null;

  return (
    <div className="space-y-4">
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Preview Only</strong> - Final pricing calculated by server
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Units:</span>
              <span>{pricing.total_units}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guests:</span>
              <span>{pricing.total_guests}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nights:</span>
              <span>{pricing.nights}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Base Total:</span>
              <span>₱{pricing.base_total.toLocaleString()}</span>
            </div>
            {pricing.weekend_surcharge > 0 && (
              <div className="flex justify-between">
                <span>Weekend Surcharge:</span>
                <span>₱{pricing.weekend_surcharge.toLocaleString()}</span>
              </div>
            )}
            {pricing.extra_person_fees > 0 && (
              <div className="flex justify-between">
                <span>Extra Person Fees:</span>
                <span>₱{pricing.extra_person_fees.toLocaleString()}</span>
              </div>
            )}
          </div>

          <Separator />

          <div className="flex justify-between font-medium">
            <span>Subtotal:</span>
            <span>₱{pricing.subtotal.toLocaleString()}</span>
          </div>

          {pricing.discount && (
            <>
              <div className="flex justify-between text-green-600">
                <div className="flex items-center gap-2">
                  <span>Discount ({pricing.discount.percent}%)</span>
                  <Badge variant="secondary" className="text-xs">
                    {pricing.discount.rule_name}
                  </Badge>
                </div>
                <span>-₱{pricing.discount.amount.toLocaleString()}</span>
              </div>
            </>
          )}

          <Separator />

          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>₱{pricing.total.toLocaleString()}</span>
          </div>

          <div className="text-primary flex justify-between text-lg font-bold">
            <span>Downpayment ({pricing.downpayment_percent}%):</span>
            <span>₱{pricing.downpayment_required.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Downpayment required. Admin assigns units based on booking urgency, typically within 4-24
          hours of payment verification.
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

### Main Booking Form

**File:** `src/components/guest-booking/MultiUnitGuestBookingForm.tsx`

```tsx
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Turnstile } from "@marsidev/react-turnstile";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { sanitizeInput } from "@/lib/security/sanitize";
import {
  multiUnitBookingSchema,
  type MultiUnitBookingRequest,
} from "@/types/guest-booking-multi-unit";

import { PaymentSummary } from "./PaymentSummary";
import { UnitRequestSelector } from "./UnitRequestSelector";

export function MultiUnitGuestBookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      unit_requests: [{ guests_per_unit: 2 }], // Start with 1 unit
      special_requests: "",
      terms_accepted: false,
      idempotency_key: idempotencyKey,
    },
  });

  const unitRequests = form.watch("unit_requests");
  const checkIn = form.watch("check_in");
  const checkOut = form.watch("check_out");

  const onSubmit = async (data: MultiUnitBookingRequest) => {
    if (!turnstileToken) {
      alert("Please complete security verification");
      return;
    }

    setIsSubmitting(true);

    try {
      // Sanitize inputs
      const sanitizedData = {
        ...data,
        guest_name: sanitizeInput(data.guest_name),
        special_requests: data.special_requests ? sanitizeInput(data.special_requests) : undefined,
        turnstile_token: turnstileToken,
        idempotency_key: idempotencyKey,
      };

      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sanitizedData),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Booking created! Reference: ${result.booking.booking_reference}`);
        form.reset();
      } else {
        alert(`Booking failed: ${result.error}`);
      }
    } catch (error) {
      alert("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Guest Information */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Guest Information</h2>

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

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
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
                  <Input {...field} placeholder="+63 912 345 6789" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Booking Dates */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Booking Dates</h2>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="check_in"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Check-in</FormLabel>
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
                  <FormLabel>Check-out</FormLabel>
                  <FormControl>
                    <Input {...field} type="datetime-local" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Unit Requests */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Unit Requests</h2>
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

        {/* Payment Summary */}
        {unitRequests.length > 0 && checkIn && checkOut && (
          <PaymentSummary
            unitRequests={unitRequests}
            checkIn={new Date(checkIn)}
            checkOut={new Date(checkOut)}
          />
        )}

        {/* Special Requests */}
        <FormField
          control={form.control}
          name="special_requests"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Special Requests (Optional)</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="e.g., Late check-in, ground floor preference" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Terms */}
        <FormField
          control={form.control}
          name="terms_accepted"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-y-0 space-x-3">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>I accept the terms and conditions</FormLabel>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Turnstile */}
        <Turnstile
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
        />

        {/* Submit */}
        <Button type="submit" disabled={isSubmitting || !turnstileToken} className="w-full">
          {isSubmitting ? "Creating Booking..." : "Create Booking"}
        </Button>
      </form>
    </Form>
  );
}
```

## Testing Checklist

- [ ] Add/remove unit cards
- [ ] Guest count validation (1-20)
- [ ] Maximum 10 units limit
- [ ] Pricing preview updates
- [ ] Weekend surcharge display
- [ ] Extra person fee calculation
- [ ] Discount application
- [ ] Form validation
- [ ] Turnstile verification
- [ ] Idempotency (duplicate prevention)

## Key Implementation Notes

**Data Model:**

- Array-based: Each `UnitRequestCard` = 1 unit
- NO `quantity` field or selector
- Add/remove cards to change unit count

**Pricing:**

- Client preview is ESTIMATE ONLY
- PostgreSQL function is authoritative
- Display warning that final pricing calculated by server

**Validation:**

- ✅ Validate `guests_per_unit` (1-20)
- ✅ Validate maximum 10 units
- ❌ NO availability checking on client

**User Experience:**

- Simple "Add Unit" button pattern
- Each card shows guest count for that unit
- Real-time pricing preview
- Clear downpayment messaging

**Security:**

- Sanitize all text inputs
- Turnstile CAPTCHA required
- Idempotency key generated client-side
