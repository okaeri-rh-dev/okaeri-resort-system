# Chunk 007: Payment Summary with Preview - Implementation Instructions

## Overview

**Estimated Time**: 75 minutes
**Goal**: Implement server-side pricing preview component with real-time updates

**What You'll Build**:

1. PricingPreview TypeScript interface
2. API client function for preview endpoint
3. PaymentSummary component with debouncing
4. Loading, error, and success states
5. Discount display and downpayment calculation
6. Component unit tests

---

## Step 1: Extend TypeScript Types (10 minutes)

Add interfaces for pricing preview API responses.

**File**: `src/types/guest-booking-multi-unit.ts` (MODIFY)

Add the following interfaces to the existing file:

```typescript
/**
 * Pricing preview response from server
 * Returned by /api/guest-booking/preview-pricing endpoint
 * Source: 02-api-specification.md lines 676-691
 */
export interface PricingPreview {
  nights: number; // Number of nights in stay
  total_units: number; // Total units requested
  total_guests: number; // Total guests across all units
  base_total: number; // Base rate × nights × units
  weekend_surcharge: number; // Extra charge for weekend nights (Fri/Sat)
  extra_person_fees: number; // Fees for guests above base_occupancy
  subtotal: number; // base_total + surcharges + fees
  discount?: {
    // Optional discount (best-of policy)
    percent: number; // Discount percentage (e.g., 5)
    amount: number; // Discount amount in currency
    rule_name: string; // Discount rule name (e.g., "7-Night Discount")
  };
  total: number; // Final total after discount
  downpayment_required: number; // Required downpayment amount
  downpayment_percent: number; // Downpayment percentage (default: 50)
}

/**
 * API response shape for preview endpoint
 */
export interface PricingPreviewResponse {
  success: boolean;
  pricing: PricingPreview;
  _note?: string; // Server note (e.g., "PREVIEW ONLY")
}

/**
 * Request payload for preview endpoint
 */
export interface PricingPreviewRequest {
  unit_requests: UnitRequest[];
  check_in: string; // ISO 8601 datetime string
  check_out: string; // ISO 8601 datetime string
}
```

**Verify Types**:

```bash
npx tsc --noEmit src/types/guest-booking-multi-unit.ts
# Should compile without errors
```

---

## Step 2: Extend API Client (10 minutes)

Add `previewPricing()` function to API client.

**File**: `src/lib/api/guest-booking-client.ts` (MODIFY)

Add the following function to the existing file:

```typescript
import type {
  PricingPreviewRequest,
  PricingPreviewResponse,
  UnitRequest,
} from "@/types/guest-booking-multi-unit";

/**
 * Fetch pricing preview from server
 * POST /api/guest-booking/preview-pricing
 *
 * IMPORTANT: This endpoint calls PostgreSQL calculate_booking_pricing() function.
 * It is NOT a client-side calculation - it's a server-side preview wrapper for UX.
 *
 * Source: 02-api-specification.md lines 645-698
 *
 * @param request Pricing preview request with dates and unit requests
 * @throws Error if API call fails or returns non-success
 * @returns PricingPreview with breakdown
 */
export async function previewPricing(
  request: PricingPreviewRequest
): Promise<PricingPreviewResponse> {
  try {
    const response = await fetch(`${API_BASE}/preview-pricing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch pricing preview: ${response.status} ${response.statusText}`);
    }

    const data: PricingPreviewResponse = await response.json();

    if (!data.success) {
      throw new Error("API returned success: false");
    }

    return data;
  } catch (error) {
    console.error("[API] previewPricing error:", error);
    throw error;
  }
}
```

**Test API Client**:

```bash
# Create a quick test (delete after verification)
cat > /tmp/test-preview-pricing.ts << 'EOF'
import { previewPricing } from './src/lib/api/guest-booking-client';

async function test() {
  try {
    const data = await previewPricing({
      unit_requests: [{ guests_per_unit: 2 }],
      check_in: '2025-02-01T00:00:00Z',
      check_out: '2025-02-08T00:00:00Z',
    });
    console.log('✅ Pricing preview:', data.pricing);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
EOF

# Run test (requires API endpoint to be running)
npx tsx /tmp/test-preview-pricing.ts
```

