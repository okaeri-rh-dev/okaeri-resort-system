# Phase 7: Testing Strategy

## Overview

This document outlines the comprehensive testing strategy for the multi-unit guest booking system with server-side pricing, including unit tests, integration tests, E2E tests, and user acceptance testing.

**All test examples use the actual array-based API format** for accuracy and developer clarity.

## Test Asset Structure

**Location**: `tests/fixtures/`

```
tests/
  fixtures/
    images/
      payment-proof-valid.jpg          # Valid JPEG, 800KB (optimal)
      payment-proof-uncompressed.jpg   # Valid JPEG, 4.5MB (valid but unoptimized)
      payment-proof-toolarge.jpg       # Valid JPEG, 6MB (rejected by server)
      payment-proof-invalid.txt        # Text file with .jpg extension (fake)
      payment-proof-corrupt.jpg        # Corrupted JPEG header
    pdfs/
      payment-proof-valid.pdf          # Valid PDF, 500KB
      payment-proof-large.pdf          # Valid PDF, 6MB
      payment-proof-invalid.pdf        # Text file with .pdf extension
    bookings/
      valid-single-unit.json
      valid-multi-unit.json
      invalid-dates.json
      invalid-capacity.json
```

**Create Test Assets**:

```bash
# Create test directory
mkdir -p tests/fixtures/{images,pdfs,bookings}

# Generate test images (requires ImageMagick)
convert -size 800x600 xc:white -pointsize 40 -draw "text 200,300 'Payment Proof'" tests/fixtures/images/payment-proof-valid.jpg
convert -size 3000x2000 xc:white -pointsize 40 -draw "text 500,1000 'Uncompressed'" tests/fixtures/images/payment-proof-uncompressed.jpg
convert -size 4500x3500 xc:white -pointsize 40 -draw "text 1000,1750 'Too Large - Will Be Rejected'" tests/fixtures/images/payment-proof-toolarge.jpg

# Generate test PDFs
echo "Payment Proof Test Document" | ps2pdf - tests/fixtures/pdfs/payment-proof-valid.pdf

# Generate test JSON
cat > tests/fixtures/bookings/valid-multi-unit.json <<EOF
{
  "guest_name": "Test Guest",
  "email": "test@example.com",
  "phone_number": "+639171234567",
  "check_in": "2025-03-01",
  "check_out": "2025-03-08",
  "unit_requests": [
    { "guests_per_unit": 2 },
    { "guests_per_unit": 3 }
  ],
  "turnstile_token": "test-token",
  "terms_accepted": true
}
EOF
```

**Add to .gitignore**:

```
tests/fixtures/**/*.jpg
tests/fixtures/**/*.pdf
```

## Test Configuration

### Turnstile Test Tokens

Use Cloudflare's official test tokens for development and automated testing:

| Token                      | Behavior            | Use Case                                             |
| -------------------------- | ------------------- | ---------------------------------------------------- |
| `1x00000000000000000000AA` | Always passes       | Happy path tests, valid booking flows                |
| `2x00000000000000000000AB` | Always fails        | Error handling tests, security verification failures |
| `3x00000000000000000000AC` | Token already spent | Idempotency tests, duplicate submission scenarios    |

**Usage in tests:**

```typescript
// Valid booking test
const validBooking = {
  // ... booking data
  turnstile_token: "1x00000000000000000000AA", // Always passes
};

// Error handling test
const invalidTurnstile = {
  // ... booking data
  turnstile_token: "2x00000000000000000000AB", // Always fails
};
```

**Important**: Production requires real tokens from Cloudflare Turnstile widget. Test tokens will not work in production mode.

### Rate Limiting Test Strategy

Rate limiting tests require careful setup to avoid flakiness:

```typescript
test("enforces rate limiting on guest booking endpoint", async () => {
  const testIP = "203.0.113.1"; // TEST-NET-1 (RFC 5737)
  const booking = {
    /* valid booking data */
  };

  // Make requests exceeding rate limit (5 requests per hour)
  const promises = Array.from({ length: 6 }, () =>
    fetch("/api/guest-booking", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": testIP, // Simulate specific IP
      },
      body: JSON.stringify(booking),
    })
  );

  const responses = await Promise.all(promises);
  const statuses = responses.map((r) => r.status);

  // At least one request should be rate limited
  expect(statuses).toContain(429);

  // Verify rate limit response format
  const rateLimited = responses.find((r) => r.status === 429);
  const data = await rateLimited.json();

  expect(data).toMatchObject({
    success: false,
    error_code: "RATE_LIMIT_EXCEEDED",
    retry_after: expect.any(Number),
  });
});
```

### Transaction Rollback Test Strategy

Test atomic unit assignment with deliberate conflicts:

```typescript
test("rolls back all assignments if any unit conflicts", async () => {
  // Setup: Create a conflicting booking
  const existingBooking = await createTestBooking({
    unit_ids: ["unit-102"], // This unit is now booked
  });

  // Attempt to assign units including the conflicting one
  const response = await fetch("/api/admin/assign-units", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      booking_id: newBookingId,
      unit_ids: ["unit-101", "unit-102", "unit-103"], // unit-102 conflicts
    }),
  });

  expect(response.status).toBe(409);

  const data = await response.json();
  expect(data).toMatchObject({
    success: false,
    error_code: "UNIT_ALREADY_BOOKED",
    details: {
      conflicting_unit_id: "unit-102",
      conflicting_booking_id: existingBooking.booking_id,
    },
  });

  // Verify NO units were assigned (atomic rollback)
  const { data: assignedUnits } = await supabase
    .from("booking_units")
    .select("*")
    .eq("booking_id", newBookingId);

  expect(assignedUnits).toHaveLength(0); // All-or-nothing enforcement
});
```

### Admin Authorization Test Strategy

Test JWT verification and role-based access control:

```typescript
describe("Admin endpoint authorization", () => {
  test("rejects requests without JWT token", async () => {
    const response = await fetch("/api/admin/pending-bookings");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      error_code: "UNAUTHORIZED",
    });
  });

  test("rejects requests with invalid JWT", async () => {
    const response = await fetch("/api/admin/pending-bookings", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(401);
  });

  test("rejects requests from non-admin users", async () => {
    const guestToken = await getGuestUserToken(); // Role: 'guest'

    const response = await fetch("/api/admin/pending-bookings", {
      headers: { Authorization: `Bearer ${guestToken}` },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      success: false,
      error_code: "FORBIDDEN",
    });
  });

  test("allows requests from admin users", async () => {
    const adminToken = await getAdminUserToken(); // Role: 'admin'

    const response = await fetch("/api/admin/pending-bookings", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    expect(response.status).toBe(200);
  });
});
```

## Testing Pyramid

```
         /\
        /E2E\       5% - Critical user journeys
       /______\
      /        \
     /Integration\   20% - API & database tests
    /______________\
   /                \
  /   Unit Tests     \  75% - Component & function tests
 /____________________\
```

## Task 1: Pricing API Integration Testing

### 1.1 Server-Side Pricing Tests

**Purpose**: Verify PostgreSQL `calculate_booking_pricing()` function via API endpoints.

**File**: `functions/api/__tests__/pricing-integration.test.ts`

