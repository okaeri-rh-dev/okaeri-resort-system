# Timezone Handling Guide (Gap Resolution #12)

**Document Version:** 1.0
**Purpose:** Standardize timezone handling across the multi-unit booking system
**Reference:** See `SCHEMA-REFERENCE.md` for database column types

---

## Core Principle

**All timestamps stored as UTC in database, displayed as Asia/Manila in UI**

- ✅ Database: `TIMESTAMPTZ` columns store UTC
- ✅ API: Accept/return ISO 8601 UTC strings
- ✅ UI: Always interpret dates as Asia/Manila timezone
- ✅ Standard times: Check-in 2:00 PM, Check-out 12:00 PM (Manila time)

---

## Implementation

### 1. Utility Functions

**File:** `src/lib/timezone.ts`

```typescript
import { DateTime } from "luxon";

// Constants
export const RESORT_TIMEZONE = "Asia/Manila";
export const CHECK_IN_HOUR = 14; // 2:00 PM
export const CHECK_OUT_HOUR = 12; // 12:00 PM

/**
 * Convert a date (without time) to check-in time in UTC
 * @param date - Date object representing the check-in date
 * @returns ISO 8601 UTC string
 */
export function dateToCheckInUTC(date: Date): string {
  return DateTime.fromObject(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: CHECK_IN_HOUR,
      minute: 0,
      second: 0,
    },
    { zone: RESORT_TIMEZONE }
  )
    .toUTC()
    .toISO()!;
}

/**
 * Convert a date (without time) to check-out time in UTC
 * @param date - Date object representing the check-out date
 * @returns ISO 8601 UTC string
 */
export function dateToCheckOutUTC(date: Date): string {
  return DateTime.fromObject(
    {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: CHECK_OUT_HOUR,
      minute: 0,
      second: 0,
    },
    { zone: RESORT_TIMEZONE }
  )
    .toUTC()
    .toISO()!;
}

/**
 * Convert UTC timestamp to Manila timezone display string
 * @param utcString - ISO 8601 UTC timestamp
 * @returns Formatted date-time string
 */
export function utcToManilaDisplay(utcString: string): string {
  return DateTime.fromISO(utcString).setZone(RESORT_TIMEZONE).toFormat("MMM dd, yyyy h:mm a");
}

/**
 * Convert UTC timestamp to Manila date-only display
 * @param utcString - ISO 8601 UTC timestamp
 * @returns Formatted date string
 */
export function utcToManilaDate(utcString: string): string {
  return DateTime.fromISO(utcString).setZone(RESORT_TIMEZONE).toFormat("MMM dd, yyyy");
}

/**
 * Get current time in Manila timezone
 * @returns DateTime object in Manila timezone
 */
export function nowInManila(): DateTime {
  return DateTime.now().setZone(RESORT_TIMEZONE);
}

/**
 * Check if a date is today (Manila timezone)
 * @param utcString - ISO 8601 UTC timestamp
 * @returns boolean
 */
export function isToday(utcString: string): boolean {
  const manilaDate = DateTime.fromISO(utcString).setZone(RESORT_TIMEZONE);
  const today = nowInManila();
  return manilaDate.hasSame(today, "day");
}
```

---

### 2. Usage Examples

#### A. Booking Form (Client)

```typescript
import { dateToCheckInUTC, dateToCheckOutUTC } from '@/lib/timezone';

function BookingForm() {
  const [checkInDate, setCheckInDate] = useState<Date>(new Date());
  const [checkOutDate, setCheckOutDate] = useState<Date>(new Date());

  async function handleSubmit() {
    // Convert dates to UTC timestamps before sending to API
    const bookingData = {
      check_in: dateToCheckInUTC(checkInDate),
      check_out: dateToCheckOutUTC(checkOutDate),
      // ... other fields
    };

    await fetch('/api/bookings/multi-unit', {
      method: 'POST',
      body: JSON.stringify(bookingData)
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DatePicker
        value={checkInDate}
        onChange={setCheckInDate}
        label="Check-in Date"
        helperText="Check-in time: 2:00 PM"
      />
      <DatePicker
        value={checkOutDate}
        onChange={setCheckOutDate}
        label="Check-out Date"
        helperText="Check-out time: 12:00 PM"
      />
    </form>
  );
}
```