---

## Step 3: Create PaymentSummary Component (25 minutes)

Build pricing preview component with server-side calculations.

**File**: `src/components/guest-booking/PaymentSummary.tsx` (NEW)

```typescript
import { useEffect, useState } from 'react';

import { AlertTriangle, Info } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { previewPricing } from '@/lib/api/guest-booking-client';
import type { PricingPreview, UnitRequest } from '@/types/guest-booking-multi-unit';

interface PaymentSummaryProps {
  unitRequests: UnitRequest[];  // Array of unit requests from form
  checkIn: Date | undefined;     // Check-in date from form
  checkOut: Date | undefined;    // Check-out date from form
}

/**
 * PaymentSummary - Server-side pricing preview component
 *
 * CRITICAL ARCHITECTURAL NOTE:
 * This component does NOT calculate pricing client-side.
 * It calls /api/guest-booking/preview-pricing which wraps the
 * PostgreSQL calculate_booking_pricing() function.
 *
 * Source: 03-frontend-components.md lines 555-754
 */
export function PaymentSummary({ unitRequests, checkIn, checkOut }: PaymentSummaryProps) {
  const [pricing, setPricing] = useState<PricingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced API call for pricing preview
  useEffect(() => {
    // Reset if required fields missing
    if (unitRequests.length === 0 || !checkIn || !checkOut) {
      setPricing(null);
      return;
    }

    // Debounce: wait 500ms after last change before calling API
    const timer = setTimeout(() => {
      async function fetchPricing() {
        setLoading(true);
        setError(null);

        try {
          // SERVER-SIDE PREVIEW: Calls PostgreSQL function
          const response = await previewPricing({
            unit_requests: unitRequests,
            check_in: checkIn.toISOString(),
            check_out: checkOut.toISOString(),
          });

          setPricing(response.pricing);
        } catch (err) {
          console.error('[PaymentSummary] Pricing preview error:', err);
          setError('Unable to calculate pricing. Please try again.');
        } finally {
          setLoading(false);
        }
      }

      fetchPricing();
    }, 500); // 500ms debounce delay

    // Cleanup: cancel timer if dependencies change
    return () => clearTimeout(timer);
  }, [unitRequests, checkIn, checkOut]); // Re-run when form changes

  // Empty state: No units selected
  if (unitRequests.length === 0) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>Add units to see pricing estimate</AlertDescription>
      </Alert>
    );
  }

  // Loading state: Calculating pricing
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calculating Pricing...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  // Error state: Preview failed
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // No pricing data yet
  if (!pricing) return null;

  return (
    <div className="space-y-4">
      {/* Preview warning banner */}
      <Alert variant="warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Preview Only</strong> - Final pricing calculated by server at booking submission.
          Prices subject to change if configuration updates.
        </AlertDescription>
      </Alert>

      {/* Pricing breakdown card */}
      <Card>
        <CardHeader>
          <CardTitle>Booking Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stay details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Units:</span>
              <span className="font-medium">{pricing.total_units}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guests:</span>
              <span className="font-medium">{pricing.total_guests}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nights:</span>
              <span className="font-medium">{pricing.nights}</span>
            </div>
          </div>

          <Separator />

          {/* Pricing components */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Base Total:</span>
              <span>₱{pricing.base_total.toLocaleString()}</span>
            </div>

            {/* Weekend surcharge (if applicable) */}
            {pricing.weekend_surcharge > 0 && (
              <div className="flex justify-between">
                <span>Weekend Surcharge:</span>
                <span>₱{pricing.weekend_surcharge.toLocaleString()}</span>
              </div>
            )}

            {/* Extra person fees (if applicable) */}
            {pricing.extra_person_fees > 0 && (
              <div className="flex justify-between">
                <span>Extra Person Fees:</span>
                <span>₱{pricing.extra_person_fees.toLocaleString()}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Subtotal */}
          <div className="flex justify-between font-medium">
            <span>Subtotal:</span>
            <span>₱{pricing.subtotal.toLocaleString()}</span>
          </div>

          {/* Discount (if applicable) */}
          {pricing.discount && (
            <>
              <div className="flex justify-between text-green-600 dark:text-green-500">
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

          {/* Total */}
          <div className="flex justify-between text-lg font-bold">
            <span>Total:</span>
            <span>₱{pricing.total.toLocaleString()}</span>
          </div>

          {/* Downpayment (highlighted) */}
          <div className="text-primary flex justify-between text-lg font-bold">
            <span>Downpayment Required ({pricing.downpayment_percent}%):</span>
            <span>₱{pricing.downpayment_required.toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Admin assignment notice */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Downpayment secures your booking. Admin assigns specific units after payment verification,
          typically within 4-24 hours.
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

**Verify Component Compiles**:

```bash
npm run type-check
# Should compile without errors
```

---

## Step 4: Add Missing shadcn/ui Components (5 minutes)

Install any missing UI components.

```bash
# Check if Badge and Separator components exist
ls src/components/ui/badge.tsx 2>/dev/null || npx shadcn@latest add badge
ls src/components/ui/separator.tsx 2>/dev/null || npx shadcn@latest add separator
ls src/components/ui/skeleton.tsx 2>/dev/null || npx shadcn@latest add skeleton