```typescript
import { describe, expect, test } from "vitest";

describe("Pricing API Integration", () => {
  describe("POST /api/guest-booking/preview-pricing", () => {
    test("calculates base price correctly for array-based request", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 2 }, // Unit 1
            { guests_per_unit: 2 }, // Unit 2
          ],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-03T11:00:00Z",
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.pricing.nights).toBe(2);
      expect(data.pricing.total_units).toBe(2);
      expect(data.pricing.total_guests).toBe(4);
      expect(data.pricing.base_total).toBeGreaterThan(0);
      expect(data.pricing.downpayment_required).toBe(data.pricing.total * 0.5);
    });

    test("applies weekend surcharge for Friday-Sunday stay", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 2 }, // Single unit
          ],
          check_in: "2025-02-07T14:00:00Z", // Friday
          check_out: "2025-02-09T11:00:00Z", // Sunday
        }),
      });

      const data = await response.json();

      expect(data.pricing.nights).toBe(2);
      expect(data.pricing.weekend_surcharge).toBeGreaterThan(0);
    });

    test("calculates extra person fees", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 4 }, // Unit 1: 2 extra guests (assuming base 2)
            { guests_per_unit: 4 }, // Unit 2: 2 extra guests
          ],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-02T11:00:00Z",
        }),
      });

      const data = await response.json();

      expect(data.pricing.extra_person_fees).toBeGreaterThan(0);
    });

    test("applies 5% discount for 7-night stay", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-08T11:00:00Z", // 7 nights
        }),
      });

      const data = await response.json();

      expect(data.pricing.nights).toBe(7);
      expect(data.pricing.discount).toBeDefined();
      expect(data.pricing.discount.percent).toBe(5);
      expect(data.pricing.discount.rule_name).toBe("Week Stay Discount");
    });

    test("applies 10% discount for 14-night stay", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }, { guests_per_unit: 2 }],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-15T11:00:00Z", // 14 nights
        }),
      });

      const data = await response.json();

      expect(data.pricing.discount.percent).toBe(10);
      expect(data.pricing.discount.rule_name).toBe("Two Week Discount");
    });

    test("NO discount for short stays (< 7 nights)", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
            { guests_per_unit: 2 },
          ],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-04T11:00:00Z", // Only 3 nights
        }),
      });

      const data = await response.json();

      expect(data.pricing.discount).toBeNull();
    });

    test("handles single night booking", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-02T11:00:00Z",
        }),
      });

      const data = await response.json();

      expect(data.pricing.nights).toBe(1);
      expect(data.pricing.base_total).toBeGreaterThan(0);
    });

    test("handles maximum 10 units", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: Array(10).fill({ guests_per_unit: 2 }),
          check_in: "2025-02-01T14:00:00Z",
          check_out: "2025-02-02T11:00:00Z",
        }),
      });

      const data = await response.json();

      expect(data.pricing.total_units).toBe(10);
      expect(data.pricing.base_total).toBeGreaterThan(0);
    });

    test("returns error for invalid date range", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-02-05T14:00:00Z",
          check_out: "2025-02-01T11:00:00Z", // Check-out before check-in
        }),
      });

      expect(response.status).toBe(400);
    });

    test("pricing always fetched from pricing_config table (single source of truth)", async () => {
      // Update pricing_config
      await supabase.from("pricing_config").update({ base_rate: 5000.0 }).eq("id", "default");

      // Call pricing preview
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-03-01T14:00:00Z",
          check_out: "2025-03-02T11:00:00Z",
        }),
      });

      const data = await response.json();

      // Verify it used updated rate from pricing_config
      expect(data.pricing.rates.base_rate).toBe(5000.0);

      // Cleanup: restore original rate
      await supabase.from("pricing_config").update({ base_rate: 3000.0 }).eq("id", "default");
    });
  });
});
```

**✅ Task 1 Complete**: Server-side pricing API tests created

---

## Task 1.5: Database Constraint Testing

### 1.5.1 Business Rule Constraint Tests

**Purpose**: Verify database constraints enforce business rules and prevent invalid states.

**File**: `__tests__/database/constraints.test.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";

describe("Database Constraint Tests", () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  });

  describe("payment_before_assignment constraint", () => {
    test("prevents unit assignment without payment verification", async () => {
      // Create booking with pending payment
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Constraint Test",
          payment_status: "Pending", // Not verified
          unit_assignment_status: "pending",
        })
        .select()
        .single();

      // Attempt to assign units without verifying payment
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking.booking_id);

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514"); // CHECK constraint violation
      expect(error?.message).toContain("payment_before_assignment");
    });

    test("allows unit assignment after payment verification", async () => {
      // Create booking with verified payment
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Verified Payment Test",
          payment_status: "Verified",
          unit_assignment_status: "pending",
        })
        .select()
        .single();

      // Should succeed - payment is verified
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking.booking_id);

      expect(error).toBeNull();
    });
  });

  describe("all_or_nothing_assignment constraint", () => {
    test("prevents partial unit assignment", async () => {
      // Create booking requesting 3 units
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Partial Assignment Test",
          payment_status: "Verified",
          is_multi_unit: true,
          requested_unit_count: 3,
          unit_assignment_status: "pending",
        })
        .select()
        .single();

      // Insert unit requests
      await supabase.from("guest_booking_unit_requests").insert([
        { booking_id: booking.booking_id, guests_per_unit: 2 },
        { booking_id: booking.booking_id, guests_per_unit: 2 },
        { booking_id: booking.booking_id, guests_per_unit: 2 },
      ]);

      // Assign only 2 units (partial assignment)
      await supabase.from("booking_units").insert([
        { booking_id: booking.booking_id, unit_id: "unit-1", status: "confirmed" },
        { booking_id: booking.booking_id, unit_id: "unit-2", status: "confirmed" },
      ]);

      // Attempt to mark as assigned (should fail - only 2/3 units assigned)
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking.booking_id);

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514");
      expect(error?.message).toContain("all_or_nothing_assignment");
    });

    test("allows complete unit assignment", async () => {
      // Create booking requesting 3 units
      const { data: booking } = await supabase
        .from("bookings")
        .insert({
          guest_name: "Complete Assignment Test",
          payment_status: "Verified",
          is_multi_unit: true,
          requested_unit_count: 3,
          unit_assignment_status: "pending",
        })
        .select()
        .single();

      // Insert unit requests
      await supabase.from("guest_booking_unit_requests").insert([
        { booking_id: booking.booking_id, guests_per_unit: 2 },
        { booking_id: booking.booking_id, guests_per_unit: 2 },
        { booking_id: booking.booking_id, guests_per_unit: 2 },
      ]);

      // Assign ALL 3 units
      await supabase.from("booking_units").insert([
        { booking_id: booking.booking_id, unit_id: "unit-1", status: "confirmed" },
        { booking_id: booking.booking_id, unit_id: "unit-2", status: "confirmed" },
        { booking_id: booking.booking_id, unit_id: "unit-3", status: "confirmed" },
      ]);

      // Should succeed - all units assigned
      const { error } = await supabase
        .from("bookings")
        .update({ unit_assignment_status: "assigned" })
        .eq("booking_id", booking.booking_id);

      expect(error).toBeNull();
    });
  });

  describe("no_double_booking EXCLUDE constraint", () => {
    test("prevents overlapping bookings for same unit", async () => {
      const unitId = "test-unit-overlap";
      const dates = {
        check_in: "2025-03-01",
        check_out: "2025-03-05",
      };

      // First booking
      const { error: error1 } = await supabase.from("booking_units").insert({
        booking_id: "booking-1",
        unit_id: unitId,
        check_in_date: dates.check_in,
        check_out_date: dates.check_out,
        status: "confirmed",
      });

      expect(error1).toBeNull();

      // Second booking (overlapping dates)
      const { error: error2 } = await supabase.from("booking_units").insert({
        booking_id: "booking-2",
        unit_id: unitId,
        check_in_date: "2025-03-03", // Overlaps with first booking
        check_out_date: "2025-03-07",
        status: "confirmed",
      });

      expect(error2).toBeDefined();
      expect(error2?.code).toBe("23P01"); // EXCLUDE constraint violation
      expect(error2?.message).toContain("no_double_booking");
    });

    test("allows consecutive bookings for same unit", async () => {
      const unitId = "test-unit-consecutive";

      // First booking
      const { error: error1 } = await supabase.from("booking_units").insert({
        booking_id: "booking-1",
        unit_id: unitId,
        check_in_date: "2025-04-01",
        check_out_date: "2025-04-05",
        status: "confirmed",
      });

      expect(error1).toBeNull();

      // Second booking (consecutive, no overlap)
      const { error: error2 } = await supabase.from("booking_units").insert({
        booking_id: "booking-2",
        unit_id: unitId,
        check_in_date: "2025-04-05", // Starts when first ends
        check_out_date: "2025-04-10",
        status: "confirmed",
      });

      expect(error2).toBeNull(); // Should succeed
    });
  });

  describe("guests_per_unit CHECK constraint", () => {
    test("prevents zero guests per unit", async () => {
      const { error } = await supabase.from("guest_booking_unit_requests").insert({
        booking_id: "test-booking",
        guests_per_unit: 0, // Invalid
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514");
      expect(error?.message).toContain("guests_per_unit");
    });

    test("prevents negative guests per unit", async () => {
      const { error } = await supabase.from("guest_booking_unit_requests").insert({
        booking_id: "test-booking",
        guests_per_unit: -5, // Invalid
      });

      expect(error).toBeDefined();
      expect(error?.code).toBe("23514");
    });
  });
});
```

