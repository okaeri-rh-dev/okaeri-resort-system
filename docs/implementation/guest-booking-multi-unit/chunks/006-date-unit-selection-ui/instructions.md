# Chunk 006: Date and Unit Selection UI - Implementation Instructions

## Overview

**Estimated Time**: 90 minutes
**Goal**: Implement guest-facing date picker and array-based unit selection UI components

**What You'll Build**:

1. TypeScript types for multi-unit booking
2. Date range picker component
3. Unit request card component (single unit)
4. Unit request selector container (manages array of cards)
5. API client for fetching static rates
6. Component unit tests

---

## Step 1: Install Dependencies (5 minutes)

Install required packages for date picker and form handling.

```bash
# Install date picker library (if not already installed)
npm install react-day-picker date-fns

# Install form handling (if not already installed)
npm install react-hook-form @hookform/resolvers zod

# Verify installations
npm list react-day-picker react-hook-form zod
```

**Expected Output**:

```
react-day-picker@9.x.x
react-hook-form@7.x.x
zod@3.x.x
```

**Verify**:

```bash
npm run type-check
# Should compile without errors
```

---

## Step 2: Create TypeScript Types (10 minutes)

Define interfaces for multi-unit booking data structures.

**File**: `src/types/guest-booking-multi-unit.ts`

```typescript
/**
 * Multi-Unit Guest Booking Types
 *
 * Architectural Decision: Array-based model where each row = 1 unit
 * See: docs/implementation/guest-booking-multi-unit/09-implementation-decisions.md lines 9-38
 */

/**
 * Single unit request in the array-based model
 * NO quantity field - each object represents exactly 1 unit
 */
export interface UnitRequest {
  guests_per_unit: number; // Number of guests for THIS unit
}

/**
 * Static rate configuration from pricing_config table
 * Fetched from GET /api/guest-booking/rates
 * Source: 01-database-schema.md lines 31-45
 */
export interface StandardUnitRates {
  base_rate: number; // Weekday rate per night
  weekend_rate: number; // Weekend (Fri/Sat) rate per night
  extra_person_rate: number; // Fee per person above base_occupancy
  base_occupancy: number; // Included guests (e.g., 2)
  max_capacity_per_unit: number; // Physical limit (e.g., 10)
  downpayment_percent: number; // Required downpayment % (e.g., 50)
}

/**
 * API response shape for /api/guest-booking/rates
 */
export interface RatesApiResponse {
  success: boolean;
  rates: StandardUnitRates;
}

/**
 * Guest booking form data (for React Hook Form)
 * This chunk implements date_range and unit_requests
 * Chunks 008-009 will add contact_info, payment_proof_url, etc.
 */
export interface GuestBookingFormData {
  // Step 1: Dates (this chunk)
  date_range: {
    check_in: Date;
    check_out: Date;
  };

  // Step 2: Units (this chunk)
  unit_requests: UnitRequest[];

  // Step 3: Contact (Chunk 009)
  contact_info?: {
    full_name: string;
    email: string;
    phone: string;
    special_requests?: string;
  };

  // Step 4: Payment (Chunk 008)
  payment_proof_url?: string;

  // Step 5: Terms (Chunk 009)
  terms_accepted?: boolean;
}

/**
 * Validation error types for unit requests
 */
export interface UnitRequestValidationError {
  field: "guests_per_unit" | "total_units";
  message: string;
}
```

**Verify Types**:

```bash
npx tsc --noEmit src/types/guest-booking-multi-unit.ts
# Should compile without errors
```

---

## Step 3: Create API Client Helpers (10 minutes)

Build type-safe wrapper for guest booking API endpoints.

**File**: `src/lib/api/guest-booking-client.ts`

```typescript
import type { RatesApiResponse } from "@/types/guest-booking-multi-unit";

/**
 * API Client for Guest Booking Endpoints
 *
 * This chunk implements fetchRates only.
 * Chunks 007-009 will add previewPricing, submitBooking, etc.
 */

const API_BASE = "/api/guest-booking";

/**
 * Fetch static rate configuration
 * GET /api/guest-booking/rates
 *
 * Returns pricing_config table data for display purposes only.
 * Does NOT calculate actual pricing - that's done server-side.
 *
 * @throws Error if API call fails or returns non-success
 * @returns StandardUnitRates configuration
 */
export async function fetchRates(): Promise<RatesApiResponse> {
  try {
    const response = await fetch(`${API_BASE}/rates`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch rates: ${response.status} ${response.statusText}`);
    }

    const data: RatesApiResponse = await response.json();

    if (!data.success) {
      throw new Error("API returned success: false");
    }

    return data;
  } catch (error) {
    console.error("[API] fetchRates error:", error);
    throw error;
  }
}

