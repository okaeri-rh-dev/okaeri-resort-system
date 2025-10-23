# Test Fixtures for Multi-Unit Guest Booking

## Overview

Sample data and fixtures for testing the multi-unit guest booking system. Use these payloads for manual testing, automated tests, and documentation examples.

## Pricing Configuration Fixture

**Purpose**: Default pricing configuration (singleton row in `pricing_config` table).

```json
{
  "id": "default",
  "base_rate": 3000.0,
  "weekend_rate": 3500.0,
  "extra_person_rate": 500.0,
  "base_occupancy": 2,
  "max_capacity_per_unit": 20,
  "downpayment_percent": 50.0,
  "currency": "PHP"
}
```

## Unit Requests Fixtures

### Single Unit Request

```json
{
  "unit_requests": [
    {
      "guests_per_unit": 2
    }
  ]
}
```

**Expected Pricing** (7 nights, no weekends):

- Base: ₱21,000 (3,000 × 7)
- Weekend surcharge: ₱0
- Extra person fees: ₱0
- **Total**: ₱21,000
- **Downpayment**: ₱10,500 (50%)

### Multi-Unit Request (3 units, varied occupancy)

```json
{
  "unit_requests": [
    {
      "guests_per_unit": 2
    },
    {
      "guests_per_unit": 4
    },
    {
      "guests_per_unit": 3
    }
  ]
}
```

**Total guests**: 9 (2 + 4 + 3)
**Total units**: 3

**Expected Pricing** (7 nights, 2 weekends):

- Base: ₱63,000 (3,000 × 3 units × 7 nights)
- Weekend surcharge: ₱3,000 (500 × 3 units × 2 weekend nights)
- Extra person fees: ₱10,500 ((2 extras + 1 extra) × 500 × 7)
- **Subtotal**: ₱76,500
- **Discount** (7-night): ₱3,825 (5%)
- **Total**: ₱72,675
- **Downpayment**: ₱36,337.50 (50%)

### Large Booking (10 units, max capacity)

```json
{
  "unit_requests": [
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 },
    { "guests_per_unit": 10 }
  ]
}
```

**Total guests**: 100
**Total units**: 10 (maximum allowed per booking)

## Complete Booking Fixtures

### Standard Multi-Unit Booking

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440001",
  "guest_name": "Juan Dela Cruz",
  "email": "juan.delacruz@example.com",
  "phone_number": "+639171234567",
  "check_in": "2025-03-15T14:00:00Z",
  "check_out": "2025-03-22T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 2 }, { "guests_per_unit": 3 }, { "guests_per_unit": 2 }],
  "special_requests": "Near the pool area. Early check-in if possible.",
  "payment_proof_url": "https://storage.example.com/proofs/uuid-here.jpg",
  "turnstile_token": "0.test-token.2025-01-01",
  "terms_accepted": true
}
```

**Expected Response:**

```json
{
  "success": true,
  "booking_id": "uuid-generated-by-server",
  "booking_reference": "BK-2025031501",
  "status": "pending",
  "message": "Booking request received. Admin will review and assign units based on urgency (typically 1-24 hours)."
}
```

### Booking with 14-Day Discount

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440002",
  "guest_name": "Maria Santos",
  "email": "maria.santos@example.com",
  "phone_number": "+639181234567",
  "check_in": "2025-04-01T14:00:00Z",
  "check_out": "2025-04-15T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 4 }, { "guests_per_unit": 4 }],
  "special_requests": "Celebrating wedding anniversary. Room with sea view preferred.",
  "payment_proof_url": "https://storage.example.com/proofs/uuid-here.jpg",
  "turnstile_token": "0.test-token.2025-01-01",
  "terms_accepted": true
}
```

**Expected Pricing** (14 nights):

- 10% discount applied automatically
- Discount rule: "Two Week Discount"