**✅ Task 1.5 Complete**: Database constraint tests added

---

## Task 2: Integration Testing

### 2.1 API Integration Tests

**File**: `functions/api/__tests__/guest-booking-integration.test.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

describe("Guest Booking API Integration", () => {
  let testBookingId: string;

  afterAll(async () => {
    // Cleanup test data
    if (testBookingId) {
      await supabase.from("bookings").delete().eq("id", testBookingId);
    }
  });

  describe("POST /api/guest-booking", () => {
    test("creates multi-unit booking successfully", async () => {
      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": "test-" + Date.now(),
        },
        body: JSON.stringify({
          guest_name: "Test Guest",
          email: "test@example.com",
          phone_number: "+1234567890",
          check_in: new Date("2025-03-01").toISOString(),
          check_out: new Date("2025-03-03").toISOString(),
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }, { guests_per_unit: 2 }],
          special_requests: "Test booking",
          turnstile_token: "test-token",
          terms_accepted: true,
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.booking).toBeDefined();
      expect(data.booking.booking_reference).toMatch(/^BK-\d{4}\d{2}-[A-Z0-9]{6}$/);
      expect(data.booking.downpayment_required).toBeGreaterThan(0);

      testBookingId = data.booking.booking_id;
    });

    test("applies duration-based discount for week-long booking", async () => {
      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": "test-discount-" + Date.now(),
        },
        body: JSON.stringify({
          guest_name: "Discount Test",
          email: "discount@example.com",
          phone_number: "+1234567890",
          check_in: new Date("2025-03-01").toISOString(),
          check_out: new Date("2025-03-08").toISOString(), // 7 nights - should trigger 5% discount
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
          turnstile_token: "test-token",
          terms_accepted: true,
        }),
      });

      const data = await response.json();
      expect(data.booking.discount_applied).toBeDefined();
      expect(data.booking.discount_applied.percent).toBe(5); // Week stay discount
      expect(data.booking.discount_applied.rule_name).toBe("Week Stay Discount");
    });

    test("validates input correctly", async () => {
      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guest_name: "A", // Too short
          email: "invalid-email",
          unit_requests: [], // Empty array - invalid
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toBe("Validation failed");
      expect(data.details).toBeDefined();
    });

    test("enforces rate limiting", async () => {
      // Make 6 requests quickly (limit is 5 per hour)
      const promises = Array(6)
        .fill(null)
        .map((_, i) =>
          fetch("/api/guest-booking", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": `rate-limit-${i}`,
            },
            body: JSON.stringify({
              guest_name: "Rate Test",
              email: `rate${i}@example.com`,
              phone_number: "+1234567890",
              check_in: new Date("2025-03-01").toISOString(),
              check_out: new Date("2025-03-02").toISOString(),
              unit_requests: [{ guests_per_unit: 2 }],
              turnstile_token: "test-token",
              terms_accepted: true,
            }),
          })
        );

      const responses = await Promise.all(promises);
      const statuses = responses.map((r) => r.status);

      expect(statuses.filter((s) => s === 201).length).toBeLessThanOrEqual(5);
      expect(statuses).toContain(429); // Rate limited
    });
  });

  describe("GET /api/guest-booking/status", () => {
    test("retrieves booking status", async () => {
      // First create a booking
      const createResponse = await fetch("/api/guest-booking", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": "status-test-" + Date.now(),
        },
        body: JSON.stringify({
          guest_name: "Status Test",
          email: "status@example.com",
          phone_number: "+1234567890",
          check_in: new Date("2025-03-01").toISOString(),
          check_out: new Date("2025-03-02").toISOString(),
          unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
          turnstile_token: "test-token",
          terms_accepted: true,
        }),
      });

      const createData = await createResponse.json();
      const bookingReference = createData.booking.booking_reference;

      // Now check status
      const statusResponse = await fetch(
        `/api/guest-booking/status?reference=${bookingReference}&email=status@example.com`
      );

      expect(statusResponse.status).toBe(200);
      const statusData = await statusResponse.json();

      expect(statusData.success).toBe(true);
      expect(statusData.booking.booking_reference).toBe(bookingReference);
      expect(statusData.booking.is_multi_unit).toBe(true);
      expect(statusData.booking.unit_assignment_status).toBe("pending");
    });
  });
});
```

**✅ Task 2 Complete**: Integration tests created

---

## Task 3: End-to-End Testing

### 3.1 E2E Test Suite

**File**: `e2e/guest-booking-multi-unit.spec.ts`