# Verify installations
ls src/components/ui/ | grep -E "badge|separator|skeleton"
```

---

## Step 5: Create Component Tests (15 minutes)

Write unit tests for PaymentSummary component.

**File**: `src/components/guest-booking/__tests__/PaymentSummary.test.tsx` (NEW)

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PaymentSummary } from '../PaymentSummary';

// Mock API client
vi.mock('@/lib/api/guest-booking-client', () => ({
  previewPricing: vi.fn(() =>
    Promise.resolve({
      success: true,
      pricing: {
        nights: 7,
        total_units: 2,
        total_guests: 5,
        base_total: 28000,
        weekend_surcharge: 2000,
        extra_person_fees: 900,
        subtotal: 30900,
        discount: {
          percent: 5,
          amount: 1545,
          rule_name: '7-Night Discount',
        },
        total: 29355,
        downpayment_required: 14677.5,
        downpayment_percent: 50,
      },
    })
  ),
}));

describe('PaymentSummary', () => {
  const checkIn = new Date('2025-02-01');
  const checkOut = new Date('2025-02-08');
  const unitRequests = [{ guests_per_unit: 2 }, { guests_per_unit: 3 }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no units selected', () => {
    render(<PaymentSummary unitRequests={[]} checkIn={checkIn} checkOut={checkOut} />);

    expect(screen.getByText(/add units to see pricing/i)).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    expect(screen.getByText(/calculating pricing/i)).toBeInTheDocument();
  });

  it('displays pricing breakdown after loading', async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText('Booking Summary')).toBeInTheDocument();
    });

    // Check stay details
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 units
    expect(screen.getByText('5')).toBeInTheDocument(); // 5 guests
    expect(screen.getByText('7')).toBeInTheDocument(); // 7 nights

    // Check pricing components
    expect(screen.getByText(/₱28,000/)).toBeInTheDocument(); // Base total
    expect(screen.getByText(/₱2,000/)).toBeInTheDocument(); // Weekend surcharge
    expect(screen.getByText(/₱900/)).toBeInTheDocument(); // Extra person fees
    expect(screen.getByText(/₱30,900/)).toBeInTheDocument(); // Subtotal
  });

  it('displays discount when applicable', async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/7-Night Discount/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/5%/)).toBeInTheDocument(); // Discount percent
    expect(screen.getByText(/-₱1,545/)).toBeInTheDocument(); // Discount amount
  });

  it('displays total and downpayment', async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/₱29,355/)).toBeInTheDocument(); // Total
    });

    expect(screen.getByText(/₱14,677.50/)).toBeInTheDocument(); // Downpayment (50%)
    expect(screen.getByText(/50%/)).toBeInTheDocument(); // Downpayment percent
  });

  it('shows preview warning banner', async () => {
    render(<PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />);

    await waitFor(() => {
      expect(screen.getByText(/preview only/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/final pricing calculated by server/i)).toBeInTheDocument();
  });

  it('debounces API calls', async () => {
    const { rerender } = render(
      <PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />
    );

    // Change props rapidly (simulating user editing)
    rerender(
      <PaymentSummary
        unitRequests={[...unitRequests, { guests_per_unit: 2 }]}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    );

    rerender(
      <PaymentSummary
        unitRequests={[...unitRequests, { guests_per_unit: 2 }, { guests_per_unit: 3 }]}
        checkIn={checkIn}
        checkOut={checkOut}
      />
    );

    // Wait for debounce (500ms)
    await waitFor(
      () => {
        // Should only call API once after debounce settles
        expect(vi.mocked(previewPricing)).toHaveBeenCalledTimes(1);
      },
      { timeout: 1000 }
    );
  });
});
```