### Edge Case: Maximum Guests Per Unit

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440003",
  "guest_name": "Pedro Reyes",
  "email": "pedro.reyes@example.com",
  "phone_number": "+639191234567",
  "check_in": "2025-05-01T14:00:00Z",
  "check_out": "2025-05-08T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 20 }],
  "special_requests": "Large family reunion. Need extra tables and chairs.",
  "payment_proof_url": "https://storage.example.com/proofs/uuid-here.jpg",
  "turnstile_token": "0.test-token.2025-01-01",
  "terms_accepted": true
}
```

**Expected Behavior**: Accepted (20 guests = max_capacity_per_unit)

### Edge Case: Exceeds Guest Capacity

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440004",
  "guest_name": "Invalid Request",
  "email": "invalid@example.com",
  "phone_number": "+639201234567",
  "check_in": "2025-06-01T14:00:00Z",
  "check_out": "2025-06-08T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 25 }],
  "special_requests": "",
  "payment_proof_url": "https://storage.example.com/proofs/uuid-here.jpg",
  "turnstile_token": "0.test-token.2025-01-01",
  "terms_accepted": true
}
```

**Expected Response:**

```json
{
  "success": false,
  "error": "Maximum 20 guests per unit",
  "error_code": "VALIDATION_ERROR"
}
```

## Discount Rules Fixtures

### Default Duration Discounts

```sql
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority)
VALUES
  ('Week Stay Discount', '5% off for 7+ nights', '[{"type": "min_nights", "value": 7}]'::JSONB, 'percentage', 5.00, 1),
  ('Two Week Discount', '10% off for 14+ nights', '[{"type": "min_nights", "value": 14}]'::JSONB, 'percentage', 10.00, 2),
  ('Three Week Discount', '15% off for 21+ nights', '[{"type": "min_nights", "value": 21}]'::JSONB, 'percentage', 15.00, 3),
  ('Monthly Stay Discount', '20% off for 28+ nights', '[{"type": "min_nights", "value": 28}]'::JSONB, 'percentage', 20.00, 4);
```

### Example Seasonal Discount (Optional)

```sql
INSERT INTO discount_rules (name, description, conditions, discount_type, discount_value, priority, is_active)
VALUES (
  'Summer Promo',
  '10% off for bookings between April-May',
  '[{"type": "date_range", "value": ["2025-04-01", "2025-05-31"]}]'::JSONB,
  'percentage',
  10.00,
  5,
  true
);
```

## Pricing Preview Fixtures

### POST /api/guest-booking/preview-pricing

**Request:**

```json
{
  "check_in": "2025-03-01T14:00:00Z",
  "check_out": "2025-03-08T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 2 }, { "guests_per_unit": 3 }]
}
```

**Expected Response:**

```json
{
  "success": true,
  "pricing": {
    "version": "1.0.0",
    "computed_at": "2025-01-23T10:00:00Z",
    "nights": 7,
    "total_units": 2,
    "total_guests": 5,
    "rates": {
      "base_rate": 3000.0,
      "weekend_rate": 3500.0,
      "extra_person_rate": 500.0,
      "base_occupancy": 2
    },
    "base_total": 42000.0,
    "weekend_surcharge": 2000.0,
    "extra_person_fees": 3500.0,
    "subtotal": 47500.0,
    "discount": {
      "percent": 5.0,
      "amount": 2375.0,
      "rule_name": "Week Stay Discount"
    },
    "total": 45125.0,
    "downpayment_required": 22562.5,
    "downpayment_percent": 50.0,
    "currency": "PHP"
  }
}
```

## Idempotency Test Fixtures

### Duplicate Request (Same Key)