```typescript
import { expect, test } from "@playwright/test";

test.describe("Multi-Unit Guest Booking Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/guest-booking");
  });

  test("complete multi-unit booking flow", async ({ page }) => {
    // Step 1: Guest Information
    await page.fill('[name="guest_name"]', "John Doe");
    await page.fill('[name="email"]', "john.doe@example.com");
    await page.fill('[name="phone_number"]', "+639123456789");
    await page.click('button:has-text("Next")');

    // Step 2: Dates and Units
    await page.click('[data-testid="check-in-date"]');
    await page.click('button[name="day"]:has-text("15")');

    await page.click('[data-testid="check-out-date"]');
    await page.click('button[name="day"]:has-text("17")');

    // Add units using "Add Unit" button
    await page.click('[data-testid="add-unit-button"]');
    await page.fill('[data-testid="unit-0-guests"]', "2");
    await page.click('[data-testid="add-unit-button"]');
    await page.fill('[data-testid="unit-1-guests"]', "2");
    await page.click('[data-testid="add-unit-button"]');
    await page.fill('[data-testid="unit-2-guests"]', "2");

    // Verify pricing displays
    await expect(page.locator('[data-testid="pricing-summary"]')).toBeVisible();
    await expect(page.locator("text=/₱.*9,000/")).toBeVisible(); // 3 units × 1 night × 3000

    await page.click('button:has-text("Next")');

    // Step 3: Review and Payment
    await expect(page.locator("text=/Downpayment Required/")).toBeVisible();
    await expect(page.locator("text=/₱.*4,500/")).toBeVisible(); // 50% of 9000

    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles("test-assets/payment-proof.jpg");

    // Special requests
    await page.fill('[name="special_requests"]', "Late check-in please");

    // Accept terms
    await page.check('[name="terms_accepted"]');

    // Complete Turnstile (mock in test environment)
    await page.evaluate(() => {
      window.turnstileCallback?.("test-token");
    });

    // Submit
    await page.click('button:has-text("Complete Booking")');

    // Success state
    await expect(page.locator("text=/Booking Confirmed/")).toBeVisible();
    await expect(page.locator("text=/BK-/")).toBeVisible(); // Booking reference
  });

  test("shows NO discount for short stay", async ({ page }) => {
    // Fill guest info
    await page.fill('[name="guest_name"]', "Jane Group");
    await page.fill('[name="email"]', "group@example.com");
    await page.fill('[name="phone_number"]', "+639123456789");
    await page.click('button:has-text("Next")');

    // Select dates
    await page.click('[data-testid="check-in-date"]');
    await page.click('button[name="day"]:has-text("20")');
    await page.click('[data-testid="check-out-date"]');
    await page.click('button[name="day"]:has-text("21")');

    // Add 2 units
    await page.click('[data-testid="add-unit-button"]');
    await page.fill('[data-testid="unit-0-guests"]', "2");
    await page.click('[data-testid="add-unit-button"]');
    await page.fill('[data-testid="unit-1-guests"]', "2");

    // Verify no discount appears (only 1 night stay)
    await expect(page.locator("text=/discount/")).not.toBeVisible();
  });

  test("validates maximum 10 units", async ({ page }) => {
    await page.fill('[name="guest_name"]', "Max Units");
    await page.fill('[name="email"]', "max@example.com");
    await page.fill('[name="phone_number"]', "+639123456789");
    await page.click('button:has-text("Next")');

    // Try to add more than 10 units
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="add-unit-button"]');
    }

    // 11th add should be disabled or show error
    const addButton = page.locator('[data-testid="add-unit-button"]');
    await expect(addButton).toBeDisabled();
    // OR
    await expect(page.locator("text=/Maximum 10 units/")).toBeVisible();
  });

  test("handles weekend surcharge", async ({ page }) => {
    await page.fill('[name="guest_name"]', "Weekend Guest");
    await page.fill('[name="email"]', "weekend@example.com");
    await page.fill('[name="phone_number"]', "+639123456789");
    await page.click('button:has-text("Next")');

    // Select Friday to Sunday (2 weekend nights)
    await page.click('[data-testid="check-in-date"]');
    // Select a Friday
    await page.evaluate(() => {
      const friday = new Date();
      friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7));
      // Set the date picker to this Friday
    });

    // Add 1 unit
    await page.click('[data-testid="add-unit-button"]');
    await page.fill('[data-testid="unit-0-guests"]', "2");

    // Verify weekend surcharge appears
    await expect(page.locator("text=/Weekend surcharge/")).toBeVisible();
  });
});
```

**✅ Task 3 Complete**: E2E tests created

---

## Task 4: Performance Testing

### 4.0 Performance Baseline Requirements

**Purpose**: Establish baseline metrics before implementation to measure regression.

#### Pre-Implementation Baseline

**When to Run Baseline**:

- **BEFORE** implementing multi-unit features (Week 0, before database changes)
- **AFTER** each phase completion (regression check)
- **BEFORE** production deployment (final verification)

```bash
# Run baseline capture
npm run test:performance:baseline

# Output saved to: performance-baseline-YYYY-MM-DD.json
```

**Schedule**:

1. Week 0 (Pre-Implementation): Initial baseline capture on current system (single-unit booking performance)
2. Week 1, End: Post-database migration baseline (measure database impact)
3. Week 2, End: Post-guest flow implementation (measure API impact)
4. Week 3, End: Post-admin interface implementation (measure admin UI impact)
5. Week 4, Pre-Deploy: Final performance verification (compare to Week 0 baseline)

**Baseline Metrics**:

| Metric                    | Baseline     | Acceptable | Red Flag |
| ------------------------- | ------------ | ---------- | -------- |
| Booking creation (p95)    | \_\_\_ ms    | +20%       | +50%     |
| Pricing calculation (p95) | \_\_\_ ms    | +30%       | +100%    |
| Database query (avg)      | \_\_\_ ms    | +15%       | +40%     |
| API response (p95)        | \_\_\_ ms    | +20%       | +50%     |
| Error rate                | \_\_\_%      | +0.5%      | +1%      |
| Throughput                | \_\_\_ req/s | -10%       | -25%     |

**Comparison After Implementation**:

```bash
# Run regression test
npm run test:performance:regression

# Generates report comparing current vs baseline
```

**Example Output**:

```
Performance Regression Report
================================
Booking Creation:  +12.3% (✅ Within threshold)
Pricing Calc:      +45.1% (⚠️  Near threshold)
Database Query:    +8.2%  (✅ Acceptable)
API Response:      +18.7% (✅ Within threshold)
Error Rate:        +0.2%  (✅ Acceptable)
Throughput:        -5.1%  (✅ Acceptable)

Overall: ✅ PASS (1 warning)
```

### 4.1 Load Testing Script

**File**: `tests/performance/load-test.js`

```javascript
import { check, sleep } from "k6";
import http from "k6/http";
import { Rate } from "k6/metrics";

const errorRate = new Rate("errors");

export const options = {
  stages: [
    { duration: "2m", target: 10 }, // Ramp up to 10 users
    { duration: "5m", target: 10 }, // Stay at 10 users
    { duration: "2m", target: 50 }, // Ramp up to 50 users
    { duration: "5m", target: 50 }, // Stay at 50 users
    { duration: "2m", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% of requests under 1s
    errors: ["rate<0.05"], // Error rate under 5%
  },
};

export default function () {
  // Generate random unit requests (1-5 units)
  const numUnits = Math.ceil(Math.random() * 5);
  const unit_requests = Array(numUnits)
    .fill(null)
    .map(() => ({
      guests_per_unit: 2 + Math.floor(Math.random() * 3), // 2-4 guests
    }));

  const payload = JSON.stringify({
    guest_name: `Test Guest ${Math.random()}`,
    email: `test${Date.now()}@example.com`,
    phone_number: "+1234567890",
    check_in: new Date("2025-03-01").toISOString(),
    check_out: new Date("2025-03-03").toISOString(),
    unit_requests,
    turnstile_token: "test-token",
    terms_accepted: true,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": `load-test-${Date.now()}-${Math.random()}`,
    },
  };

  const response = http.post("https://your-domain.com/api/guest-booking", payload, params);

  const success = check(response, {
    "status is 201": (r) => r.status === 201,
    "response has booking reference": (r) => {
      const body = JSON.parse(r.body);
      return body.booking && body.booking.booking_reference;
    },
    "response time < 1s": (r) => r.timings.duration < 1000,
  });

  errorRate.add(!success);

  sleep(1);
}
```