---

#### B. Display Booking Details (Client)

```typescript
import { utcToManilaDisplay, utcToManilaDate } from '@/lib/timezone';

function BookingDetail({ booking }: { booking: Booking }) {
  return (
    <div>
      <h2>Booking {booking.booking_reference}</h2>

      {/* Display with time */}
      <p>Check-in: {utcToManilaDisplay(booking.check_in)}</p>
      {/* Output: "Mar 15, 2025 2:00 PM" */}

      <p>Check-out: {utcToManilaDisplay(booking.check_out)}</p>
      {/* Output: "Mar 18, 2025 12:00 PM" */}

      {/* Display date only */}
      <p>Dates: {utcToManilaDate(booking.check_in)} - {utcToManilaDate(booking.check_out)}</p>
      {/* Output: "Mar 15, 2025 - Mar 18, 2025" */}
    </div>
  );
}
```

---

#### C. Database Query (Server)

```typescript
import { dateToCheckInUTC, dateToCheckOutUTC } from "@/lib/timezone";

// Store UTC timestamps in database
const { data, error } = await supabase.from("bookings").insert({
  check_in: "2025-03-15T06:00:00.000Z", // UTC (2:00 PM Manila)
  check_out: "2025-03-18T04:00:00.000Z", // UTC (12:00 PM Manila)
});

// Database stores as UTC, PostgreSQL handles timezone conversion
```

---

### 3. Testing Edge Cases

```typescript
// tests/timezone.test.ts
import { describe, expect, test } from "vitest";

import { dateToCheckInUTC, dateToCheckOutUTC, utcToManilaDisplay } from "@/lib/timezone";

describe("Timezone Handling", () => {
  test("dateToCheckInUTC converts to correct UTC time", () => {
    const date = new Date("2025-03-15"); // Local midnight
    const utc = dateToCheckInUTC(date);

    // Expected: 2:00 PM Manila = 6:00 AM UTC (UTC+8)
    expect(utc).toBe("2025-03-15T06:00:00.000Z");
  });

  test("dateToCheckOutUTC converts to correct UTC time", () => {
    const date = new Date("2025-03-18");
    const utc = dateToCheckOutUTC(date);

    // Expected: 12:00 PM Manila = 4:00 AM UTC
    expect(utc).toBe("2025-03-18T04:00:00.000Z");
  });

  test("utcToManilaDisplay shows Manila time correctly", () => {
    const utc = "2025-03-15T06:00:00.000Z";
    const display = utcToManilaDisplay(utc);

    expect(display).toBe("Mar 15, 2025 2:00 PM");
  });

  test("handles DST boundaries (Philippines has no DST)", () => {
    // Philippines doesn't observe DST, so conversions are consistent year-round
    const winterDate = new Date("2025-01-15");
    const summerDate = new Date("2025-07-15");

    const winterUTC = dateToCheckInUTC(winterDate);
    const summerUTC = dateToCheckInUTC(summerDate);

    // Both should have same UTC offset (+8 hours)
    expect(winterUTC).toMatch(/T06:00:00\.000Z$/);
    expect(summerUTC).toMatch(/T06:00:00\.000Z$/);
  });

  test("handles date boundaries correctly", () => {
    // Check-in at 11:59 PM one day should not overlap with
    // check-out at 12:01 AM next day
    const date1 = new Date("2025-03-15");
    const date2 = new Date("2025-03-16");

    const checkIn = dateToCheckInUTC(date1); // Mar 15, 2:00 PM
    const checkOut = dateToCheckOutUTC(date2); // Mar 16, 12:00 PM

    const checkInTime = new Date(checkIn).getTime();
    const checkOutTime = new Date(checkOut).getTime();

    // 22 hours apart (2:00 PM to 12:00 PM next day)
    const hoursDiff = (checkOutTime - checkInTime) / (1000 * 60 * 60);
    expect(hoursDiff).toBe(22);
  });
});
```

---

### 4. Common Pitfalls & Solutions