/**
 * Calculate number of nights between dates
 * Helper for display purposes
 */
export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = checkOut.getTime() - checkIn.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Validate date range
 * Client-side validation for UX (server validates again)
 */
export function validateDateRange(checkIn: Date, checkOut: Date): string | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Reset time for date-only comparison

  if (checkIn < now) {
    return "Check-in date cannot be in the past";
  }

  if (checkOut <= checkIn) {
    return "Check-out date must be after check-in date";
  }

  const nights = calculateNights(checkIn, checkOut);
  if (nights < 1) {
    return "Minimum stay is 1 night";
  }

  return null; // Valid
}
```

**Test API Client**:

```bash
# Create a quick test file (delete after verification)
cat > /tmp/test-api-client.ts << 'EOF'
import { fetchRates } from './src/lib/api/guest-booking-client';

async function test() {
  try {
    const data = await fetchRates();
    console.log('✅ Rates fetched:', data.rates);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

test();
EOF

# Run test (requires API endpoint to be running)
npx tsx /tmp/test-api-client.ts
```

---

## Step 4: Create UnitRequestCard Component (15 minutes)

Build single unit card component with guest count input.

**File**: `src/components/guest-booking/UnitRequestCard.tsx`

```typescript
import { Home, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UnitRequestCardProps {
  index: number;                  // 0-based index for display (show as "Unit #1", "Unit #2")
  guestsPerUnit: number;          // Current guest count for this unit
  onGuestsChange: (guests: number) => void; // Callback when guest count changes
  onRemove: () => void;           // Callback to remove this card
  disabled?: boolean;             // Disable all inputs (e.g., during submission)
  maxCapacityPerUnit: number;     // From pricing_config.max_capacity_per_unit
  baseOccupancy: number;          // From pricing_config.base_occupancy
  extraPersonRate: number;        // From pricing_config.extra_person_rate
  canRemove: boolean;             // Show remove button (false if only 1 unit)
}

/**
 * UnitRequestCard - Single unit request in array-based model
 *
 * Architectural Note: This component represents EXACTLY 1 unit.
 * There is NO "quantity" field - the parent manages an array of these cards.
 *
 * Source: 03-frontend-components.md lines 46-137
 */
export function UnitRequestCard({
  index,
  guestsPerUnit,
  onGuestsChange,
  onRemove,
  disabled = false,
  maxCapacityPerUnit,
  baseOccupancy,
  extraPersonRate,
  canRemove,
}: UnitRequestCardProps) {
  const handleGuestsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1;

    // Client-side validation (UX only - server validates again)
    if (value >= 1 && value <= maxCapacityPerUnit) {
      onGuestsChange(value);
    }
  };

  // Calculate extra persons (above base occupancy)
  const extraPersons = Math.max(0, guestsPerUnit - baseOccupancy);

  return (
    <Card className="relative">
      {/* Remove button (only show if canRemove=true) */}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove unit ${index + 1}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
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
            className="w-full"
          />
          <p className="text-muted-foreground text-xs">
            Maximum {maxCapacityPerUnit} guests per unit
          </p>

          {/* Extra person fee indicator */}
          {extraPersons > 0 && (
            <p className="text-yellow-600 dark:text-yellow-500 text-xs mt-1">
              ⚠️ Extra person fee: ₱{extraPersonRate.toLocaleString()}/person/night ({extraPersons} extra{' '}
              {extraPersons === 1 ? 'person' : 'people'})
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Verify Component Compiles**:

```bash
npm run type-check
# Should compile without errors
```

---

## Step 5: Create UnitRequestSelector Container (20 minutes)

Build container component that manages array of unit cards.

**File**: `src/components/guest-booking/UnitRequestSelector.tsx`

```typescript
import { useEffect, useState } from 'react';

import { Info, Plus } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchRates } from '@/lib/api/guest-booking-client';
import type { StandardUnitRates, UnitRequest } from '@/types/guest-booking-multi-unit';

import { UnitRequestCard } from './UnitRequestCard';

interface UnitRequestSelectorProps {
  value: UnitRequest[];                     // Array of unit requests (controlled)
  onChange: (requests: UnitRequest[]) => void; // Update callback
  disabled?: boolean;                       // Disable all interactions
  maxTotalUnits?: number;                   // Maximum units per booking (default: 10)
}

/**
 * UnitRequestSelector - Container for array-based unit selection
 *
 * Key Features:
 * - Fetches static rates from API on mount
 * - Manages array of UnitRequestCard components
 * - Add/remove unit cards (NOT quantity input)
 * - Displays totals (units + guests)
 * - Shows static rate reference
 *
 * Architectural Note: This is a DISPLAY of static rates only.
 * Actual pricing calculated server-side in Chunk 007.
 *
 * Source: 03-frontend-components.md lines 381-553
 */
export function UnitRequestSelector({
  value,
  onChange,
  disabled = false,
  maxTotalUnits = 10,
}: UnitRequestSelectorProps) {
  const [unitRates, setUnitRates] = useState<StandardUnitRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch static rates on mount
  useEffect(() => {
    async function loadRates() {
      try {
        setLoading(true);
        const response = await fetchRates();
        setUnitRates(response.rates);
        setError(null);
      } catch (err) {
        console.error('[UnitRequestSelector] Failed to fetch rates:', err);
        setError('Failed to load pricing information. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }

    loadRates();
  }, []);

  // Calculate totals
  const totalUnits = value.length;
  const totalGuests = value.reduce((sum, req) => sum + req.guests_per_unit, 0);

  // Add new unit card
  const handleAddRequest = () => {
    if (totalUnits < maxTotalUnits && unitRates) {
      onChange([
        ...value,
        { guests_per_unit: unitRates.base_occupancy }, // Default to base occupancy
      ]);
    }
  };

  // Update specific unit's guest count
  const handleUpdateRequest = (index: number, guests: number) => {
    const newRequests = [...value];
    newRequests[index] = { guests_per_unit: guests };
    onChange(newRequests);
  };

  // Remove unit card
  const handleRemoveRequest = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Error state
  if (error || !unitRates) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || 'Unable to load pricing configuration'}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Add units and specify guests for each. Admin assigns specific units after booking confirmation.
          {totalUnits > 0 && (
            <span className="mt-2 block font-medium text-foreground">
              Total: {totalUnits} unit{totalUnits !== 1 ? 's' : ''}, {totalGuests} guest
              {totalGuests !== 1 ? 's' : ''}
            </span>
          )}
        </AlertDescription>
      </Alert>

      {/* Static rate display card */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4">Current Rates (Reference Only)</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Base Rate:</span>
              <span className="ml-2 font-medium">₱{unitRates.base_rate.toLocaleString()}/night</span>
            </div>
            <div>
              <span className="text-muted-foreground">Weekend Rate:</span>
              <span className="ml-2 font-medium">₱{unitRates.weekend_rate.toLocaleString()}/night</span>
            </div>
            <div>
              <span className="text-muted-foreground">Base Occupancy:</span>
              <span className="ml-2 font-medium">{unitRates.base_occupancy} guests</span>
            </div>
            <div>
              <span className="text-muted-foreground">Extra Person:</span>
              <span className="ml-2 font-medium">₱{unitRates.extra_person_rate.toLocaleString()}/night</span>
            </div>
          </div>
          <p className="text-muted-foreground text-xs mt-4">
            Final pricing calculated based on your specific dates and unit requests.
          </p>
        </CardContent>
      </Card>

      {/* Unit cards or empty state */}
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

      {/* Add another unit button (if < max) */}
      {value.length > 0 && totalUnits < maxTotalUnits && (
        <Button onClick={handleAddRequest} disabled={disabled} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Add Another Unit
        </Button>
      )}

      {/* Max units warning */}
      {totalUnits >= maxTotalUnits && (
        <Alert variant="warning">
          <AlertDescription>
            Maximum of {maxTotalUnits} units per booking reached. Contact us directly for larger group bookings.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
```

**Verify Component Compiles**:

```bash
npm run type-check
```

---

## Step 6: Create DateRangePicker Component (15 minutes)

Build date range selection with validation.

**File**: `src/components/guest-booking/DateRangePicker.tsx`

```typescript
import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { calculateNights, validateDateRange } from '@/lib/api/guest-booking-client';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  checkIn: Date | undefined;
  checkOut: Date | undefined;
  onCheckInChange: (date: Date | undefined) => void;
  onCheckOutChange: (date: Date | undefined) => void;
  disabled?: boolean;
}

/**
 * DateRangePicker - Check-in/check-out date selection
 *
 * Validation:
 * - No past dates
 * - Check-out must be after check-in
 * - Minimum 1 night stay
 *
 * Source: Based on shadcn/ui date-range-picker pattern
 */
export function DateRangePicker({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  disabled = false,
}: DateRangePickerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = (range: DateRange | undefined) => {
    const newCheckIn = range?.from;
    const newCheckOut = range?.to;

    onCheckInChange(newCheckIn);
    onCheckOutChange(newCheckOut);

    // Validate when both dates selected
    if (newCheckIn && newCheckOut) {
      const validationError = validateDateRange(newCheckIn, newCheckOut);
      setError(validationError);
    } else {
      setError(null);
    }
  };

  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;

  return (
    <div className="space-y-4">
      <div>
        <Label>Select Dates</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal',
                !checkIn && !checkOut && 'text-muted-foreground'
              )}
              disabled={disabled}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {checkIn && checkOut ? (
                <>
                  {format(checkIn, 'PPP')} - {format(checkOut, 'PPP')}
                  <span className="ml-2 text-muted-foreground">({nights} night{nights !== 1 ? 's' : ''})</span>
                </>
              ) : (
                <span>Pick check-in and check-out dates</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={{
                from: checkIn,
                to: checkOut,
              }}
              onSelect={handleDateChange}
              disabled={(date) => date < new Date()}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {error && <p className="text-destructive text-sm mt-2">{error}</p>}

        {checkIn && checkOut && !error && (
          <p className="text-muted-foreground text-sm mt-2">
            Stay duration: {nights} night{nights !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
```

**Note**: Ensure `Calendar` component exists in `src/components/ui/calendar.tsx`. If not, add it:

```bash
npx shadcn@latest add calendar
```

---

## Step 7: Create Component Tests (10 minutes)

Write unit tests for components.

**File**: `src/components/guest-booking/__tests__/UnitRequestCard.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { UnitRequestCard } from '../UnitRequestCard';

describe('UnitRequestCard', () => {
  const defaultProps = {
    index: 0,
    guestsPerUnit: 2,
    onGuestsChange: vi.fn(),
    onRemove: vi.fn(),
    maxCapacityPerUnit: 10,
    baseOccupancy: 2,
    extraPersonRate: 300,
    canRemove: true,
  };

  it('renders unit number correctly', () => {
    render(<UnitRequestCard {...defaultProps} />);
    expect(screen.getByText('Unit #1')).toBeInTheDocument();
  });

  it('displays current guest count', () => {
    render(<UnitRequestCard {...defaultProps} />);
    const input = screen.getByLabelText(/guests per unit/i) as HTMLInputElement;
    expect(input.value).toBe('2');
  });

  it('calls onGuestsChange when value changes', () => {
    const onGuestsChange = vi.fn();
    render(<UnitRequestCard {...defaultProps} onGuestsChange={onGuestsChange} />);

    const input = screen.getByLabelText(/guests per unit/i);
    fireEvent.change(input, { target: { value: '5' } });

    expect(onGuestsChange).toHaveBeenCalledWith(5);
  });

  it('shows extra person indicator when above base occupancy', () => {
    render(<UnitRequestCard {...defaultProps} guestsPerUnit={5} />);
    expect(screen.getByText(/extra person fee/i)).toBeInTheDocument();
    expect(screen.getByText(/3 extra people/i)).toBeInTheDocument();
  });

  it('does not show extra person indicator at base occupancy', () => {
    render(<UnitRequestCard {...defaultProps} guestsPerUnit={2} />);
    expect(screen.queryByText(/extra person fee/i)).not.toBeInTheDocument();
  });

  it('shows remove button when canRemove is true', () => {
    render(<UnitRequestCard {...defaultProps} canRemove={true} />);
    expect(screen.getByRole('button', { name: /remove unit/i })).toBeInTheDocument();
  });

  it('hides remove button when canRemove is false', () => {
    render(<UnitRequestCard {...defaultProps} canRemove={false} />);
    expect(screen.queryByRole('button', { name: /remove unit/i })).not.toBeInTheDocument();
  });

  it('validates max capacity', () => {
    const onGuestsChange = vi.fn();
    render(<UnitRequestCard {...defaultProps} onGuestsChange={onGuestsChange} maxCapacityPerUnit={10} />);

    const input = screen.getByLabelText(/guests per unit/i);

    // Valid value
    fireEvent.change(input, { target: { value: '8' } });
    expect(onGuestsChange).toHaveBeenCalledWith(8);

    // Invalid value (exceeds max)
    fireEvent.change(input, { target: { value: '15' } });
    expect(onGuestsChange).not.toHaveBeenCalledWith(15);
  });
});
```

**File**: `src/components/guest-booking/__tests__/UnitRequestSelector.test.tsx`

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { UnitRequestSelector } from '../UnitRequestSelector';

// Mock API client
vi.mock('@/lib/api/guest-booking-client', () => ({
  fetchRates: vi.fn(() =>
    Promise.resolve({
      success: true,
      rates: {
        base_rate: 2000,
        weekend_rate: 2500,
        extra_person_rate: 300,
        base_occupancy: 2,
        max_capacity_per_unit: 10,
        downpayment_percent: 50,
      },
    })
  ),
}));

describe('UnitRequestSelector', () => {
  const defaultProps = {
    value: [],
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    render(<UnitRequestSelector {...defaultProps} />);
    expect(screen.getByRole('status')).toBeInTheDocument(); // Skeleton loading
  });

  it('displays static rates after loading', async () => {
    render(<UnitRequestSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/current rates/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/₱2,000\/night/i)).toBeInTheDocument();
    expect(screen.getByText(/₱2,500\/night/i)).toBeInTheDocument();
  });

  it('shows empty state when no units', async () => {
    render(<UnitRequestSelector {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/no units selected/i)).toBeInTheDocument();
    });
  });

  it('displays unit cards for each request', async () => {
    const value = [{ guests_per_unit: 2 }, { guests_per_unit: 3 }];

    render(<UnitRequestSelector {...defaultProps} value={value} />);

    await waitFor(() => {
      expect(screen.getByText('Unit #1')).toBeInTheDocument();
      expect(screen.getByText('Unit #2')).toBeInTheDocument();
    });
  });

  it('calculates and displays totals correctly', async () => {
    const value = [{ guests_per_unit: 2 }, { guests_per_unit: 3 }, { guests_per_unit: 2 }];

    render(<UnitRequestSelector {...defaultProps} value={value} />);

    await waitFor(() => {
      expect(screen.getByText(/3 units, 7 guests/i)).toBeInTheDocument();
    });
  });
});
```

**Run Tests**:

```bash
npm run test:run src/components/guest-booking
```

---

## Step 8: Integration Example (Optional, 5 minutes)

Example of using components in a parent form.

**Example**: `src/routes/guest-booking.tsx` (or wherever your form lives)

```typescript
import { useState } from 'react';
import type { UnitRequest } from '@/types/guest-booking-multi-unit';
import { DateRangePicker } from '@/components/guest-booking/DateRangePicker';
import { UnitRequestSelector } from '@/components/guest-booking/UnitRequestSelector';

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

      {/* Chunk 007 will add PaymentSummary here */}
      {/* Chunk 008 will add PaymentProofUpload */}
      {/* Chunk 009 will wrap in React Hook Form */}
    </div>
  );
}
```

---

## Step 9: Verify Build and Tests (5 minutes)

Run final verification checks.

```bash
# TypeScript compilation
npm run type-check
# Expected: No errors

# Linting
npm run lint
# Expected: No errors (or only warnings)

# Unit tests
npm run test:run
# Expected: All tests pass

# Build for production
npm run build
# Expected: Build successful
```

---

## Done! ✅

You've successfully implemented:

- ✅ TypeScript types for multi-unit booking
- ✅ Date range picker with validation
- ✅ Unit request card component
- ✅ Unit request selector container
- ✅ API client for fetching rates
- ✅ Component unit tests

**Next Steps**:

1. Run checkpoint.md verification procedures
2. Commit changes: `git commit -m "feat: complete chunk 006-date-unit-selection-ui"`
3. Move to **Chunk 007: Payment Summary with Preview**

**Commit Message Template**:

```
feat: complete chunk 006-date-unit-selection-ui

- Add TypeScript types for multi-unit booking
- Implement date range picker with validation
- Create UnitRequestCard component (array-based model)
- Create UnitRequestSelector container
- Add API client for fetching static rates
- Include component unit tests

Chunk 006 of Phase 2: Guest Booking Flow
Estimated time: 90 minutes
```

**Troubleshooting**: If any checks failed, see `troubleshooting.md` for common issues and solutions.