**✅ Task 4 Complete**: Performance tests created

---

## Performance & Load Testing

### Load Testing Scenarios

**Purpose**: Verify system handles expected load and identifies performance bottlenecks.

#### Test Scenarios

- [ ] **50 concurrent booking requests** - Test idempotency handling under load
- [ ] **Pricing function performance** - 100 requests/second sustained
- [ ] **Database connection pool limits** - Verify no exhaustion under load
- [ ] **Admin assignment interface** - Performance with 20+ pending bookings
- [ ] **File upload stress test** - Maximum size files (5MB) with concurrent uploads

#### Performance Targets

| Metric                  | Target  | Alert Threshold   |
| ----------------------- | ------- | ----------------- |
| API Response Time (p95) | < 800ms | > 2000ms          |
| Pricing Function        | < 100ms | > 500ms           |
| Database Query Avg      | < 100ms | > 500ms           |
| Concurrent Bookings     | 50/min  | Connection errors |
| Admin Dashboard Load    | < 2s    | > 5s              |

#### Testing Tools

- **Apache Bench (ab)**: API load testing
- **k6**: Comprehensive load testing (script above)
- **PostgreSQL EXPLAIN ANALYZE**: Query optimization
- **Cloudflare Analytics**: Workers performance monitoring

#### Sample Load Test Commands

```bash
# API endpoint load test (100 requests, 10 concurrent)
ab -n 100 -c 10 -H "Content-Type: application/json" \
  -p booking_payload.json \
  https://your-domain.com/api/guest-booking

# Pricing endpoint stress test (1000 requests, 50 concurrent)
ab -n 1000 -c 50 -H "Content-Type: application/json" \
  -p pricing_payload.json \
  https://your-domain.com/api/guest-booking/preview-pricing

# Database query performance test
psql $DATABASE_URL -c "EXPLAIN ANALYZE
  SELECT * FROM calculate_booking_pricing(
    '[{\"guests_per_unit\": 2}]'::jsonb,
    '2025-03-01'::date,
    '2025-03-08'::date
  );"
```

#### Load Testing Best Practices

1. **Test on staging first** - Never run load tests on production
2. **Gradual ramp-up** - Use k6 stages to simulate realistic traffic
3. **Monitor database** - Watch connection pool, query times, lock waits
4. **Track error rates** - < 0.5% acceptable under load
5. **Test rate limiting** - Verify 429 responses work correctly

---

## Task 5: User Acceptance Testing

### 5.1 UAT Scenarios

**File**: `tests/uat/scenarios.md`

```markdown
# User Acceptance Testing Scenarios

## Scenario 1: Family Booking (Happy Path)

**Actor**: Guest planning family vacation
**Goal**: Book 3 units for 6 people

1. Navigate to booking page
2. Enter personal information
3. Select check-in: March 15, check-out: March 18
4. Click "Add Unit" button 3 times
5. Enter 2 guests for each unit (total 6 guests)
6. Review pricing (verify 3 nights × 3 units)
7. Upload payment proof
8. Complete booking
9. View confirmation with booking reference

**Expected Result**: Booking created with pending assignment status, confirmation displayed

---

## Scenario 2: Duration Discount

**Actor**: Family planning extended vacation
**Goal**: Book units for 2 weeks and receive duration discount

1. Complete guest information
2. Select dates (14 nights stay)
3. Click "Add Unit" button twice
4. Enter 3 guests for unit 1, 3 guests for unit 2
5. Verify 10% discount appears (14+ days discount)
6. Note downpayment amount (default 50% of discounted total)
7. Upload payment proof and complete booking

**Expected Result**: 10% "Two Week Discount" applied automatically, shown in pricing preview

---

## Scenario 3: Weekend Pricing

**Actor**: Weekend guest
**Goal**: Book Friday-Sunday stay

1. Select Friday check-in, Sunday check-out
2. Click "Add Unit" button twice
3. Enter guest counts for both units
4. Verify weekend surcharge appears in pricing preview
5. Confirm total includes surcharge

**Expected Result**: Weekend rates applied correctly for Friday/Saturday nights

---

## Scenario 4: Maximum Capacity

**Actor**: Large group leader
**Goal**: Book maximum units

1. Click "Add Unit" button 10 times
2. Verify system accepts 10 units
3. Attempt to add 11th unit
4. Verify "Add Unit" button is disabled or shows error

**Expected Result**: Maximum 10 units enforced by UI

---

## Scenario 5: Admin Assignment

**Actor**: Resort admin
**Goal**: Assign units to pending booking

1. Access admin panel
2. View pending assignments queue
3. Open assignment modal for booking
4. Select appropriate units
5. Save assignments
6. Verify guest receives notification

**Expected Result**: Units assigned, guest notified
```

### 5.2 UAT Checklist

```markdown
# UAT Checklist

## Guest Booking Flow

- [ ] Form navigation works smoothly
- [ ] Validation messages are clear
- [ ] Pricing calculates correctly
- [ ] Discounts apply automatically
- [ ] File upload works (< 2MB)
- [ ] Turnstile CAPTCHA functions
- [ ] Success message displays
- [ ] Confirmation email received

## Admin Interface

- [ ] Pending bookings display
- [ ] Urgency indicators work
- [ ] Unit assignment modal opens
- [ ] Units can be selected/assigned
- [ ] Save updates database
- [ ] Guest receives notification
- [ ] Discount rules manageable
- [ ] Analytics dashboard loads

## Edge Cases

- [ ] Single unit booking works
- [ ] Maximum units (10) works
- [ ] Single night booking works
- [ ] Weekend surcharge applies
- [ ] Extra person fees calculate
- [ ] Network errors handled gracefully
- [ ] Browser back button handled
- [ ] Session timeout managed

## Performance

- [ ] Page loads < 3 seconds
- [ ] Form submission < 5 seconds
- [ ] No UI freezing
- [ ] Mobile responsive
- [ ] Works on slow connections
```

**✅ Task 5 Complete**: UAT scenarios created

---

## Task 6: Test Automation Setup

### 6.1 CI/CD Pipeline

**File**: `.github/workflows/test-multi-unit.yml`

```yaml
name: Multi-Unit Booking Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    paths:
      - "src/components/guest-booking/**"
      - "functions/api/guest-booking/**"
      - "database/migrations/**"

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: "18"

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Setup database
        run: |
          npm run db:migrate
          npm run db:seed:test

      - name: Run integration tests
        run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Run k6 performance tests
        uses: grafana/k6-action@v0.3.0
        with:
          filename: tests/performance/load-test.js
```