#### ❌ WRONG: Using Date.now() or new Date()

```typescript
// BAD: Creates date in user's local timezone
const checkIn = new Date().toISOString();
// Could be any timezone depending on user's system
```

#### ✅ CORRECT: Always use timezone utilities

```typescript
// GOOD: Explicitly converts to Manila timezone then to UTC
const checkIn = dateToCheckInUTC(new Date("2025-03-15"));
```

---

#### ❌ WRONG: Displaying UTC time directly

```typescript
// BAD: Shows UTC time to users
<span>{booking.check_in}</span>
// Output: "2025-03-15T06:00:00.000Z" (confusing!)
```

#### ✅ CORRECT: Convert to Manila timezone for display

```typescript
// GOOD: Shows Manila time to users
<span>{utcToManilaDisplay(booking.check_in)}</span>
// Output: "Mar 15, 2025 2:00 PM"
```

---

#### ❌ WRONG: Comparing timestamps across timezones

```typescript
// BAD: Direct string comparison
if (booking.check_in === "2025-03-15") {
  // This will never match! check_in is a full timestamp
}
```

#### ✅ CORRECT: Convert to same timezone before comparing

```typescript
// GOOD: Extract date in Manila timezone
const checkInDate = DateTime.fromISO(booking.check_in)
  .setZone(RESORT_TIMEZONE)
  .toFormat("yyyy-MM-dd");

if (checkInDate === "2025-03-15") {
  // This works correctly
}
```

---

### 5. Database Migration Considerations

**From DATE to TIMESTAMPTZ:**

```sql
-- Before migration (current)
check_in DATE NOT NULL;         -- No time, no timezone

-- After migration (multi-unit)
check_in TIMESTAMPTZ NOT NULL;  -- With time, timezone-aware

-- Migration script
UPDATE bookings
SET check_in = (check_in::date + TIME '14:00:00') AT TIME ZONE 'Asia/Manila';
-- Adds 2:00 PM Manila time to all existing dates

UPDATE bookings
SET check_out = (check_out::date + TIME '12:00:00') AT TIME ZONE 'Asia/Manila';
-- Adds 12:00 PM Manila time to all existing dates
```

---

### 6. API Contract

**Request (from client):**

```json
{
  "check_in": "2025-03-15T06:00:00.000Z",
  "check_out": "2025-03-18T04:00:00.000Z"
}
```

**Response (to client):**

```json
{
  "check_in": "2025-03-15T06:00:00.000Z",
  "check_out": "2025-03-18T04:00:00.000Z"
}
```

**Client responsibility:**

- Convert user-selected dates to UTC before sending
- Convert received UTC timestamps to Manila for display

**Server responsibility:**

- Store as UTC in database
- Return UTC in API responses
- Use UTC for all availability calculations

---

### 7. Quick Reference

| Operation              | Function                  | Example                      |
| ---------------------- | ------------------------- | ---------------------------- |
| Date → UTC (check-in)  | `dateToCheckInUTC(date)`  | `'2025-03-15T06:00:00.000Z'` |
| Date → UTC (check-out) | `dateToCheckOutUTC(date)` | `'2025-03-18T04:00:00.000Z'` |
| UTC → Display          | `utcToManilaDisplay(utc)` | `'Mar 15, 2025 2:00 PM'`     |
| UTC → Date only        | `utcToManilaDate(utc)`    | `'Mar 15, 2025'`             |
| Current Manila time    | `nowInManila()`           | DateTime object              |
| Check if today         | `isToday(utc)`            | `true`/`false`               |

---

## Validation Checklist

- [ ] All database `check_in`/`check_out` columns are `TIMESTAMPTZ`
- [ ] All API requests/responses use ISO 8601 UTC format
- [ ] All UI displays use Manila timezone conversion
- [ ] Tests cover DST edge cases (even though Philippines doesn't have DST)
- [ ] Migration script converts existing DATE values correctly
- [ ] Availability calculations use UTC timestamps
- [ ] No direct Date() usage without timezone context

---

**END OF TIMEZONE HANDLING GUIDE**

**Remember:** When in doubt, store UTC, display Manila. Never mix timezones in calculations.