**Run Tests**:

```bash
npm run test:run src/components/guest-booking/__tests__/PaymentSummary.test.tsx
```

---

## Step 6: Integration Example (5 minutes)

Example of using PaymentSummary in parent form.

**Example**: Update parent component to include PaymentSummary

```typescript
import { useState } from 'react';
import type { UnitRequest } from '@/types/guest-booking-multi-unit';
import { DateRangePicker } from '@/components/guest-booking/DateRangePicker';
import { UnitRequestSelector } from '@/components/guest-booking/UnitRequestSelector';
import { PaymentSummary } from '@/components/guest-booking/PaymentSummary'; // NEW

export function GuestBookingPage() {
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [unitRequests, setUnitRequests] = useState<UnitRequest[]>([]);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold">Book Your Stay</h1>

      <DateRangePicker
        checkIn={checkIn}
        checkOut={checkOut}
        onCheckInChange={setCheckIn}
        onCheckOutChange={setCheckOut}
      />

      <UnitRequestSelector value={unitRequests} onChange={setUnitRequests} />

      {/* NEW: Payment Summary */}
      <PaymentSummary unitRequests={unitRequests} checkIn={checkIn} checkOut={checkOut} />

      {/* Chunk 008 will add PaymentProofUpload here */}
      {/* Chunk 009 will wrap in React Hook Form */}
    </div>
  );
}
```

---

## Step 7: Verify Build and Tests (5 minutes)

Run final verification checks.

```bash
# TypeScript compilation
npm run type-check
# Expected: No errors

# Linting
npm run lint
# Expected: No errors (or only warnings)

# Unit tests
npm run test:run src/components/guest-booking
# Expected: All tests pass

# Build for production
npm run build
# Expected: Build successful
```

---

## Done! ✅

You've successfully implemented:

- ✅ TypeScript types for pricing preview
- ✅ API client function for preview endpoint
- ✅ PaymentSummary component with server-side pricing
- ✅ Debounced API calls (500ms)
- ✅ Discount display with badge
- ✅ Downpayment calculation display
- ✅ Loading, error, and success states
- ✅ Component unit tests

**Next Steps**:

1. Run checkpoint.md verification procedures
2. Commit changes: `git commit -m "feat: complete chunk 007-payment-summary-preview"`
3. Move to **Chunk 008: Payment Proof Upload**

**Commit Message Template**:

```
feat: complete chunk 007-payment-summary-preview

- Add PricingPreview TypeScript interface
- Implement previewPricing() API client function
- Create PaymentSummary component with server-side pricing
- Add debouncing (500ms delay) for API calls
- Display pricing breakdown with discount badge
- Show downpayment requirement
- Include comprehensive component tests

Chunk 007 of 17 (Phase 2: Guest Booking Flow)
Estimated time: 75 minutes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Troubleshooting**: If any checks failed, see `troubleshooting.md` for common issues and solutions.
