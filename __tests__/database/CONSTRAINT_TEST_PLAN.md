# Database Constraint Tests Refactoring Plan

## Problem Statement

8 database constraint tests in `__tests__/database/constraints.test.ts` fail because they attempt to insert into `booking_units` table with hardcoded `booking_id` values without creating parent `bookings` records first.

### Error Examples

```
NetworkError: Failed to execute "fetch()" on "Window" with URL "https://test.supabase.co/rest/v1/booking_units": getaddrinfo ENOTFOUND test.supabase.co
```

Additionally, even if Supabase connection works, foreign key constraints would fail:

```
ERROR: insert or update on table "booking_units" violates foreign key constraint "booking_units_booking_id_fkey"
DETAIL: Key (booking_id)=(booking-overlap-1) is not present in table "bookings"
```

## Root Cause Analysis

### Schema Change

The unified multi-unit architecture migration (`20251017_unified_multi_unit.sql`) removed the direct `unit_id` column from `bookings` table and enforced ALL bookings to use the `booking_units` junction table.

### Test Design Issue

Current tests follow this pattern:

```typescript
// ❌ BAD - No parent booking record
const { error } = await supabase.from("booking_units").insert({
  booking_id: "booking-overlap-1", // Hardcoded ID that doesn't exist
  unit_id: unitId,
  check_in_date: dates.check_in,
  check_out_date: dates.check_out,
  status: "confirmed",
});
```

This fails because:

1. No `bookings` record with ID `"booking-overlap-1"` exists
2. Foreign key constraint `booking_units_booking_id_fkey` is violated
3. Tests assume they can create booking_units in isolation

## Failed Tests Breakdown

| Test                                                  | Issue                  | Constraint Being Tested     |
| ----------------------------------------------------- | ---------------------- | --------------------------- |
| prevents unit assignment without payment verification | Missing parent booking | `payment_before_assignment` |
| allows unit assignment after payment verification     | Missing parent booking | `payment_before_assignment` |
| prevents partial unit assignment                      | Missing parent booking | `all_or_nothing_assignment` |
| allows complete unit assignment                       | Missing parent booking | `all_or_nothing_assignment` |
| prevents overlapping bookings for same unit           | Missing parent booking | `no_double_booking` EXCLUDE |
| allows consecutive bookings for same unit             | Missing parent booking | `no_double_booking` EXCLUDE |
| prevents zero guests per unit                         | Missing parent booking | `guests_per_unit > 0` CHECK |
| prevents negative guests per unit                     | Missing parent booking | `guests_per_unit > 0` CHECK |

## Solution: Test Helper Functions

### Helper 1: Create Test Booking

```typescript
/**
 * Create a valid parent booking for testing constraints
 * Returns booking_id for use in booking_units inserts
 */
async function createTestBooking(
  supabase: SupabaseClient,
  overrides?: Partial<BookingInsert>
): Promise<string> {
  const { data: booking, error } = await supabase
    .from("bookings")
    .insert({
      guest_name: "Test Guest",
      email: "test@example.com",
      phone_number: "+639171234567",
      check_in_date: "2025-03-01",
      check_out_date: "2025-03-05",
      payment_status: "Pending",
      unit_assignment_status: "pending",
      is_multi_unit: true,
      requested_unit_count: 1,
      ...overrides,
    })
    .select("booking_id")
    .single();

  if (error) {
    throw new Error(`Failed to create test booking: ${error.message}`);
  }

  return booking.booking_id;
}
```

### Helper 2: Create Booking with Units

```typescript
/**
 * Create a complete booking with booking_units for testing
 */
async function createBookingWithUnits(
  supabase: SupabaseClient,
  bookingOverrides?: Partial<BookingInsert>,
  units?: Array<Partial<BookingUnitInsert>>
): Promise<{ booking_id: string; unit_ids: string[] }> {
  const booking_id = await createTestBooking(supabase, bookingOverrides);

  if (units && units.length > 0) {
    const { error } = await supabase.from("booking_units").insert(
      units.map((unit) => ({
        booking_id,
        unit_id: unit.unit_id || crypto.randomUUID(),
        check_in_date: bookingOverrides?.check_in_date || "2025-03-01",
        check_out_date: bookingOverrides?.check_out_date || "2025-03-05",
        status: "confirmed",
        ...unit,
      }))
    );

    if (error) {
      throw new Error(`Failed to create booking units: ${error.message}`);
    }
  }

  return {
    booking_id,
    unit_ids: units?.map((u) => u.unit_id || crypto.randomUUID()) || [],
  };
}
```

### Helper 3: Cleanup Test Data

```typescript
/**
 * Clean up test bookings and their related data
 * Cascades to booking_units due to foreign key ON DELETE CASCADE
 */
async function cleanupTestBookings(supabase: SupabaseClient, booking_ids: string[]): Promise<void> {
  if (booking_ids.length === 0) return;

  const { error } = await supabase.from("bookings").delete().in("booking_id", booking_ids);

  if (error) {
    console.warn(`Failed to cleanup test bookings: ${error.message}`);
  }
}
```

## Updated Test Patterns

### Pattern 1: Simple Constraint Test