**✅ Task 6 Complete**: Test automation configured

---

## Test Coverage Requirements

| Component       | Target Coverage | Priority |
| --------------- | --------------- | -------- |
| Pricing Engine  | 100%            | Critical |
| Form Validation | 95%             | High     |
| API Endpoints   | 90%             | High     |
| Admin Interface | 80%             | Medium   |
| UI Components   | 75%             | Medium   |
| Utilities       | 90%             | Low      |

## Test Data Management

### Test Data Sets

```typescript
export const TEST_DATA = {
  guests: [
    { name: "John Single", unit_requests: [{ guests_per_unit: 2 }] },
    {
      name: "Jane Family",
      unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }, { guests_per_unit: 2 }],
    },
    { name: "Group Leader", unit_requests: Array(5).fill({ guests_per_unit: 2 }) },
    { name: "Max Booker", unit_requests: Array(10).fill({ guests_per_unit: 2 }) },
  ],

  dates: [
    { check_in: "2025-03-01", check_out: "2025-03-02" }, // 1 night
    { check_in: "2025-03-07", check_out: "2025-03-09" }, // Weekend
    { check_in: "2025-03-10", check_out: "2025-03-17" }, // Week
  ],

  edge_cases: [
    { unit_requests: [], expected_error: "At least 1 unit required" },
    { unit_requests: Array(11).fill({ guests_per_unit: 2 }), expected_error: "Maximum 10 units" },
    { unit_requests: [{ guests_per_unit: 0 }], expected_error: "At least 1 guest" },
    { unit_requests: [{ guests_per_unit: 21 }], expected_error: "Maximum 20 guests" },
  ],
};
```

## Task 6: Property-Based Testing

### 6.1 Server-Side Pricing Property Tests

**Purpose**: Verify PostgreSQL pricing function properties hold for ALL possible inputs

**File**: `functions/api/__tests__/pricing-properties.test.ts`

```typescript
import { fc } from "fast-check";
import { describe, expect, test } from "vitest";

describe("Server-Side Pricing - Property-Based Tests", () => {
  test("PROPERTY: Total price is never negative", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }), // number of units
        fc.integer({ min: 1, max: 20 }), // guests per unit
        fc.date(), // check_in
        fc.integer({ min: 1, max: 30 }), // nights
        async (numUnits, guests, checkIn, nights) => {
          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + nights);

          const response = await fetch("/api/guest-booking/preview-pricing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
              check_in: checkIn.toISOString(),
              check_out: checkOut.toISOString(),
            }),
          });

          const data = await response.json();
          return data.pricing.total >= 0;
        }
      ),
      { numRuns: 100 } // Test 100 random combinations
    );
  });

  test("PROPERTY: Downpayment is always 50% of total", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        fc.date(),
        fc.integer({ min: 1, max: 30 }),
        async (numUnits, guests, checkIn, nights) => {
          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + nights);

          const response = await fetch("/api/guest-booking/preview-pricing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
              check_in: checkIn.toISOString(),
              check_out: checkOut.toISOString(),
            }),
          });

          const data = await response.json();
          const expected = Math.round(data.pricing.total * 0.5);
          return data.pricing.downpayment_required === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("PROPERTY: Discount never exceeds subtotal", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        fc.date(),
        fc.integer({ min: 7, max: 30 }), // Long enough for discount
        async (numUnits, guests, checkIn, nights) => {
          const checkOut = new Date(checkIn);
          checkOut.setDate(checkOut.getDate() + nights);

          const response = await fetch("/api/guest-booking/preview-pricing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
              check_in: checkIn.toISOString(),
              check_out: checkOut.toISOString(),
            }),
          });

          const data = await response.json();
          const discountAmount = data.pricing.discount?.amount || 0;
          return discountAmount <= data.pricing.subtotal;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("PROPERTY: More nights always costs more (without discounts)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 20 }),
        fc.date(),
        fc.integer({ min: 1, max: 5 }), // shorter stay
        async (numUnits, guests, checkIn, shortNights) => {
          const longNights = shortNights + 1;
          const shortCheckOut = new Date(checkIn);
          shortCheckOut.setDate(shortCheckOut.getDate() + shortNights);

          const longCheckOut = new Date(checkIn);
          longCheckOut.setDate(longCheckOut.getDate() + longNights);

          const [shortResponse, longResponse] = await Promise.all([
            fetch("/api/guest-booking/preview-pricing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
                check_in: checkIn.toISOString(),
                check_out: shortCheckOut.toISOString(),
              }),
            }),
            fetch("/api/guest-booking/preview-pricing", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                unit_requests: Array(numUnits).fill({ guests_per_unit: guests }),
                check_in: checkIn.toISOString(),
                check_out: longCheckOut.toISOString(),
              }),
            }),
          ]);

          const shortData = await shortResponse.json();
          const longData = await longResponse.json();

          return longData.pricing.subtotal >= shortData.pricing.subtotal;
        }
      ),
      { numRuns: 50 } // Fewer runs due to API calls
    );
  });
});
```

**✅ Task 6 Complete**: Server-side property-based tests added

---

## Task 7: Concurrency Testing

### 7.1 Admin Assignment Concurrency Tests

**Purpose**: Verify system handles multiple admins assigning units simultaneously

**File**: `functions/api/__tests__/concurrency.test.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";

describe("Admin Assignment - Concurrency", () => {
  const supabase1 = createClient(url, key); // Admin 1
  const supabase2 = createClient(url, key); // Admin 2

  test("prevents double-booking when two admins assign same unit", async () => {
    const unit_id = "test-unit-1";
    const booking1_id = "booking-1";
    const booking2_id = "booking-2";
    const dates = {
      check_in: "2025-03-01",
      check_out: "2025-03-05",
    };

    // Both admins try to assign the same unit simultaneously
    const results = await Promise.allSettled([
      supabase1.from("booking_units").insert({
        booking_id: booking1_id,
        unit_id: unit_id,
        check_in_date: dates.check_in,
        check_out_date: dates.check_out,
        status: "confirmed",
      }),
      supabase2.from("booking_units").insert({
        booking_id: booking2_id,
        unit_id: unit_id,
        check_in_date: dates.check_in,
        check_out_date: dates.check_out,
        status: "confirmed",
      }),
    ]);

    // Exactly one should succeed, one should fail (EXCLUDE constraint)
    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);

    // Verify failed one has constraint violation error
    const error = (failed[0] as PromiseRejectedResult).reason;
    expect(error.code).toBe("23P01"); // PostgreSQL exclusion constraint
  });

  test("allows concurrent assignment of different units", async () => {
    const booking_id = "booking-multi";
    const units = ["unit-1", "unit-2", "unit-3"];
    const dates = {
      check_in: "2025-03-01",
      check_out: "2025-03-05",
    };

    // Assign all units concurrently
    const results = await Promise.allSettled(
      units.map((unit_id) =>
        supabase1.from("booking_units").insert({
          booking_id,
          unit_id,
          check_in_date: dates.check_in,
          check_out_date: dates.check_out,
          status: "confirmed",
        })
      )
    );

    // All should succeed (different units)
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });

  test("idempotency prevents duplicate booking creation", async () => {
    const idempotencyKey = crypto.randomUUID();
    const bookingData = {
      guest_name: "Test Guest",
      email: "test@example.com",
      phone_number: "+1234567890",
      check_in: "2025-03-01T14:00:00Z",
      check_out: "2025-03-03T11:00:00Z",
      unit_requests: [{ guests_per_unit: 2 }, { guests_per_unit: 2 }],
      turnstile_token: "test-token",
      terms_accepted: true,
      idempotency_key: idempotencyKey,
    };

    // Submit same booking twice simultaneously
    const [response1, response2] = await Promise.all([
      fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      }).then((r) => r.json()),
      fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingData),
      }).then((r) => r.json()),
    ]);

    // Both should succeed (same booking returned)
    expect(response1.success).toBe(true);
    expect(response2.success).toBe(true);

    // Should be the same booking ID
    expect(response1.booking.booking_id).toBe(response2.booking.booking_id);

    // At least one should indicate duplicate
    const duplicateDetected = response1.is_duplicate || response2.is_duplicate;
    expect(duplicateDetected).toBe(true);
  });
});
```