**First Request:**

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440005",
  "guest_name": "Test Duplicate",
  "email": "duplicate@example.com",
  "phone_number": "+639211234567",
  "check_in": "2025-07-01T14:00:00Z",
  "check_out": "2025-07-08T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 2 }],
  "turnstile_token": "0.test-token.2025-01-01",
  "terms_accepted": true
}
```

**Second Request (Identical Key):**

```json
{
  "idempotency_key": "550e8400-e29b-41d4-a716-446655440005",
  "guest_name": "Different Name",
  "email": "different@example.com",
  "phone_number": "+639221234567",
  "check_in": "2025-08-01T14:00:00Z",
  "check_out": "2025-08-08T11:00:00Z",
  "unit_requests": [{ "guests_per_unit": 4 }],
  "turnstile_token": "0.test-token.2025-01-01",
  "terms_accepted": true
}
```

**Expected Behavior**: Second request returns existing booking from first request (idempotency protection).

## Admin Endpoint Fixtures

### GET /api/admin/pending-bookings

**Expected Response:**

```json
{
  "success": true,
  "bookings": [
    {
      "booking_id": "uuid-1",
      "booking_reference": "BK-2025031501",
      "guest_name": "Juan Dela Cruz",
      "email": "juan.delacruz@example.com",
      "phone_number": "+639171234567",
      "check_in_date": "2025-03-15T14:00:00Z",
      "check_out_date": "2025-03-22T11:00:00Z",
      "requested_unit_count": 3,
      "total_amount": 72675.0,
      "downpayment_required": 36337.5,
      "payment_status": "Verified",
      "payment_proof_url": "https://storage.example.com/proofs/uuid-here.jpg",
      "unit_assignment_status": "pending",
      "urgency_score": 85,
      "created_at": "2025-03-14T10:00:00Z",
      "special_requests": "Near the pool area. Early check-in if possible."
    }
  ]
}
```

### POST /api/admin/assign-units

**Request:**

```json
{
  "booking_id": "uuid-1",
  "unit_ids": ["unit-uuid-101", "unit-uuid-102", "unit-uuid-103"]
}
```

**Expected Response (Success):**

```json
{
  "success": true,
  "message": "Units assigned successfully"
}
```

**Expected Response (Conflict - Double Booking):**

```json
{
  "success": false,
  "error": "One or more units already booked for these dates",
  "error_code": "UNIT_ALREADY_BOOKED"
}
```

## Error Response Fixtures

### Validation Error

```json
{
  "success": false,
  "error": "Maximum 20 guests per unit",
  "error_code": "VALIDATION_ERROR"
}
```

### Rate Limit Error

```json
{
  "success": false,
  "error": "Rate limit exceeded. Please try again later.",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 3420
}
```

### Turnstile Verification Error

```json
{
  "success": false,
  "error": "CAPTCHA verification failed",
  "error_code": "TURNSTILE_VERIFICATION_FAILED"
}
```

### Idempotency Collision

```json
{
  "success": true,
  "booking_id": "existing-uuid",
  "booking_reference": "BK-2025031501",
  "status": "pending",
  "message": "Booking already exists (idempotency key matched)",
  "is_duplicate": true
}
```

## Usage in Tests

### Vitest Example

```typescript
import { describe, expect, it } from "vitest";

import { standardMultiUnitBooking } from "./fixtures/bookings";

describe("Guest Booking API", () => {
  it("should create multi-unit booking", async () => {
    const response = await fetch("/api/guest-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(standardMultiUnitBooking),
    });

    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.booking_reference).toMatch(/^BK-\d{10}$/);
  });
});
```

### Database Seeding

```typescript
// scripts/seed-test-data.ts
import { supabase } from "@/lib/supabase";

import { discountRulesFixtures, pricingConfigFixture } from "./fixtures";

async function seedDatabase() {
  // Insert pricing config
  await supabase.from("pricing_config").upsert(pricingConfigFixture);

  // Insert discount rules
  await supabase.from("discount_rules").insert(discountRulesFixtures);

  console.log("Test data seeded successfully");
}
```

## Notes

**Idempotency Keys**: Use `crypto.randomUUID()` for real tests. Fixture UUIDs are for documentation only.

**Turnstile Tokens**: Use Cloudflare's official test tokens for development:

- `1x00000000000000000000AA` - Always passes (happy path testing)
- `2x00000000000000000000AB` - Always fails (error handling testing)
- `3x00000000000000000000AC` - Token already spent (idempotency testing)
  Production requires real tokens from Turnstile widget.

**Payment Proof URLs**: Use placeholder URLs for testing. Production requires valid Supabase Storage signed URLs.

**Date Ranges**: Use future dates to avoid validation errors. Update fixtures periodically.