```typescript
test("prevents overlapping bookings for same unit", async () => {
  const unitId = crypto.randomUUID();
  const dates = {
    check_in: "2025-04-01",
    check_out: "2025-04-05",
  };

  // ✅ GOOD - Create parent booking first
  const booking1_id = await createTestBooking(supabase, {
    check_in_date: dates.check_in,
    check_out_date: dates.check_out,
  });

  // First booking unit
  const { error: error1 } = await supabase.from("booking_units").insert({
    booking_id: booking1_id,
    unit_id: unitId,
    check_in_date: dates.check_in,
    check_out_date: dates.check_out,
    status: "confirmed",
  });

  expect(error1).toBeNull();

  // Create second parent booking
  const booking2_id = await createTestBooking(supabase, {
    check_in_date: "2025-04-03",
    check_out_date: "2025-04-07",
  });

  // Second booking unit (overlapping dates)
  const { error: error2 } = await supabase.from("booking_units").insert({
    booking_id: booking2_id,
    unit_id: unitId,
    check_in_date: "2025-04-03", // Overlaps with first booking
    check_out_date: "2025-04-07",
    status: "confirmed",
  });

  // Should fail with EXCLUDE constraint violation
  expect(error2).toBeDefined();
  expect(error2?.code).toBe("23P01"); // PostgreSQL EXCLUDE constraint
  expect(error2?.message).toContain("no_double_booking");

  // Cleanup
  await cleanupTestBookings(supabase, [booking1_id, booking2_id]);
});
```

### Pattern 2: Multi-Unit Constraint Test

```typescript
test("prevents partial unit assignment", async () => {
  const { booking_id } = await createBookingWithUnits(
    supabase,
    {
      payment_status: "Verified",
      is_multi_unit: true,
      requested_unit_count: 3,
      unit_assignment_status: "pending",
    },
    // Create 2 units (partial - should have 3)
    [{ unit_id: crypto.randomUUID() }, { unit_id: crypto.randomUUID() }]
  );

  // Attempt to mark as assigned (should fail - only 2/3 units assigned)
  const { error } = await supabase
    .from("bookings")
    .update({ unit_assignment_status: "assigned" })
    .eq("booking_id", booking_id);

  expect(error).toBeDefined();
  expect(error?.code).toBe("23514"); // CHECK constraint violation
  expect(error?.message).toContain("all_or_nothing_assignment");

  // Cleanup
  await cleanupTestBookings(supabase, [booking_id]);
});
```

## Implementation Checklist

### Step 1: Create Test Helpers

- [ ] Create `__tests__/database/helpers.ts`
- [ ] Implement `createTestBooking()`
- [ ] Implement `createBookingWithUnits()`
- [ ] Implement `cleanupTestBookings()`
- [ ] Add TypeScript types for helper parameters

### Step 2: Update Constraint Tests

- [ ] Update `payment_before_assignment` tests (2 tests)
- [ ] Update `all_or_nothing_assignment` tests (2 tests)
- [ ] Update `no_double_booking` EXCLUDE tests (2 tests)
- [ ] Update `guests_per_unit` CHECK tests (2 tests)

### Step 3: Environment Configuration

- [ ] Ensure `.env.test` has correct Supabase credentials
- [ ] Verify local Supabase is running on port 54321
- [ ] Check foreign key constraints are enabled
- [ ] Verify CASCADE delete is configured on booking_units

### Step 4: Cleanup Logic

- [ ] Add `afterEach` hook to call `cleanupTestBookings()`
- [ ] Track all created booking_ids in test array
- [ ] Handle cleanup failures gracefully

## Expected Outcomes

**Before**:

- 8 tests failing due to foreign key violations
- Tests can't reach database (test.supabase.co)

**After**:

- 8 tests passing with proper parent booking setup
- Clean test data isolation (each test creates its own bookings)
- Proper cleanup prevents test pollution
- Tests validate actual database constraints

## Testing the Fix

```bash
# Run only database constraint tests
npx vitest run __tests__/database/constraints.test.ts

# Expected result: 8/8 tests passing
```

## Additional Improvements

### Future Enhancements

1. **Transaction Support**: Wrap each test in a database transaction and rollback
2. **Factory Pattern**: Use a test data factory for creating realistic bookings
3. **Shared Fixtures**: Create reusable test fixtures for common booking scenarios
4. **Parallel Testing**: Ensure tests don't conflict when run in parallel

### Example Factory Pattern

```typescript
class BookingFactory {
  static create(overrides?: Partial<BookingInsert>) {
    return {
      guest_name: faker.person.fullName(),
      email: faker.internet.email(),
      phone_number: faker.phone.number("+639#########"),
      check_in_date: faker.date.future(),
      check_out_date: faker.date.future(),
      // ... defaults
      ...overrides,
    };
  }
}
```

## Related Documentation

- Database schema: `supabase/migrations/20251017_unified_multi_unit.sql`
- Booking types: `src/types/multi-unit-booking.ts`
- Integration tests: `__tests__/integration/booking-api.test.ts`

---

**Last Updated**: 2025-10-29
**Status**: ⚠️ Blocking 8 tests
**Estimated Fix Time**: 2-3 hours