**✅ Task 7 Complete**: Concurrency tests added

---

## Task 8: Backward Compatibility Testing

### 8.1 Legacy Payload Support Tests

**Purpose**: Ensure API accepts both old and new booking formats

**File**: `functions/api/__tests__/backward-compatibility.test.ts`

```typescript
import { describe, expect, test } from "vitest";

describe("API Backward Compatibility", () => {
  test("accepts legacy single-unit payload", async () => {
    const legacyPayload = {
      unit_id: "unit-123", // Old field
      num_guests: 4, // Old field
      guest_name: "Test Guest",
      email: "test@example.com",
      phone_number: "+1234567890",
      check_in: "2025-03-01T14:00:00Z",
      check_out: "2025-03-05T11:00:00Z",
      special_requests: "Late check-in",
      turnstile_token: "test-token",
      terms_accepted: true,
    };

    const response = await fetch("/api/guest-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(legacyPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.booking).toBeDefined();
  });

  test("accepts new multi-unit payload", async () => {
    const multiUnitPayload = {
      unit_requests: [
        // Array-based: each entry = 1 unit
        { guests_per_unit: 3 }, // Unit 1
        { guests_per_unit: 3 }, // Unit 2
        { guests_per_unit: 4 }, // Unit 3
      ],
      guest_name: "Test Guest",
      email: "test@example.com",
      phone_number: "+1234567890",
      check_in: "2025-03-01T14:00:00Z",
      check_out: "2025-03-05T11:00:00Z",
      special_requests: "Adjacent units preferred",
      turnstile_token: "test-token",
      terms_accepted: true,
      idempotency_key: crypto.randomUUID(), // Optional new field
    };

    const response = await fetch("/api/guest-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(multiUnitPayload),
    });

    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data.booking).toBeDefined();
    expect(data.booking.requested_unit_count).toBe(3);
  });

  test("rejects invalid mixed payload", async () => {
    const invalidPayload = {
      unit_id: "unit-123", // Legacy field
      unit_requests: [
        {
          // New field (array-based)
          guests_per_unit: 2,
        },
      ],
      // Both present - should fail validation (can't have both legacy and new format)
    };

    const response = await fetch("/api/guest-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invalidPayload),
    });

    expect(response.status).toBe(400); // Bad Request
  });
});
```

**✅ Task 8 Complete**: Backward compatibility tests added

---

## Test Execution Plan

### Phase 0: Pre-Implementation (Week 0)

- Capture performance baseline on current system
- Document current single-unit booking metrics
- Store baseline for regression comparison

### Phase 1: Development (Week 1-3)

- Write unit tests alongside code
- Run tests locally before commits
- Maintain > 80% coverage
- Create test fixtures (images, PDFs, JSON)

### Phase 2: Integration (Week 4)

- Run full test suite
- Fix failing tests
- Performance regression check vs Week 0 baseline
- **Rollback dry-run on staging** (critical)
- Verify rollback timing (<1 hour target)
- Test rollback data integrity

### Phase 3: UAT (Week 5)

- Execute UAT scenarios
- Gather user feedback
- Fix critical issues

### Phase 4: Production (Week 6+)

- Monitor error rates
- Track performance metrics
- Continuous improvement

---

## Task 9: Rollback Testing

### Purpose

Verify rollback procedures work correctly and no data is lost during rollback.

### 9.1 Database Rollback Tests

**File**: `__tests__/rollback/database-rollback.test.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

describe("Database Rollback", () => {
  let testBookingId: string;

  beforeAll(async () => {
    // Create test booking in multi-unit schema
    const { data } = await supabase
      .from("bookings")
      .insert({
        guest_name: "Rollback Test",
        is_multi_unit: true,
        requested_unit_count: 3,
      })
      .select()
      .single();

    testBookingId = data.booking_id;
  });

  test("rollback script executes without errors", async () => {
    // Run rollback script
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        DROP TABLE IF EXISTS guest_booking_unit_requests CASCADE;
        DROP TABLE IF EXISTS discount_rules CASCADE;
        DROP TABLE IF EXISTS idempotency_keys CASCADE;
        ALTER TABLE bookings DROP COLUMN IF EXISTS is_multi_unit;
        -- etc.
      `,
    });

    expect(error).toBeNull();
  });

  test("existing bookings preserved after rollback", async () => {
    // Verify test booking still exists
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("booking_id", testBookingId)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.guest_name).toBe("Rollback Test");
  });

  test("multi-unit columns removed after rollback", async () => {
    // Query should fail if column doesn't exist
    const { error } = await supabase.from("bookings").select("is_multi_unit").limit(1);

    expect(error).toBeDefined();
    expect(error.message).toContain("column");
  });

  test("backward compatibility maintained", async () => {
    // Old API format should still work
    const response = await fetch("/api/guest-booking", {
      method: "POST",
      body: JSON.stringify({
        unit_id: "unit-123", // Legacy format
        num_guests: 2,
        // ... other fields
      }),
    });

    expect(response.ok).toBe(true);
  });
});
```

### 9.2 Rollback Checklist

**Pre-Rollback**:

- [ ] Create complete database backup
- [ ] Verify backup integrity
- [ ] Document current state (bookings count, revenue, etc.)
- [ ] Notify stakeholders of rollback window
- [ ] Disable cron jobs

**During Rollback**:

- [ ] Execute database rollback script
- [ ] Verify no errors in script execution
- [ ] Confirm existing bookings preserved
- [ ] Test legacy API endpoints
- [ ] Revert API deployment
- [ ] Revert frontend deployment

**Post-Rollback Verification**:

- [ ] Smoke test: Create single-unit booking
- [ ] Verify payment flow works
- [ ] Check admin interface loads
- [ ] Confirm no multi-unit tables exist
- [ ] Test backward compatibility
- [ ] Monitor error rates for 1 hour
- [ ] Re-enable cron jobs

### 9.3 Rollback Success Criteria

| Criterion         | Expected Result             |
| ----------------- | --------------------------- |
| Data Loss         | Zero bookings lost          |
| Downtime          | < 15 minutes                |
| Error Rate        | < 0.1% post-rollback        |
| API Compatibility | Legacy endpoints functional |
| User Impact       | No user-facing errors       |

### 9.4 Rollback Acceptance Tests

**Purpose**: Automated verification that rollback completed successfully.

**File**: `__tests__/rollback/acceptance.test.ts`

```typescript
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";

describe("Rollback Acceptance Tests", () => {
  let supabase: ReturnType<typeof createClient>;
  let preRollbackBookingCount: number;

  beforeAll(async () => {
    supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

    // Record pre-rollback state
    const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true });

    preRollbackBookingCount = count || 0;
  });

  describe("Data Integrity", () => {
    test("zero data loss - all bookings preserved", async () => {
      const { count } = await supabase.from("bookings").select("*", { count: "exact", head: true });

      expect(count).toBe(preRollbackBookingCount);
    });

    test("existing booking records intact", async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("booking_id, guest_name, check_in_date, check_out_date")
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);

      // Verify core fields are populated
      data!.forEach((booking) => {
        expect(booking.booking_id).toBeDefined();
        expect(booking.guest_name).toBeDefined();
        expect(booking.check_in_date).toBeDefined();
        expect(booking.check_out_date).toBeDefined();
      });
    });

    test("no orphaned records in related tables", async () => {
      // Verify all bookings have corresponding guests
      const { data: orphanedBookings } = await supabase
        .from("bookings")
        .select("booking_id")
        .is("guest_id", null);

      expect(orphanedBookings).toHaveLength(0);
    });
  });

  describe("Schema Verification", () => {
    test("multi-unit tables removed", async () => {
      const { error: requestsError } = await supabase
        .from("guest_booking_unit_requests")
        .select("*")
        .limit(1);

      expect(requestsError).toBeDefined();
      expect(requestsError?.message).toContain("does not exist");
    });

    test("multi-unit columns removed from bookings", async () => {
      const { error } = await supabase
        .from("bookings")
        .select("is_multi_unit, requested_unit_count")
        .limit(1);

      expect(error).toBeDefined();
      expect(error?.message).toContain("column");
    });

    test("core booking columns remain intact", async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("booking_id, guest_id, unit_id, check_in_date, check_out_date, booking_status")
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe("API Compatibility", () => {
    test("legacy single-unit booking works", async () => {
      const response = await fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: "test-unit-123",
          num_guests: 2,
          guest_name: "Rollback Test",
          email: "rollback@test.com",
          phone_number: "+1234567890",
          check_in: new Date("2025-03-01").toISOString(),
          check_out: new Date("2025-03-03").toISOString(),
          turnstile_token: "test-token",
          terms_accepted: true,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.booking).toBeDefined();
    });

    test("multi-unit endpoint returns 404 or handled gracefully", async () => {
      const response = await fetch("/api/guest-booking/preview-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_requests: [{ guests_per_unit: 2 }],
          check_in: "2025-03-01",
          check_out: "2025-03-03",
        }),
      });

      // Should either not exist (404) or return graceful error
      expect([404, 501].includes(response.status)).toBe(true);
    });

    test("admin dashboard loads without errors", async () => {
      const response = await fetch("/admin/bookings", {
        headers: {
          Authorization: `Bearer ${process.env.TEST_ADMIN_TOKEN}`,
        },
      });

      expect(response.ok).toBe(true);
    });
  });

  describe("Performance", () => {
    test("response time under 2 seconds", async () => {
      const start = Date.now();

      await fetch("/api/guest-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit_id: "perf-test-unit",
          num_guests: 2,
          guest_name: "Performance Test",
          email: "perf@test.com",
          phone_number: "+1234567890",
          check_in: new Date("2025-03-01").toISOString(),
          check_out: new Date("2025-03-03").toISOString(),
          turnstile_token: "test-token",
          terms_accepted: true,
        }),
      });

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2000);
    });

    test("database queries optimized", async () => {
      const start = Date.now();

      const { data, error } = await supabase
        .from("bookings")
        .select("*, guest:guests(*), unit:units(*)")
        .limit(10);

      const duration = Date.now() - start;

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(duration).toBeLessThan(500); // Should be fast
    });
  });

  describe("Error Monitoring", () => {
    test("error rate below threshold", async () => {
      // Make 100 requests
      const requests = Array(100)
        .fill(null)
        .map((_, i) =>
          fetch("/api/guest-booking", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unit_id: `test-unit-${i}`,
              num_guests: 2,
              guest_name: `Test ${i}`,
              email: `test${i}@example.com`,
              phone_number: "+1234567890",
              check_in: new Date("2025-03-01").toISOString(),
              check_out: new Date("2025-03-03").toISOString(),
              turnstile_token: "test-token",
              terms_accepted: true,
            }),
          })
        );

      const responses = await Promise.all(requests);
      const errors = responses.filter((r) => !r.ok);
      const errorRate = (errors.length / responses.length) * 100;

      expect(errorRate).toBeLessThan(0.1); // < 0.1% error rate
    });
  });
});
```

### 9.5 Rollback Execution Timeline

| Time    | Activity                             | Duration  | Owner      |
| ------- | ------------------------------------ | --------- | ---------- |
| T-30min | Final backup + verification          | 15min     | DevOps     |
| T-15min | Notify stakeholders                  | 5min      | Product    |
| T-10min | Disable cron jobs                    | 2min      | DevOps     |
| T-5min  | Final go/no-go decision              | 3min      | Team       |
| **T0**  | **Execute rollback script**          | **10min** | **DevOps** |
| T+5min  | Run acceptance tests                 | 5min      | QA         |
| T+10min | Smoke test key flows                 | 10min     | QA         |
| T+20min | Monitor error rates                  | 15min     | DevOps     |
| T+35min | Re-enable cron jobs (if stable)      | 2min      | DevOps     |
| T+40min | Notify stakeholders (success/issues) | 5min      | Product    |

**Total Rollback Window**: ~40 minutes (target: <1 hour)

### 9.6 Post-Rollback Monitoring

**First Hour** (Critical):

- Monitor error rates every 5 minutes
- Check booking creation success rate
- Verify no data corruption alerts
- Watch database connection pool

**First 24 Hours** (Important):

- Track booking completion rate
- Monitor user complaints/support tickets
- Verify cron jobs executing correctly
- Check payment processing flow

**First Week** (Observation):

- Compare metrics to pre-migration baseline
- Validate no long-term data issues
- Confirm system stability
- Document lessons learned

### 9.7 Rollback Decision Matrix

| Scenario                        | Action                               | Rationale                            |
| ------------------------------- | ------------------------------------ | ------------------------------------ |
| 100% acceptance tests pass      | Declare success                      | System fully operational             |
| 90-99% tests pass, minor issues | Conditional success, monitor closely | Acceptable degradation               |
| 75-89% tests pass               | Investigate + hotfix                 | Significant issues but manageable    |
| <75% tests pass                 | Emergency escalation                 | Major problems, consider re-rollback |
| Critical data loss detected     | STOP - Restore from backup           | Data integrity paramount             |

---

## Success Metrics

| Metric            | Target   | Measurement          |
| ----------------- | -------- | -------------------- |
| Code Coverage     | > 85%    | Jest/Vitest coverage |
| Test Pass Rate    | > 98%    | CI/CD pipeline       |
| Performance       | < 1s p95 | k6 load tests        |
| UAT Approval      | > 90%    | User feedback        |
| Production Errors | < 0.1%   | Error tracking       |
| Rollback Success  | 100%     | Rollback tests pass  |
