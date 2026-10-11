# Booking module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One write path per booking operation in `src/lib/bookings/`, with every stay stored as the Manila check-in day at 14:00 and the Manila check-out day at 12:00, and the admin "New booking" dialog creating through the server (price, availability check, availability row).

**Architecture:** `stay.ts` turns Manila days (`YYYY-MM-DD`) into stored instants. It is the only place that knows the times. The module's operations take a Supabase client (`createBooking` runs in the Worker with the service-role client; update/cancel/status run in the browser). React Query hooks are thin adapters. One migration normalizes existing rows, backfills missing `booking_unit_availability` rows, stores `payment_method` from the create RPC, and makes the availability RPC report "booked until".

**Tech Stack:** TypeScript, React 19, TanStack Query, Zustand, Cloudflare Pages Functions, Supabase Postgres (plpgsql), Vitest (DB tests against local Supabase), date-fns 3 / date-fns-tz 3.

**Parent plan:** `docs/plans/2026-10-10-architecture-deepening.md` (Candidate 1, booking entity). Design decisions: its "Booking entity grilling, round 1-4" blocks and ADR 0002.

## Global Constraints

- Check-in 14:00, check-out 12:00 Manila (`RESORT_OPERATION_HOURS`); check-out time < check-in time; both ≥ 08:00.
- The module's interface takes Manila day strings `YYYY-MM-DD`; only `src/lib/bookings/stay.ts` turns them into instants.
- `src/lib/bookings/create.ts`, `stay.ts` and `operations.ts` must not import the browser Supabase client (`@/lib/supabase`): the Worker imports them. Browser-only code goes in `src/lib/bookings/request.ts`, which is not re-exported from the index.
- Writes use `satisfies TablesInsert<…>` / `TablesUpdate<…>`; updates that must touch a row use `.select().single()`.
- Unit tests of date code run under `TZ=America/Los_Angeles` (set at the top of the test file plus a guard assertion).
- DB tests: `@vitest-environment node`, `shouldRunDatabaseTests()` guard, `cleanupTestData({ includeTestFixtures: true })` before and after.
- No prod writes by the agent. The user runs `supabase db push` and the manual deploy; the agent only runs read-only `supabase db query --linked`.
- Commits: Conventional Commits, no Co-Authored-By line. Run `npm run verify` before each commit.

## File map

| File                                                                   | Responsibility                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/config/settings.ts`                                               | `RESORT_OPERATION_HOURS` 14:00 / 12:00                                                  |
| `src/lib/bookings/stay.ts` (new)                                       | Manila day type, day → instant, picked day, night count, day ranges                     |
| `src/lib/bookings/create.ts` (new)                                     | `createBooking(client, NewBooking)`: guest find-or-create + `create_multi_unit_booking` |
| `src/lib/bookings/operations.ts` (new)                                 | `updateBooking`, `cancelBooking`, `setBookingStatus`, `canTransitionStatus`             |
| `src/lib/bookings/request.ts` (new)                                    | Browser: `requestBooking` → `POST /api/bookings/multi-unit`                             |
| `src/lib/bookings/index.ts` (new)                                      | Re-exports stay, create, operations                                                     |
| `supabase/migrations/20261011120000_normalize_booking_stays.sql` (new) | Normalize + backfill function, RPC changes, local drift fix                             |
| `functions/api/bookings/multi-unit.ts`                                 | Accepts Manila days, prices on stored instants, creates via the module                  |
| `functions/api/availability/multi-unit.ts`                             | Accepts Manila days                                                                     |
| `src/hooks/useMultiUnitBookingQueries.ts`                              | Typed availability results; create via `requestBooking`                                 |
| `src/stores/useBookingStore.ts`                                        | Hooks become adapters; hard delete removed; date filter on Manila days                  |
| `src/components/bookings/BookingForm.tsx`                              | Dialog: create via route, automatic availability, no edit mode                          |
| `src/components/bookings/MultiUnitBookingForm.tsx`                     | Sends Manila days                                                                       |
| `src/components/bookings/BookingEdit/*`                                | Saves via `updateBooking`                                                               |
| `src/hooks/entity/useEntityEdit.ts`                                    | Loses its booking branch (unit, guest and expense still use it)                         |
| `src/components/bookings/BookingsTable/*`                              | Cancel with confirmation; Delete removed; filter days                                   |
| `src/stores/useMultiUnitBookingStore.ts`                               | Night count from Manila days                                                            |
| `src/components/booking-confirmation/BookingSummaryCard.tsx`           | Manila day + configured time                                                            |

---

### Task 1: Stay convention core

**Files:**

- Modify: `src/config/settings.ts:62-67`
- Create: `src/lib/bookings/stay.ts`
- Create: `src/lib/bookings/index.ts`
- Test: `src/lib/bookings/__tests__/stay.test.ts`
- Modify: `src/components/bookings/BookingEdit/__tests__/to-booking-update.test.ts:24-25`

**Interfaces:**

- Produces: `type ManilaDay = string`; `isManilaDay(value: string): boolean`; `toStayInstants(checkInDay: ManilaDay, checkOutDay: ManilaDay): { check_in: string; check_out: string }` (ISO UTC); `pickedDay(date: Date): ManilaDay`; `manilaDayOf(instant: string | Date): ManilaDay`; `nightsBetween(checkInDay: ManilaDay, checkOutDay: ManilaDay): number`; `manilaDayStart(day: ManilaDay): string`; `dayAfter(day: ManilaDay): ManilaDay`.

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { RESORT_OPERATION_HOURS } from "@/config/settings";
import {
  dayAfter,
  manilaDayOf,
  manilaDayStart,
  nightsBetween,
  pickedDay,
  toStayInstants,
} from "@/lib/bookings";

// src/lib/bookings/__tests__/stay.test.ts
process.env.TZ = "America/Los_Angeles";

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

describe("stay convention", () => {
  it("runs outside Manila so browser-local mistakes show", () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(480);
  });

  it("stores the check-in day at 14:00 and the check-out day at 12:00 Manila", () => {
    expect(toStayInstants("2026-10-15", "2026-10-17")).toEqual({
      check_in: "2026-10-15T06:00:00.000Z",
      check_out: "2026-10-17T04:00:00.000Z",
    });
  });

  it("rejects a check-out day on or before the check-in day", () => {
    expect(() => toStayInstants("2026-10-15", "2026-10-15")).toThrow(/after the check-in day/);
  });

  it("rejects anything that is not a YYYY-MM-DD day", () => {
    expect(() => toStayInstants("2026-10-15T00:00:00Z", "2026-10-17")).toThrow(/YYYY-MM-DD/);
  });

  it("reads the day the person picked, not the instant", () => {
    expect(pickedDay(new Date(2026, 9, 15))).toBe("2026-10-15");
  });

  it("reads the Manila day of a stored instant", () => {
    expect(manilaDayOf("2026-10-14T16:00:00.000Z")).toBe("2026-10-15");
    expect(manilaDayOf("2026-10-17T04:00:00.000Z")).toBe("2026-10-17");
  });

  it("counts nights as calendar days across a DST change", () => {
    expect(nightsBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("gives the first instant of a Manila day and the next day", () => {
    expect(manilaDayStart("2026-10-15")).toBe("2026-10-14T16:00:00.000Z");
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
  });
});

describe("RESORT_OPERATION_HOURS", () => {
  const checkIn = minutesOf(RESORT_OPERATION_HOURS.checkInTime);
  const checkOut = minutesOf(RESORT_OPERATION_HOURS.checkOutTime);

  it("has check-out before check-in so same-day turnover does not overlap", () => {
    expect(checkOut).toBeLessThan(checkIn);
  });

  it("keeps both times at 08:00 Manila or later so the UTC date is the Manila date", () => {
    expect(checkOut).toBeGreaterThanOrEqual(8 * 60);
    expect(checkIn).toBeGreaterThanOrEqual(8 * 60);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/bookings`
Expected: FAIL, `Failed to resolve import "@/lib/bookings"`.

- [x] **Step 3: Implement**

`src/config/settings.ts`:

```ts
export const RESORT_OPERATION_HOURS = {
  checkInTime: "14:00", // 2:00 PM
  checkOutTime: "12:00", // 12:00 PM
  officeOpenTime: "08:00", // 8:00 AM
  officeCloseTime: "20:00", // 8:00 PM
};
```

```ts
// src/lib/bookings/stay.ts
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

import { RESORT_OPERATION_HOURS, RESORT_TIMEZONE } from "@/config/settings";

// Stays are stored as a Manila day plus a fixed time (docs/adr/0002).

/** A Manila calendar day, `YYYY-MM-DD`. */
export type ManilaDay = string;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isManilaDay = (value: string): value is ManilaDay =>
  DAY_PATTERN.test(value) && !Number.isNaN(parseISO(value).getTime());

const atManilaTime = (day: ManilaDay, time: string) =>
  fromZonedTime(`${day}T${time}:00`, RESORT_TIMEZONE).toISOString();

export function toStayInstants(checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  if (!isManilaDay(checkInDay) || !isManilaDay(checkOutDay)) {
    throw new Error("Stay days must be YYYY-MM-DD");
  }
  if (checkOutDay <= checkInDay) {
    throw new Error("The check-out day must be after the check-in day");
  }
  return {
    check_in: atManilaTime(checkInDay, RESORT_OPERATION_HOURS.checkInTime),
    check_out: atManilaTime(checkOutDay, RESORT_OPERATION_HOURS.checkOutTime),
  };
}

/** The day shown in a date picker, whose Date is local midnight of that day. */
export const pickedDay = (date: Date): ManilaDay => format(date, "yyyy-MM-dd");

export const manilaDayOf = (instant: string | Date): ManilaDay =>
  formatInTimeZone(new Date(instant), RESORT_TIMEZONE, "yyyy-MM-dd");

export const nightsBetween = (checkInDay: ManilaDay, checkOutDay: ManilaDay) =>
  differenceInCalendarDays(parseISO(checkOutDay), parseISO(checkInDay));

export const manilaDayStart = (day: ManilaDay) => atManilaTime(day, "00:00");

export const dayAfter = (day: ManilaDay): ManilaDay =>
  format(addDays(parseISO(day), 1), "yyyy-MM-dd");
```

```ts
// src/lib/bookings/index.ts
export * from "./stay";
```

In `to-booking-update.test.ts` lines 24-25 the new times give:

```ts
expect(update.check_in).toBe("2026-10-15T06:00:00.000Z");
expect(update.check_out).toBe("2026-10-17T04:00:00.000Z");
```

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/bookings src/components/bookings/BookingEdit`
Expected: PASS (all of `stay.test.ts`, `to-booking-update.test.ts`).

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/config/settings.ts src/lib/bookings src/components/bookings/BookingEdit/__tests__/to-booking-update.test.ts
git commit -m "feat: add the Manila-day stay convention at 14:00/12:00"
```

---

### Task 2: Migration: normalize stays, backfill availability, RPC fixes

**Files:**

- Create: `supabase/migrations/20261011120000_normalize_booking_stays.sql`
- Test: `src/__tests__/database/booking-stays.test.ts`
- Modify: `src/__tests__/database/multi-unit-booking.test.ts:326` (un-skip the Pending overlap test)
- Modify: `CLAUDE.md:30` (delete the "intentionally skipped" line)
- Modify: `src/types/database.generated.ts` (regenerated)

**Interfaces:**

- Produces: SQL `public.normalize_booking_stays(p_check_in_time time = '14:00', p_check_out_time time = '12:00') RETURNS TABLE(normalized_bookings integer, backfilled_availability integer)`, service_role only; `create_multi_unit_booking` stores `p_booking_data->>'payment_method'`; `check_multi_unit_availability.next_available_date` = latest check-out among the conflicting stays ("booked until"), NULL when available.

- [x] **Step 1: Write the failing DB tests**

```ts
// src/__tests__/database/booking-stays.test.ts
/**
 * Stay normalization, availability backfill and the create/availability RPCs.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestBooking,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const iso = (value: string) => new Date(value).toISOString();

async function stayOf(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("check_in, check_out, booking_unit_availability(check_in, check_out, booking_status)")
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data;
}

describe("normalize_booking_stays", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  afterAll(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("moves a midnight stay to the Manila day at 14:00 / 12:00, availability included", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({
      check_in: new Date("2026-12-19T16:00:00Z"), // Manila midnight, Dec 20
      check_out: new Date("2026-12-22T03:00:00Z"), // 11:00 Manila, Dec 22
    });

    const { error } = await supabase.rpc("normalize_booking_stays");
    expect(error).toBeNull();

    const stay = await stayOf(booking.booking_id);
    expect(iso(stay.check_in)).toBe("2026-12-20T06:00:00.000Z");
    expect(iso(stay.check_out)).toBe("2026-12-22T04:00:00.000Z");
    expect(iso(stay.booking_unit_availability[0].check_in)).toBe("2026-12-20T06:00:00.000Z");
    expect(iso(stay.booking_unit_availability[0].check_out)).toBe("2026-12-22T04:00:00.000Z");
  });

  it("changes nothing on a second run", async () => {
    if (!shouldRun) return;
    await createTestBooking({ check_in: new Date("2026-12-19T16:00:00Z") });
    await supabase.rpc("normalize_booking_stays");

    const { data, error } = await supabase.rpc("normalize_booking_stays");
    expect(error).toBeNull();
    expect(data).toEqual([{ normalized_bookings: 0, backfilled_availability: 0 }]);
  });

  it("backfills a missing availability row with the booking's status", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "Confirmed" });
    await supabase.from("booking_unit_availability").delete().eq("booking_id", booking.booking_id);

    await supabase.rpc("normalize_booking_stays");

    const stay = await stayOf(booking.booking_id);
    expect(stay.booking_unit_availability).toHaveLength(1);
    expect(stay.booking_unit_availability[0].booking_status).toBe("Confirmed");
  });

  it("refuses to run while two Confirmed bookings overlap on a unit", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const checkIn = new Date("2026-12-20T06:00:00Z");
    const checkOut = new Date("2026-12-22T04:00:00Z");
    await createTestBooking({ unit, check_in: checkIn, check_out: checkOut });
    const second = await createTestBooking({
      unit,
      check_in: checkIn,
      check_out: checkOut,
      booking_status: "Pending",
    });
    // Confirm the second booking without an availability row, as old dialog bookings were
    await supabase.from("booking_unit_availability").delete().eq("booking_id", second.booking_id);
    await supabase
      .from("bookings")
      .update({ booking_status: "Confirmed" })
      .eq("booking_id", second.booking_id);

    const { error } = await supabase.rpc("normalize_booking_stays");
    expect(error?.message).toMatch(/Confirmed bookings overlap/);
  });
});

describe("create_multi_unit_booking and check_multi_unit_availability", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("stores the payment method", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const { data: bookingId, error } = await supabase.rpc("create_multi_unit_booking", {
      p_booking_data: {
        booking_reference: `TB-PM-${Date.now()}`,
        guest_name: "Payment Method Guest",
        num_guests: 2,
        check_in: "2026-12-20T06:00:00Z",
        check_out: "2026-12-22T04:00:00Z",
        payment_method: "GCash",
      },
      p_units: [
        {
          unit_id: unit.unit_id,
          unit_price: 5000,
          subtotal: 5000,
          assigned_guests: 2,
        },
      ],
    });
    expect(error).toBeNull();

    const { data } = await supabase
      .from("bookings")
      .select("payment_method")
      .eq("booking_id", bookingId!)
      .single();
    expect(data?.payment_method).toBe("GCash");
  });

  it("reports the day a booked unit frees up", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    await createTestBooking({
      unit,
      check_in: new Date("2026-12-20T06:00:00Z"),
      check_out: new Date("2026-12-23T04:00:00Z"),
    });

    const { data, error } = await supabase.rpc("check_multi_unit_availability", {
      p_unit_ids: [unit.unit_id],
      p_check_in: "2026-12-21T06:00:00Z",
      p_check_out: "2026-12-22T04:00:00Z",
    });
    expect(error).toBeNull();
    expect(data?.[0].is_available).toBe(false);
    expect(iso(data![0].next_available_date!)).toBe("2026-12-23T04:00:00.000Z");
  });
});
```

In `multi-unit-booking.test.ts` change `it.skip("should allow Pending bookings to overlap (aggressive blocking)"` to `it(` and delete the 3-line `NOTE: Skipped` comment above it.

- [x] **Step 2: Run to verify it fails**

Run: `supabase status -o env >/dev/null && npx vitest run src/__tests__/database/booking-stays.test.ts src/__tests__/database/multi-unit-booking.test.ts`
Expected: FAIL: `normalize_booking_stays` not found; `payment_method` null; `next_available_date` null; the Pending overlap test fails with `booking_units_no_double_booking`.

- [x] **Step 3: Write the migration**

```sql
-- supabase/migrations/20261011120000_normalize_booking_stays.sql
-- Stays: Manila check-in day at 14:00, check-out day at 12:00 (docs/adr/0002).
-- 1. booking_units_no_double_booking exists only on local databases (prod drift #2,
--    migration 20251028154441): booking_units rows have NULL dates, so it blocks any
--    second booking of a unit. booking_unit_availability is the overlap guard.
-- 2. create_multi_unit_booking stores payment_method.
-- 3. check_multi_unit_availability.next_available_date = when the conflicting stays end.
-- 4. normalize_booking_stays(): normalize stay times, sync and backfill availability rows.

BEGIN;

ALTER TABLE public.booking_units DROP CONSTRAINT IF EXISTS booking_units_no_double_booking;

CREATE OR REPLACE FUNCTION public.create_multi_unit_booking(
    p_booking_data JSONB,
    p_units JSONB[],
    p_guest_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_booking_id UUID;
    v_unit JSONB;
    v_total_amount DECIMAL(10,2) := 0;
BEGIN
    FOREACH v_unit IN ARRAY p_units
    LOOP
        v_total_amount := v_total_amount + (v_unit->>'subtotal')::DECIMAL;
    END LOOP;

    INSERT INTO public.bookings (
        booking_reference, guest_id, guest_name, contact_number, email, num_guests,
        check_in, check_out, total_amount, is_multi_unit, unit_count,
        booking_status, payment_status, payment_method,
        special_requests, internal_notes, is_walk_in
    ) VALUES (
        COALESCE(p_booking_data->>'booking_reference', public.generate_booking_reference()),
        p_guest_id,
        p_booking_data->>'guest_name',
        p_booking_data->>'contact_number',
        p_booking_data->>'email',
        (p_booking_data->>'num_guests')::INTEGER,
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
        v_total_amount,
        array_length(p_units, 1) > 1,
        array_length(p_units, 1),
        COALESCE(p_booking_data->>'booking_status', 'Pending'),
        COALESCE(p_booking_data->>'payment_status', 'Pending'),
        p_booking_data->>'payment_method',
        p_booking_data->>'special_requests',
        p_booking_data->>'internal_notes',
        COALESCE((p_booking_data->>'is_walk_in')::BOOLEAN, false)
    ) RETURNING booking_id INTO v_booking_id;

    FOREACH v_unit IN ARRAY p_units
    LOOP
        INSERT INTO public.booking_units (
            booking_id, unit_id, unit_price, weekend_surcharge, extra_person_charge,
            subtotal, assigned_guests, unit_notes
        ) VALUES (
            v_booking_id,
            (v_unit->>'unit_id')::UUID,
            (v_unit->>'unit_price')::DECIMAL,
            COALESCE((v_unit->>'weekend_surcharge')::DECIMAL, 0),
            COALESCE((v_unit->>'extra_person_charge')::DECIMAL, 0),
            (v_unit->>'subtotal')::DECIMAL,
            (v_unit->>'assigned_guests')::INTEGER,
            v_unit->>'unit_notes'
        );

        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        ) VALUES (
            (v_unit->>'unit_id')::UUID,
            v_booking_id,
            (p_booking_data->>'check_in')::TIMESTAMPTZ,
            (p_booking_data->>'check_out')::TIMESTAMPTZ,
            COALESCE(p_booking_data->>'booking_status', 'Pending')
        );
    END LOOP;

    RETURN v_booking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.check_multi_unit_availability(
    p_unit_ids UUID[],
    p_check_in TIMESTAMPTZ,
    p_check_out TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
) RETURNS TABLE(
    unit_id UUID,
    is_available BOOLEAN,
    conflicting_bookings INTEGER,
    next_available_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.unit_id,
        COUNT(bua.availability_id) = 0,
        COUNT(bua.availability_id)::INTEGER,
        MAX(bua.check_out)
    FROM public.units u
    LEFT JOIN public.booking_unit_availability bua
      ON bua.unit_id = u.unit_id
     AND bua.booking_status IN ('Confirmed', 'CheckedIn')
     AND tstzrange(bua.check_in, bua.check_out, '[)') && tstzrange(p_check_in, p_check_out, '[)')
     AND (p_exclude_booking_id IS NULL OR bua.booking_id != p_exclude_booking_id)
    WHERE u.unit_id = ANY(p_unit_ids)
      AND u.unit_status = 'Available'
    GROUP BY u.unit_id;
END;
$$ LANGUAGE plpgsql STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.at_manila_time(p_instant TIMESTAMPTZ, p_time TIME)
RETURNS TIMESTAMPTZ AS $$
    SELECT ((p_instant AT TIME ZONE 'Asia/Manila')::DATE + p_time) AT TIME ZONE 'Asia/Manila';
$$ LANGUAGE sql STABLE SET search_path = '';

CREATE OR REPLACE FUNCTION public.normalize_booking_stays(
    p_check_in_time TIME DEFAULT '14:00',
    p_check_out_time TIME DEFAULT '12:00'
) RETURNS TABLE(normalized_bookings INTEGER, backfilled_availability INTEGER) AS $$
DECLARE
    v_overlaps TEXT;
    v_check_ins INTEGER;
    v_check_outs INTEGER;
    v_backfilled INTEGER;
BEGIN
    SELECT string_agg(DISTINCT a.booking_reference || ' & ' || b.booking_reference, ', ')
    INTO v_overlaps
    FROM public.booking_units au
    JOIN public.bookings a ON a.booking_id = au.booking_id
    JOIN public.booking_units bu ON bu.unit_id = au.unit_id AND bu.booking_id > au.booking_id
    JOIN public.bookings b ON b.booking_id = bu.booking_id
    WHERE a.booking_status IN ('Confirmed', 'CheckedIn')
      AND b.booking_status IN ('Confirmed', 'CheckedIn')
      AND tstzrange(public.at_manila_time(a.check_in, p_check_in_time),
                    public.at_manila_time(a.check_out, p_check_out_time), '[)')
       && tstzrange(public.at_manila_time(b.check_in, p_check_in_time),
                    public.at_manila_time(b.check_out, p_check_out_time), '[)');

    IF v_overlaps IS NOT NULL THEN
        RAISE EXCEPTION 'Confirmed bookings overlap: %', v_overlaps;
    END IF;

    -- Check-ins first: with every check-in at p_check_in_time, moving a check-out to
    -- the earlier p_check_out_time cannot reach the next stay.
    UPDATE public.bookings
    SET check_in = public.at_manila_time(check_in, p_check_in_time)
    WHERE check_in IS DISTINCT FROM public.at_manila_time(check_in, p_check_in_time);
    GET DIAGNOSTICS v_check_ins = ROW_COUNT;

    UPDATE public.bookings
    SET check_out = public.at_manila_time(check_out, p_check_out_time)
    WHERE check_out IS DISTINCT FROM public.at_manila_time(check_out, p_check_out_time);
    GET DIAGNOSTICS v_check_outs = ROW_COUNT;

    UPDATE public.booking_unit_availability bua
    SET check_in = b.check_in, check_out = b.check_out, booking_status = b.booking_status
    FROM public.bookings b
    WHERE b.booking_id = bua.booking_id
      AND (bua.check_in, bua.check_out, bua.booking_status)
          IS DISTINCT FROM (b.check_in, b.check_out, b.booking_status);

    INSERT INTO public.booking_unit_availability (unit_id, booking_id, check_in, check_out, booking_status)
    SELECT bu.unit_id, bu.booking_id, b.check_in, b.check_out, b.booking_status
    FROM public.booking_units bu
    JOIN public.bookings b ON b.booking_id = bu.booking_id
    WHERE NOT EXISTS (
        SELECT 1 FROM public.booking_unit_availability bua
        WHERE bua.booking_id = bu.booking_id AND bua.unit_id = bu.unit_id
    );
    GET DIAGNOSTICS v_backfilled = ROW_COUNT;

    RETURN QUERY SELECT GREATEST(v_check_ins, v_check_outs), v_backfilled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

REVOKE ALL ON FUNCTION public.normalize_booking_stays(TIME, TIME) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_booking_stays(TIME, TIME) TO service_role;

SELECT * FROM public.normalize_booking_stays();

COMMIT;
```

Apply locally, then regenerate types (CLAUDE.md known issue: use the npm script):

```bash
supabase migration up
npm run gen:types
```

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/database`
Expected: PASS, including `booking-stays.test.ts` (6 tests) and the un-skipped Pending overlap test; no other DB test regresses.

- [x] **Step 5: Commit**

Delete `CLAUDE.md` line 30 ("One multi-unit booking test is intentionally skipped…").

```bash
npm run verify
git add supabase/migrations/20261011120000_normalize_booking_stays.sql src/__tests__/database src/types/database.generated.ts CLAUDE.md
git commit -m "feat: normalize booking stays to 14:00/12:00 and backfill availability rows"
```

---

### Task 3: `createBooking` (server side of the module)

**Files:**

- Create: `src/lib/bookings/create.ts`
- Modify: `src/lib/bookings/index.ts`
- Test: `src/__tests__/database/bookings-module.test.ts`

**Interfaces:**

- Consumes: `toStayInstants`, `ManilaDay` (Task 1); RPC storing `payment_method` (Task 2).
- Produces:

```ts
export type PricedUnit = {
  unit_id: string;
  unit_price: number;
  weekend_surcharge: number;
  extra_person_charge: number;
  subtotal: number;
  assigned_guests: number;
  unit_notes?: string;
};
export type NewBooking = {
  guest: {
    guest_name: string;
    email: string | null;
    contact_number: string | null;
    guest_id?: string;
  };
  check_in: ManilaDay;
  check_out: ManilaDay;
  units: PricedUnit[];
  payment_method: string | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  is_walk_in: boolean;
};
export type BookingWithUnits = Tables<"bookings"> & {
  booking_units: (Tables<"booking_units"> & { unit: Tables<"units"> | null })[];
};
export function createBooking(
  client: SupabaseClient<Database>,
  booking: NewBooking
): Promise<BookingWithUnits>;
```

- [x] **Step 1: Write the failing DB tests**

```ts
// src/__tests__/database/bookings-module.test.ts
/**
 * The Booking module (src/lib/bookings) against local Supabase.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createBooking, type NewBooking } from "@/lib/bookings";

import {
  cleanupTestData,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const iso = (value: string) => new Date(value).toISOString();

const stayFor = (unitId: string, checkIn: string, checkOut: string): NewBooking => ({
  guest: { guest_name: "Module Guest", email: null, contact_number: null },
  check_in: checkIn,
  check_out: checkOut,
  units: [
    {
      unit_id: unitId,
      unit_price: 10000,
      weekend_surcharge: 0,
      extra_person_charge: 0,
      subtotal: 10000,
      assigned_guests: 2,
    },
  ],
  payment_method: "Cash",
  is_walk_in: false,
});

const confirm = (bookingId: string) =>
  supabase.from("bookings").update({ booking_status: "Confirmed" }).eq("booking_id", bookingId);

describe("createBooking", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  afterAll(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("stores the Manila days at 14:00 / 12:00 with an availability row", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();

    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    expect(iso(booking.check_in)).toBe("2026-12-20T06:00:00.000Z");
    expect(iso(booking.check_out)).toBe("2026-12-22T04:00:00.000Z");
    expect(booking.booking_status).toBe("Pending");
    expect(booking.payment_method).toBe("Cash");
    expect(booking.booking_units).toHaveLength(1);

    const { data: availability } = await supabase
      .from("booking_unit_availability")
      .select("unit_id, check_in, check_out")
      .eq("booking_id", booking.booking_id);
    expect(availability).toHaveLength(1);
    expect(iso(availability![0].check_in)).toBe("2026-12-20T06:00:00.000Z");
  });

  it("links an existing guest by email instead of creating a duplicate", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const guest = await createTestGuest();

    const booking = await createBooking(supabase, {
      ...stayFor(unit.unit_id, "2026-12-20", "2026-12-22"),
      guest: { guest_name: guest.guest_name, email: guest.email, contact_number: null },
    });

    expect(booking.guest_id).toBe(guest.guest_id);
  });

  it("creates a guest when there is no email", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();

    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    expect(booking.guest_id).not.toBeNull();
  });

  it("lets one guest check out and the next check in on the same day", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const first = await createBooking(supabase, stayFor(unit.unit_id, "2026-12-20", "2026-12-22"));
    const next = await createBooking(supabase, stayFor(unit.unit_id, "2026-12-22", "2026-12-24"));

    expect((await confirm(first.booking_id)).error).toBeNull();
    expect((await confirm(next.booking_id)).error).toBeNull();
  });

  it("refuses to confirm an overlapping stay on the same unit", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const first = await createBooking(supabase, stayFor(unit.unit_id, "2026-12-20", "2026-12-23"));
    const overlapping = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-22", "2026-12-24")
    );
    await confirm(first.booking_id);

    const { error } = await confirm(overlapping.booking_id);
    expect(error?.message).toMatch(/exclusion/);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/database/bookings-module.test.ts`
Expected: FAIL, `createBooking` is not exported.

- [x] **Step 3: Implement**

```ts
// src/lib/bookings/create.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables, TablesInsert } from "@/types/database.types";

import { toStayInstants, type ManilaDay } from "./stay";

// Runs in the Worker with the service-role client: no browser imports here.

type Client = SupabaseClient<Database>;

export type PricedUnit = {
  unit_id: string;
  unit_price: number;
  weekend_surcharge: number;
  extra_person_charge: number;
  subtotal: number;
  assigned_guests: number;
  unit_notes?: string;
};

export type NewBooking = {
  guest: {
    guest_name: string;
    email: string | null;
    contact_number: string | null;
    guest_id?: string;
  };
  check_in: ManilaDay;
  check_out: ManilaDay;
  units: PricedUnit[];
  payment_method: string | null;
  special_requests?: string | null;
  internal_notes?: string | null;
  is_walk_in: boolean;
};

export type BookingWithUnits = Tables<"bookings"> & {
  booking_units: (Tables<"booking_units"> & { unit: Tables<"units"> | null })[];
};

export async function createBooking(
  client: Client,
  booking: NewBooking
): Promise<BookingWithUnits> {
  const guestId = booking.guest.guest_id ?? (await guestIdFor(client, booking.guest));

  const { data: bookingId, error } = await client.rpc("create_multi_unit_booking", {
    p_booking_data: {
      guest_name: booking.guest.guest_name,
      email: booking.guest.email,
      contact_number: booking.guest.contact_number,
      ...toStayInstants(booking.check_in, booking.check_out),
      num_guests: booking.units.reduce((sum, unit) => sum + unit.assigned_guests, 0),
      payment_method: booking.payment_method,
      special_requests: booking.special_requests ?? null,
      internal_notes: booking.internal_notes ?? null,
      is_walk_in: booking.is_walk_in,
      booking_status: "Pending",
      payment_status: "Pending",
    },
    p_units: booking.units,
    p_guest_id: guestId,
  });
  if (error) throw new Error(error.message);

  const { data, error: fetchError } = await client
    .from("bookings")
    .select("*, booking_units(*, unit:units(*))")
    .eq("booking_id", bookingId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  return data;
}

async function guestIdFor(client: Client, guest: NewBooking["guest"]): Promise<string> {
  if (guest.email) {
    const { data, error } = await client
      .from("guests")
      .select("guest_id")
      .eq("email", guest.email)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data.guest_id;
  }

  const { data, error } = await client
    .from("guests")
    .insert({
      guest_name: guest.guest_name,
      email: guest.email,
      phone_number: guest.contact_number,
      total_bookings: 0,
      total_spent: 0,
    } satisfies TablesInsert<"guests">)
    .select("guest_id")
    .single();
  if (error) throw new Error(error.message);
  return data.guest_id;
}
```

`src/lib/bookings/index.ts`:

```ts
export * from "./create";
export * from "./stay";
```

If `tsc` rejects `p_units: booking.units` against `Json[]`, the cause is an `interface`; keep `PricedUnit` a `type` alias.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/database/bookings-module.test.ts`
Expected: PASS (5 tests).

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/lib/bookings src/__tests__/database/bookings-module.test.ts
git commit -m "feat: add createBooking to the booking module"
```

---

### Task 4: Worker routes take Manila days

**Files:**

- Modify: `functions/api/bookings/multi-unit.ts`
- Modify: `functions/api/availability/multi-unit.ts:40-95`
- Modify: `src/types/multi-unit-booking.ts:124-143` (`payment` amount optional, doc the day format)
- Test: `src/__tests__/api/bookings-multi-unit.test.ts`

**Interfaces:**

- Consumes: `createBooking`, `toStayInstants`, `isManilaDay`, `PricedUnit` (`@/lib/bookings/create`, `@/lib/bookings/stay`; import these files directly, not the index, so the Worker never bundles browser code added later).
- Produces: `POST /api/bookings/multi-unit` body `check_in`/`check_out` = `YYYY-MM-DD`; `payment` optional, `payment.method` ∈ `Cash | GCash | BankTransfer | CreditCard | Card`, `payment.amount` optional. 409 `UNIT_UNAVAILABLE` also when a unit is missing from the availability result (not `Available`). `GET /api/availability/multi-unit?units[]=…&check_in=YYYY-MM-DD&check_out=YYYY-MM-DD`; anything else → 400.

- [x] **Step 1: Update the route tests first**

In `src/__tests__/api/bookings-multi-unit.test.ts`:

- `validBookingData` (lines 37-56): `check_in: "2025-12-20"`, `check_out: "2025-12-22"`, and `primary_guest.guest_id: "00000000-0000-4000-8000-000000000001"`. The mock client (`createMockSupabaseClient`) has no `guests` table and no `maybeSingle`, so the route tests skip the guest lookup; Task 3 DB-tests it.
- The check-out-before-check-in test (line ~272): `check_in: "2025-12-22"`, `check_out: "2025-12-20"`.
- Add after the existing "should return 409 when unit is unavailable" test:

```ts
async function postWith(mockClient: ReturnType<typeof createBookingMocks>, body: unknown) {
  vi.resetModules();
  vi.doMock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => mockClient) }));
  vi.doMock("@/lib/security/sanitize-worker", () => ({
    sanitizeTextWorker: vi.fn((text: string) => text),
    sanitizeNameWorker: vi.fn((name: string) => name),
    sanitizeEmailWorker: vi.fn((email: string) => email.toLowerCase()),
    sanitizePhoneWorker: vi.fn((phone: string) => phone),
  }));
  const { onRequestPost } = await import("../../../functions/api/bookings/multi-unit");
  const request = createStaffRequest({ method: "POST", body: JSON.stringify(body) });
  return onRequestPost(createMockContext(request, mockEnv) as never);
}

it("should return 400 for a timestamp instead of a Manila day", async () => {
  const response = await postWith(createBookingMocks({ units: testUnits }), {
    ...validBookingData,
    check_in: "2025-12-20T06:00:00Z",
  });
  expect(response.status).toBe(400);
});

it("should return 409 when a unit is not bookable (missing from the availability result)", async () => {
  const response = await postWith(
    createBookingMocks({ units: testUnits, availabilityResults: [] }),
    validBookingData
  );
  expect(response.status).toBe(409);
});

it("should check availability on the 14:00 / 12:00 Manila instants", async () => {
  const mockClient = createBookingMocks({ units: testUnits });
  await postWith(mockClient, validBookingData);
  expect(mockClient.rpc).toHaveBeenCalledWith(
    "check_multi_unit_availability",
    expect.objectContaining({
      p_check_in: "2025-12-20T06:00:00.000Z",
      p_check_out: "2025-12-22T04:00:00.000Z",
    })
  );
});

it("should store the payment method through the create RPC", async () => {
  const mockClient = createBookingMocks({ units: testUnits });
  await postWith(mockClient, validBookingData);
  expect(mockClient.rpc).toHaveBeenCalledWith(
    "create_multi_unit_booking",
    expect.objectContaining({
      p_booking_data: expect.objectContaining({ payment_method: "GCash" }),
    })
  );
});
```

If `mockClient.rpc` is not a `vi.fn` in `createMockSupabaseClient` (`src/__tests__/api/helpers/mock-supabase.ts:211` shows `rpc: vi.fn(...)`, so it is), the last two tests need no change.

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/api/bookings-multi-unit.test.ts`
Expected: FAIL: day strings rejected by `z.string().datetime()`; missing-unit case returns 201.

- [x] **Step 3: Implement**

`functions/api/bookings/multi-unit.ts`, schema changes:

```ts
import { createBooking, type PricedUnit } from "@/lib/bookings/create";
import { isManilaDay, toStayInstants } from "@/lib/bookings/stay";

const manilaDay = z.string().refine(isManilaDay, "Expected a YYYY-MM-DD day");
```

```ts
    check_in: manilaDay,
    check_out: manilaDay,
```

```ts
    payment: z
      .object({
        method: z.enum(["Cash", "GCash", "BankTransfer", "CreditCard", "Card"]),
        amount: z.number().nonnegative().optional(),
        proof_url: z.string().url().optional(),
      })
      .optional(),
```

```ts
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });
```

In the handler, compute instants once after sanitizing and use them for the check and the cache keys:

```ts
const stay = toStayInstants(sanitizedData.check_in, sanitizedData.check_out);
const requestedUnitIds = sanitizedData.units.map((u) => u.unit_id);
const availabilityCheck = await checkMultiUnitAvailability(
  env,
  requestedUnitIds,
  stay.check_in,
  stay.check_out
);

const bookable = new Set(availabilityCheck.filter((u) => u.is_available).map((u) => u.unit_id));
const unavailableUnits = requestedUnitIds.filter((unitId) => !bookable.has(unitId));
if (unavailableUnits.length > 0) {
  // existing 409 response, with details: { unavailable_units: unavailableUnits }
}
```

Cache keys: `` `availability:${unit.unit_id}:${sanitizedData.check_in}:${sanitizedData.check_out}` `` stays as is (days now).

Replace the body of `createMultiUnitBooking` after the pricing block: keep the `pricing_config` fetch, the per-unit fetch and `calculateUnitPricing`, but price on the stored instants (`calculateUnitPricing(unitData, stay.check_in, stay.check_out, …)`: 14:00 → 12:00 is 22 h, and its `Math.ceil` counts one night); delete the `generate_booking_reference` call (the RPC generates it) and the RPC + fetch block, and end with:

```ts
const units: PricedUnit[] = unitsWithPricing;
if (serverTotal <= 0) throw new UnpricedBookingError(serverTotal);

return createBooking(supabase, {
  guest: {
    guest_name: data.primary_guest.guest_name,
    email: data.primary_guest.email || null,
    contact_number: data.primary_guest.contact_number || null,
    guest_id: data.primary_guest.guest_id,
  },
  check_in: data.check_in,
  check_out: data.check_out,
  units,
  payment_method: data.payment?.method ?? null,
  special_requests: data.special_requests ?? null,
  internal_notes: data.internal_notes ?? null,
  is_walk_in: data.is_walk_in,
});
```

`createMultiUnitBooking` takes `stay` as a third parameter: `createMultiUnitBooking(env, sanitizedData, stay)`. The client-total comparison log uses `data.payment?.amount ?? 0`.

`functions/api/availability/multi-unit.ts`: replace the "Validate dates" and "Convert dates to UTC" blocks with:

```ts
if (!isManilaDay(checkIn) || !isManilaDay(checkOut) || checkOut <= checkIn) {
  return Response.json(
    {
      error: "INVALID_DATES",
      message: "check_in and check_out must be YYYY-MM-DD days, check_out after check_in",
    },
    { status: 400 }
  );
}
const { check_in: checkInUTC, check_out: checkOutUTC } = toStayInstants(checkIn, checkOut);
```

with `import { isManilaDay, toStayInstants } from "@/lib/bookings/stay";`.

`src/types/multi-unit-booking.ts` `AdminMultiUnitBookingCreate`:

```ts
  /** Manila check-in day, YYYY-MM-DD */
  check_in: string;
  /** Manila check-out day, YYYY-MM-DD */
  check_out: string;
  units: AdminBookingUnitCreate[];
  payment?: {
    method: string;
    amount?: number;
    proof_url?: string;
  };
```

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/api && npm run type-check`
Expected: route tests PASS; `type-check` (which includes `functions/tsconfig.json`) exits 0.

- [x] **Step 5: Commit**

```bash
npm run verify
git add functions/api/bookings/multi-unit.ts functions/api/availability/multi-unit.ts src/types/multi-unit-booking.ts src/__tests__/api/bookings-multi-unit.test.ts
git commit -m "feat: booking and availability routes take Manila days"
```

---

### Task 5: The dialog and the multi-unit page create through the route

**Files:**

- Create: `src/lib/bookings/request.ts`
- Modify: `src/hooks/useMultiUnitBookingQueries.ts:88-113` (create via `requestBooking`)
- Modify: `src/stores/useBookingStore.ts:389-530` (`useCreateBooking` becomes an adapter)
- Modify: `src/components/bookings/BookingForm.tsx` (create payload; edit mode removed)
- Modify: `src/components/bookings/MultiUnitBookingForm.tsx:148-149,282-283,292-293`
- Test: `src/lib/bookings/__tests__/request.test.ts`

**Interfaces:**

- Consumes: route contract (Task 4); `pickedDay` (Task 1).
- Produces: `requestBooking(booking: AdminMultiUnitBookingCreate): Promise<MultiUnitBooking>`, which throws `Error(serverMessage)` on non-2xx; `useCreateBooking()` = `useMutation<MultiUnitBooking, Error, AdminMultiUnitBookingCreate>`.

The form payloads are wiring over `pickedDay` (tested in Task 1); `MultiUnitBookingForm.test.tsx` has no submit test to extend, so the forms are covered by the Task 10 browser check. The new unit test pins the error surfacing that the dialog relies on.

- [x] **Step 1: Write the failing test**

```ts
// src/lib/bookings/__tests__/request.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { requestBooking } from "@/lib/bookings/request";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

const booking = {
  primary_guest: { guest_name: "Guest", email: "", contact_number: "" },
  check_in: "2026-12-20",
  check_out: "2026-12-22",
  units: [{ unit_id: "u1", num_guests: 2 }],
};

const respondWith = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("requestBooking", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the created booking", async () => {
    respondWith(201, { success: true, data: { booking_id: "b1", booking_reference: "BKG-1" } });
    await expect(requestBooking(booking)).resolves.toMatchObject({ booking_reference: "BKG-1" });
  });

  it("throws the server's message so the dialog can show it", async () => {
    respondWith(409, {
      success: false,
      error: {
        code: "UNIT_UNAVAILABLE",
        message: "One or more units are not available for the selected dates",
      },
    });
    await expect(requestBooking(booking)).rejects.toThrow(/not available for the selected dates/);
  });

  it("throws a generic message when the body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    await expect(requestBooking(booking)).rejects.toThrow("Failed to create booking");
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/bookings/__tests__/request.test.ts`
Expected: FAIL, cannot resolve `@/lib/bookings/request`.

- [x] **Step 3: Implement**

```ts
// src/lib/bookings/request.ts
import { supabase } from "@/lib/supabase";
import type { AdminMultiUnitBookingCreate, MultiUnitBooking } from "@/types";

// Browser only. Creates through the Worker: server price, availability re-check, availability row.

type RouteResponse =
  | { success: true; data: MultiUnitBooking }
  | { success: false; error: { code: string; message: string } };

export async function requestBooking(
  booking: AdminMultiUnitBookingCreate
): Promise<MultiUnitBooking> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const response = await fetch("/api/bookings/multi-unit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
      ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
    },
    body: JSON.stringify(booking),
  });
  const body = (await response.json().catch(() => null)) as RouteResponse | null;

  if (body?.success) return body.data;
  throw new Error(body?.error.message ?? "Failed to create booking");
}
```

`useMultiUnitBookingQueries.ts`, `useCreateMultiUnitBooking` `mutationFn` becomes:

```ts
    mutationFn: async (bookingData: AdminMultiUnitBookingCreate) => {
      if (!isOnline) throw new OfflineBookingError();
      return requestBooking(bookingData);
    },
```

(import `requestBooking` from `@/lib/bookings/request`; drop the `Partial<MultiUnitBooking>` union and the now-unused `MultiUnitBookingApiResponse` import.)

`useBookingStore.ts`, replace the whole `useCreateBooking` (lines 389-530) with:

```ts
// Creates through the Worker route (src/lib/bookings/request.ts)
export const useCreateBooking = () =>
  useMutation({
    mutationFn: requestBooking,
    onSettled: () => {
      afterBookingCreate();
    },
  });
```

`BookingForm.tsx`:

- Remove the `bookingId` prop, `isEditMode`, `useUpdateBooking`, `recalculatePricing`/`originalTotal` state and every block guarded by `isEditMode` (the recalculate switch, the "Pricing Updated" box, the edit titles). No caller passes `bookingId` (`src/routes/admin/bookings.tsx:130` is the only use); the edit page is the edit path.
- `onSubmit` becomes:

```ts
const onSubmit = async (data: CompleteBookingData) => {
  const sanitizedData = sanitizeBookingFormData(data);
  const contactNumber = sanitizedData.contact_number || data.contact_number;

  try {
    const booking = await createBookingMutation.mutateAsync({
      primary_guest: {
        guest_name: sanitizedData.guest_name || data.guest_name,
        email: sanitizedData.email || data.email || "",
        contact_number: contactNumber ? formatPhoneNumber(contactNumber) : "",
      },
      check_in: pickedDay(data.check_in),
      check_out: pickedDay(data.check_out),
      units: [{ unit_id: data.unit_id, num_guests: data.num_guests }],
      payment: { method: data.payment_method, amount: calculatedTotal },
      special_requests: sanitizedData.special_requests || data.special_requests || undefined,
      is_walk_in: data.is_walk_in ?? false,
      source: "admin",
    });
    toast.success(`Booking ${booking.booking_reference} created`);
    onSuccess?.(booking);
  } catch (error) {
    toast.error("Failed to create booking", {
      description: error instanceof Error ? error.message : undefined,
    });
  }
};
```

- Drop the `formDateToUTC` and `RESORT_OPERATION_HOURS` imports; import `pickedDay` from `@/lib/bookings`. `onSuccess` prop type: `(booking: MultiUnitBooking) => void`.

`MultiUnitBookingForm.tsx`:

```ts
const checkInStr = checkIn ? pickedDay(checkIn) : "";
const checkOutStr = checkOut ? pickedDay(checkOut) : "";
```

and in both the draft and `bookingPayload` objects: `check_in: pickedDay(data.check_in)`, `check_out: pickedDay(data.check_out)`. The draft is only an optimistic placeholder, so its fields take day strings too.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/bookings src/components/bookings src/stores src/hooks src/tests`
Expected: PASS. If `src/tests/mobile-responsive.test.tsx` renders `BookingForm` with removed props, update its render call to drop `bookingId`/`initialData.total_amount`.

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/lib/bookings src/hooks/useMultiUnitBookingQueries.ts src/stores/useBookingStore.ts src/components/bookings src/tests/mobile-responsive.test.tsx
git commit -m "feat: create dialog bookings through the booking route"
```

---

### Task 6: Automatic availability in the dialog

**Files:**

- Modify: `src/hooks/useMultiUnitBookingQueries.ts:36-81` (typed results)
- Create: `src/lib/bookings/availability.ts` (+ export from index)
- Modify: `src/components/bookings/BookingForm.tsx` (unit picker, step 1 guard, fake check removed)
- Test: `src/lib/bookings/__tests__/availability.test.ts`

**Interfaces:**

- Consumes: availability route with days (Task 4); `next_available_date` = booked until (Task 2); `manilaDayOf` (Task 1).
- Produces: `export type UnitAvailability = { unit_id: string; unit_name: string; is_available: boolean; conflicting_bookings: number; next_available_date: string | null }` (in `src/lib/bookings/availability.ts`); `unavailableReason(availability: UnitAvailability[] | undefined, unitId: string): string | null`; `useMultiUnitAvailability(...)` returns `UseQueryResult<UnitAvailability[]>`.

The label logic is a pure function so it is tested without opening a Radix Select in jsdom (the test setup polyfills pointer capture but not `scrollIntoView`).

- [x] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import { unavailableReason, type UnitAvailability } from "@/lib/bookings";

// src/lib/bookings/__tests__/availability.test.ts
process.env.TZ = "America/Los_Angeles";

const results: UnitAvailability[] = [
  {
    unit_id: "free",
    unit_name: "Cabin 1",
    is_available: true,
    conflicting_bookings: 0,
    next_available_date: null,
  },
  {
    unit_id: "booked",
    unit_name: "Cabin 3",
    is_available: false,
    conflicting_bookings: 1,
    next_available_date: "2026-12-23T04:00:00.000Z",
  },
];

describe("unavailableReason", () => {
  it("is null while availability is still loading", () => {
    expect(unavailableReason(undefined, "booked")).toBeNull();
  });

  it("is null for a free unit", () => {
    expect(unavailableReason(results, "free")).toBeNull();
  });

  it("says the Manila day a booked unit frees up", () => {
    expect(unavailableReason(results, "booked")).toBe("Booked until Dec 23");
  });

  it("marks a unit missing from the result (not Available) as not bookable", () => {
    expect(unavailableReason(results, "maintenance")).toBe("Not available");
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/bookings/__tests__/availability.test.ts`
Expected: FAIL, `unavailableReason` is not exported.

- [x] **Step 3: Implement**

```ts
// src/lib/bookings/availability.ts
import { format, parseISO } from "date-fns";

import { manilaDayOf } from "./stay";

export type UnitAvailability = {
  unit_id: string;
  unit_name: string;
  is_available: boolean;
  conflicting_bookings: number;
  /** When the conflicting stays end ("booked until"); null when available */
  next_available_date: string | null;
};

// Units missing from the result are not bookable (status other than Available)
export function unavailableReason(
  availability: UnitAvailability[] | undefined,
  unitId: string
): string | null {
  if (!availability) return null;
  const result = availability.find((entry) => entry.unit_id === unitId);
  if (!result) return "Not available";
  if (result.is_available) return null;
  if (!result.next_available_date) return "Booked";
  return `Booked until ${format(parseISO(manilaDayOf(result.next_available_date)), "MMM d")}`;
}
```

`src/lib/bookings/index.ts` adds `export * from "./availability";`.

`useMultiUnitBookingQueries.ts`: import `type UnitAvailability` from `@/lib/bookings`, and in `multiUnitAvailabilityQuery`: `const data = (await response.json()) as { data: { results: UnitAvailability[] } };`. Document `checkIn`/`checkOut` params as Manila days.

`BookingForm.tsx`:

- Delete `isCheckingAvailability` state, `checkAvailability` and the "Check Availability" `<Button>`.
- After `selectedUnit`:

```ts
const checkInDay = checkIn ? pickedDay(checkIn) : "";
const checkOutDay = checkOut && checkIn && checkOut > checkIn ? pickedDay(checkOut) : "";
const unitIds = useMemo(() => units?.map((unit) => unit.unit_id) ?? [], [units]);
const { data: availability, isFetching: isCheckingAvailability } = useMultiUnitAvailability(
  unitIds,
  checkInDay,
  checkOutDay
);
```

- In the unit `<SelectItem>`, with `const reason = unavailableReason(availability, unit.unit_id);` at the top of the `map` callback: `disabled={reason !== null}`, and the price badge is replaced by the reason when there is one:

```tsx
{
  reason ? (
    <span className="text-muted-foreground ml-2 text-xs">{reason}</span>
  ) : (
    <Badge variant="outline" className="ml-2">
      {formatCurrency(unit.base_rate)}/night
    </Badge>
  );
}
```

- Under the unit field, while checking: `{isCheckingAvailability && <FormDescription>Checking availability…</FormDescription>}`.
- In `validateStep` case 1, after the schema parse:

```ts
const reason = unavailableReason(availability, values.unit_id);
if (reason) {
  form.setError("unit_id", { message: `This unit is not free for these days (${reason})` });
  return false;
}
return true;
```

- Imports: `useMemo`; `useMultiUnitAvailability` from `@/hooks/useMultiUnitBookingQueries`; `pickedDay`, `unavailableReason` from `@/lib/bookings`.
- Load the `enterprise-ui` skill before styling the disabled item, and match its muted-text and badge conventions.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/bookings src/components/bookings`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/lib/bookings src/hooks/useMultiUnitBookingQueries.ts src/components/bookings
git commit -m "feat: check unit availability automatically in the booking dialog"
```

---

### Task 7: `updateBooking` and the edit page

**Files:**

- Create: `src/lib/bookings/operations.ts`
- Modify: `src/lib/bookings/index.ts`
- Modify: `src/components/bookings/BookingEdit/to-booking-update.ts` (days, not instants)
- Modify: `src/components/bookings/BookingEdit/__tests__/to-booking-update.test.ts`
- Modify: `src/components/bookings/BookingEdit/index.tsx:52-79`
- Modify: `src/stores/useBookingStore.ts` (`useUpdateBooking` becomes an adapter)
- Modify: `src/hooks/entity/useEntityEdit.ts` (booking branch removed)
- Modify: `src/hooks/entity/__tests__/useEntityEdit.test.tsx` (booking cases removed)
- Test: `src/__tests__/database/bookings-module.test.ts`

**Interfaces:**

- Consumes: `toStayInstants`, `pickedDay`, `manilaDayOf` (Task 1).
- Produces:

```ts
export type BookingChanges = Partial<{
  guest_name: string;
  email: string | null;
  contact_number: string | null;
  num_guests: number;
  payment_method: string | null;
  special_requests: string | null;
  is_walk_in: boolean;
}> & { stay?: { check_in: ManilaDay; check_out: ManilaDay } };
export function updateBooking(
  client,
  bookingId: string,
  changes: BookingChanges
): Promise<Tables<"bookings">>;
```

`toBookingUpdate(input: BookingEditInput): BookingChanges`; `useUpdateBooking()` = `useMutation<Tables<"bookings">, Error, { bookingId: string; changes: BookingChanges }>`.

- [x] **Step 1: Write the failing tests**

Append to `bookings-module.test.ts` (add `updateBooking` to the import):

```ts
describe("updateBooking", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("moves the stay and its availability row to the new Manila days", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    const updated = await updateBooking(supabase, booking.booking_id, {
      stay: { check_in: "2026-12-27", check_out: "2026-12-29" },
    });

    expect(iso(updated.check_in)).toBe("2026-12-27T06:00:00.000Z");
    const { data: availability } = await supabase
      .from("booking_unit_availability")
      .select("check_in, check_out")
      .eq("booking_id", booking.booking_id)
      .single();
    expect(iso(availability!.check_out)).toBe("2026-12-29T04:00:00.000Z");
  });

  it("links the booking to the guest with the new email, creating one when missing", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    const updated = await updateBooking(supabase, booking.booking_id, {
      guest_name: "Renamed Guest",
      email: `renamed-${Date.now()}@example.com`,
    });

    const { data: guest } = await supabase
      .from("guests")
      .select("email")
      .eq("guest_id", updated.guest_id!)
      .single();
    expect(guest?.email).toBe(updated.email);
  });

  it("throws when the row is not visible to the caller", async () => {
    if (!shouldRun) return;
    await expect(
      updateBooking(supabase, "00000000-0000-0000-0000-000000000000", { num_guests: 2 })
    ).rejects.toThrow();
  });
});
```

`to-booking-update.test.ts`: replace the instant assertions with:

```ts
expect(update.stay).toEqual({ check_in: "2026-10-15", check_out: "2026-10-17" });
```

and update its key-list assertion: `check_in`/`check_out` replaced by `stay`. Add `process.env.TZ = "America/Los_Angeles";` as the file's first line.

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/database/bookings-module.test.ts src/components/bookings/BookingEdit`
Expected: FAIL: `updateBooking` not exported; `update.stay` undefined.

- [x] **Step 3: Implement**

```ts
// src/lib/bookings/operations.ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { BookingStatus } from "@/types";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/types/database.types";

import { toStayInstants, type ManilaDay } from "./stay";

type Client = SupabaseClient<Database>;
type BookingRow = Tables<"bookings">;

export type BookingChanges = Partial<{
  guest_name: string;
  email: string | null;
  contact_number: string | null;
  num_guests: number;
  payment_method: string | null;
  special_requests: string | null;
  is_walk_in: boolean;
}> & { stay?: { check_in: ManilaDay; check_out: ManilaDay } };

type Result<T> = { data: T | null; error: { message: string } | null };

function rowFrom<T>({ data, error }: Result<T>): NonNullable<T> {
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) throw new Error("The booking was not returned");
  return data;
}

export async function updateBooking(
  client: Client,
  bookingId: string,
  changes: BookingChanges
): Promise<BookingRow> {
  const { stay, ...columns } = changes;
  const update: TablesUpdate<"bookings"> = { ...columns };

  if (stay) Object.assign(update, toStayInstants(stay.check_in, stay.check_out));
  if (changes.email) update.guest_id = await guestIdForEmail(client, changes);

  return rowFrom(
    await client.from("bookings").update(update).eq("booking_id", bookingId).select().single()
  );
}

async function guestIdForEmail(client: Client, changes: BookingChanges): Promise<string> {
  const { data: existing, error } = await client
    .from("guests")
    .select("guest_id")
    .eq("email", changes.email!)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing.guest_id;

  const { guest_id } = rowFrom(
    await client
      .from("guests")
      .insert({
        guest_name: changes.guest_name ?? changes.email!,
        email: changes.email,
        phone_number: changes.contact_number ?? null,
      } satisfies TablesInsert<"guests">)
      .select("guest_id")
      .single()
  );
  return guest_id;
}
```

`src/lib/bookings/index.ts` adds `export * from "./operations";`.

`to-booking-update.ts`:

```ts
import { pickedDay, type BookingChanges } from "@/lib/bookings";
import type { BookingEditInput } from "@/lib/validation/entity-schemas";

// unit_id is edited through the booking_units junction table, not the bookings row
export function toBookingUpdate(input: BookingEditInput): BookingChanges {
  return {
    guest_name: input.guest_name,
    email: input.email,
    contact_number: input.contact_number,
    stay: { check_in: pickedDay(input.check_in), check_out: pickedDay(input.check_out) },
    num_guests: input.num_guests,
    payment_method: input.payment_method,
    special_requests: input.special_requests,
    is_walk_in: input.is_walk_in,
  };
}
```

`BookingEdit/index.tsx`: the form's default dates must show the Manila day as a local-midnight picker Date, so replace `check_in: new Date(booking.check_in)` / `check_out` with `parseISO(manilaDayOf(booking.check_in))` / `parseISO(manilaDayOf(booking.check_out))` (`parseISO` from `date-fns`). Replace the `useEntityEdit("booking", …)` mutation with:

```ts
const updateBooking = useUpdateBooking();

const onSubmit: SubmitHandler<BookingEditInput> = (data) => {
  updateBooking.mutate(
    { bookingId, changes: toBookingUpdate(data) },
    { onSuccess: () => navigate({ to: "/admin/bookings/$bookingId", params: { bookingId } }) }
  );
};
```

`useBookingStore.ts`, `useUpdateBooking` becomes:

```ts
export const useUpdateBooking = () =>
  useMutation({
    mutationFn: ({ bookingId, changes }: { bookingId: string; changes: BookingChanges }) =>
      updateBooking(supabase, bookingId, changes),
    onSuccess: () => {
      toast.success("Booking updated");
    },
    onError: (error) => {
      toast.error("Failed to update the booking", { description: error.message });
    },
    onSettled: () => {
      afterBookingUpdate();
    },
  });
```

`afterBookingUpdate` must also invalidate the entity detail cache the edit page reads (`queryKeys.entity("booking", id)`). Check `src/lib/query-invalidation.ts`; if it does not, invalidate `queryKeys.entities("booking")` there.

`useEntityEdit.ts`: `type EditableEntityType = Exclude<EntityType, "payment" | "booking">;`, drop the `"booking"` arm of `EntityUpdateData` and of the switch, drop the `Booking` import, and update the header comment: `// Payments and bookings save through their modules (src/lib/payments, src/lib/bookings)`. Delete the booking cases in `useEntityEdit.test.tsx`.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/database/bookings-module.test.ts src/components/bookings src/hooks/entity`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/lib/bookings src/components/bookings/BookingEdit src/stores/useBookingStore.ts src/hooks/entity src/lib/query-invalidation.ts src/__tests__/database/bookings-module.test.ts
git commit -m "feat: save booking edits through updateBooking on Manila days"
```

---

### Task 8: Cancel and status through the module; hard delete leaves the UI

**Files:**

- Modify: `src/lib/bookings/operations.ts`
- Modify: `src/stores/useBookingStore.ts` (`useCancelBooking`, `useUpdateBookingStatus` adapters; `useDeleteBooking` deleted; `canTransitionStatus` re-exported from the module)
- Modify: `src/lib/supabase.ts:171-175` (delete `db.bookings.cancel`)
- Modify: `src/components/bookings/BookingsTable/components/BookingActionsCell.tsx`
- Modify: `src/components/bookings/BookingsTable/hooks/useBookingsTable.ts:52,85-90`
- Modify: the columns hook that receives `deleteBooking` (follow the `useBookingColumns` import)
- Test: `src/__tests__/database/bookings-module.test.ts`

**Interfaces:**

- Produces: `cancelBooking(client, bookingId): Promise<BookingRow>`; `setBookingStatus(client, bookingId, status: BookingStatus): Promise<BookingRow>`; `canTransitionStatus(current, next): boolean` (moved from the store; the store re-exports it for existing importers).

- [x] **Step 1: Write the failing tests**

Append to `bookings-module.test.ts` (import `cancelBooking`, `setBookingStatus`):

```ts
describe("cancelBooking and setBookingStatus", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("cancels and frees the unit", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );
    await setBookingStatus(supabase, booking.booking_id, "Confirmed");

    const cancelled = await cancelBooking(supabase, booking.booking_id);

    expect(cancelled.booking_status).toBe("Cancelled");
    const { data } = await supabase.rpc("check_multi_unit_availability", {
      p_unit_ids: [unit.unit_id],
      p_check_in: "2026-12-20T06:00:00Z",
      p_check_out: "2026-12-22T04:00:00Z",
    });
    expect(data?.[0].is_available).toBe(true);
  });

  it("throws instead of silently doing nothing when no row is updated", async () => {
    if (!shouldRun) return;
    await expect(cancelBooking(supabase, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });

  it("refuses a status change the workflow does not allow", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    await expect(setBookingStatus(supabase, booking.booking_id, "CheckedOut")).rejects.toThrow(
      /Cannot change a Pending booking to CheckedOut/
    );
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/database/bookings-module.test.ts`
Expected: FAIL, functions not exported.

- [x] **Step 3: Implement**

Append to `operations.ts`:

```ts
const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [],
  Cancelled: [],
};

export const canTransitionStatus = (current: BookingStatus, next: BookingStatus) =>
  STATUS_TRANSITIONS[current]?.includes(next) ?? false;

export async function setBookingStatus(
  client: Client,
  bookingId: string,
  status: BookingStatus
): Promise<BookingRow> {
  const { booking_status } = rowFrom(
    await client.from("bookings").select("booking_status").eq("booking_id", bookingId).single()
  );
  if (!canTransitionStatus(booking_status as BookingStatus, status)) {
    throw new Error(`Cannot change a ${booking_status} booking to ${status}`);
  }
  return rowFrom(
    await client
      .from("bookings")
      .update({ booking_status: status } satisfies TablesUpdate<"bookings">)
      .eq("booking_id", bookingId)
      .select()
      .single()
  );
}

export const cancelBooking = (client: Client, bookingId: string) =>
  setBookingStatus(client, bookingId, "Cancelled");
```

`useBookingStore.ts`:

- Delete `VALID_STATUS_TRANSITIONS`/`canTransitionStatus`; add `export { canTransitionStatus } from "@/lib/bookings";`.
- `useUpdateBookingStatus` `mutationFn`: `({ bookingId, status }) => setBookingStatus(supabase, bookingId, status)` (keep its optimistic `onMutate`/`onError`), and add `onError` toast: `toast.error("Failed to change the booking status", { description: error.message })` after the rollback.
- `useCancelBooking`:

```ts
export const useCancelBooking = () =>
  useMutation({
    mutationFn: (bookingId: string) => cancelBooking(supabase, bookingId),
    onSuccess: (booking) => {
      toast.success(`Booking ${booking.booking_reference} cancelled`);
    },
    onError: (error) => {
      toast.error("Failed to cancel the booking", { description: error.message });
    },
    onSettled: () => {
      afterBookingCancel();
    },
  });
```

- Delete `useDeleteBooking` and the `afterBookingDelete` import if it becomes unused (also delete `afterBookingDelete` from `query-invalidation.ts` if nothing else imports it).

`BookingActionsCell.tsx`:

- Remove the `deleteBooking` prop, `canDelete`, and the Delete action.
- The existing `AlertDialog` becomes the cancel confirmation: rename `showDeleteDialog` → `showCancelDialog`; the Cancel action's `onClick: () => setShowCancelDialog(true)`; title "Cancel booking"; description "`{booking.booking_reference}` will be cancelled and its unit freed for these days. This cannot be undone."; buttons "Keep booking" (`AlertDialogCancel`) and "Cancel booking" (`AlertDialogAction` → `cancelBooking.mutate(booking.booking_id)`).

`useBookingsTable.ts` and the columns hook: remove `useDeleteBooking`, `deleteBooking` and their prop plumbing. `src/tests/mobile-responsive.test.tsx` mocks `useCancelBooking`; delete any `useDeleteBooking` mock there.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/__tests__/database/bookings-module.test.ts src/components/bookings src/stores src/tests`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/lib src/stores/useBookingStore.ts src/components/bookings/BookingsTable src/tests src/__tests__/database/bookings-module.test.ts
git commit -m "feat: cancel with confirmation through the booking module, remove hard delete"
```

---

### Task 9: Readers the new times break

**Files:**

- Modify: `src/stores/useMultiUnitBookingStore.ts:255-258`
- Modify: `src/components/bookings/BookingsTable/components/BookingFilters.tsx:32-40,192-196`
- Modify: `src/stores/useBookingStore.ts:337-342`
- Modify: `src/components/bookings/BookingsTable/hooks/useBookingsTable.ts:122-132`
- Modify: `src/components/booking-confirmation/BookingSummaryCard.tsx:36-45`
- Create: `src/lib/bookings/filter-day.ts` (+ export from index)
- Test: `src/lib/bookings/__tests__/filter-day.test.ts`, `src/stores/__tests__/useMultiUnitBookingStore.nights.test.ts`

**Interfaces:**

- Produces: `filterDay(value: string): ManilaDay`, which accepts a day or a legacy persisted ISO filter value.

- [x] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";

import { filterDay } from "@/lib/bookings";

// src/lib/bookings/__tests__/filter-day.test.ts
process.env.TZ = "America/Los_Angeles";

describe("filterDay", () => {
  it("keeps a Manila day", () => {
    expect(filterDay("2026-10-15")).toBe("2026-10-15");
  });

  it("reads a legacy persisted ISO value as its Manila day", () => {
    expect(filterDay("2026-10-14T16:00:00.000Z")).toBe("2026-10-15");
  });
});
```

```ts
import { describe, expect, it } from "vitest";

import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";

// src/stores/__tests__/useMultiUnitBookingStore.nights.test.ts
process.env.TZ = "America/Los_Angeles";

const unit = {
  unit_id: "u1",
  unit_name: "Cabin 1",
  base_rate: 10000,
  weekend_rate: 10000,
  extra_person_rate: 0,
  base_occupancy: 6,
  max_occupancy: 8,
};

describe("calculateUnitPricing night count", () => {
  it("counts one night for a stored 14:00 → 12:00 stay", () => {
    const pricing = useMultiUnitBookingStore
      .getState()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .calculateUnitPricing(unit as any, "2026-12-20T06:00:00.000Z", "2026-12-21T04:00:00.000Z", 2);
    expect(pricing.nights).toBe(1);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/bookings src/stores/__tests__/useMultiUnitBookingStore.nights.test.ts`
Expected: FAIL: `filterDay` missing; `nights` is 0.

- [x] **Step 3: Implement**

```ts
// src/lib/bookings/filter-day.ts
import { isManilaDay, manilaDayOf, type ManilaDay } from "./stay";

// Booking list filters were persisted as ISO instants before they became days
export const filterDay = (value: string): ManilaDay =>
  isManilaDay(value) ? value : manilaDayOf(value);
```

`src/lib/bookings/index.ts` adds `export * from "./filter-day";`.

`useMultiUnitBookingStore.ts` line 258:

```ts
const nights = nightsBetween(manilaDayOf(checkIn), manilaDayOf(checkOut));
```

(import `manilaDayOf`, `nightsBetween` from `@/lib/bookings`; drop `dateDifference` if unused.)

`BookingFilters.tsx`, apply:

```ts
          date_from: fromDate ? pickedDay(fromDate) : undefined,
          date_to: toDate ? pickedDay(toDate) : undefined,
```

and where `dateRange` state is initialized from `filters` (lines 32-40), build Dates with `parseISO(filterDay(filters.date_from))` instead of `new Date(...)`.

`useBookingStore.ts` list query (filter on the check-in day, both ends inclusive):

```ts
if (filters.date_from) {
  query = query.gte("check_in", manilaDayStart(filterDay(filters.date_from)));
}
if (filters.date_to) {
  query = query.lt("check_in", manilaDayStart(dayAfter(filterDay(filters.date_to))));
}
```

`useBookingsTable.ts`:

```ts
if (filters.date_from || filters.date_to) {
  const from = filters.date_from ? filterDay(filters.date_from) : null;
  const to = filters.date_to ? filterDay(filters.date_to) : null;
  filtered = filtered.filter((booking) => {
    const checkInDay = manilaDayOf(booking.check_in);
    return (!from || checkInDay >= from) && (!to || checkInDay <= to);
  });
}
```

`BookingSummaryCard.tsx`, show the Manila day and the configured time, not the browser's reading of the instant:

```tsx
const formatStayDay = (instant: string, time: string) =>
  `${formatPhilippineDate(new Date(instant), "EEE, MMM d, yyyy")} · ${format(parse(time, "HH:mm", new Date()), "h:mm a")}`;
```

with `{formatStayDay(checkIn, RESORT_OPERATION_HOURS.checkInTime)}` / `{formatStayDay(checkOut, RESORT_OPERATION_HOURS.checkOutTime)}`; imports `format`, `parse` from `date-fns`, `formatPhilippineDate` from `@/lib/timezone`, `RESORT_OPERATION_HOURS` from `@/config/settings`.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib src/stores src/components/bookings src/components/booking-confirmation`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
npm run verify
git add src/lib/bookings src/stores src/components/bookings/BookingsTable src/components/booking-confirmation
git commit -m "fix: read stays as Manila days in night counts, list filter and confirmation"
```

---

### Task 10: Local browser check, prod gate, deploy

**Files:**

- Modify: `docs/plans/2026-10-10-architecture-deepening.md` (checkboxes, results)

- [x] **Step 1: Full local verification** (2026-10-11 at `161d501`: verify exit 0, Test Files 110 passed | 1 skipped, Tests 1421 passed | 20 skipped; test:db exit 0, Test Files 15 passed, Tests 95 passed)

Run: `npm run verify && npm run test:db`
Expected: both exit 0; quote the summary lines (test counts) in the plan doc.

- [x] **Step 2: Browser check (use the `run` skill: vite + `npm run dev:wrangler`, local Supabase, manager login)** — 2026-10-12, all 7 pass (screenshots read): 1. BKG-2026-10-346 created via the route (toast), stored `06:00Z`/`04:00Z`, GCash, availability row; 2. Pending didn't block, after Confirm "Booked until Dec 22" (needs > 60 s after the _first lookup_ of those days, plus a page reload: the client keeps availability 5 min); 3. Dec 22 → 24 enabled; 4. edit to Dec 27 → 29, detail shows Dec 27/29, availability row moved, Dec 19-21 free; 5. no Delete, Cancel confirms with the planned copy, booking + availability Cancelled, unit free; 6. filter Dec 27 lists it, Dec 28 lists none (request bounds Manila midnight); 7. new-multi: 2 units Dec 27 → 29, `check_in 2026-12-27 06:00:00+00`, 2 availability rows. Found and fixed during the check: POST `/api/bookings/multi-unit` returned 401 for every valid staff token (`ff7b7e7`, `21efd41`; see Decisions)

Check and screenshot (Read each screenshot before citing it):

1. New booking dialog: pick Dec 20 → Dec 22 on a free unit; the price shows; create; toast shows the reference.
2. Reopen the dialog: the same unit for Dec 21 → Dec 22 is enabled (Pending does not block). Confirm the first booking in the table, wait > 60 s (the availability route caches 60 s), reopen: the unit is disabled with "Booked until Dec 22".
3. Same unit Dec 22 → Dec 24: enabled (same-day turnover).
4. Edit the first booking to Dec 27 → Dec 29: the detail page shows the new days; the unit is free again for Dec 20.
5. Row menu: no Delete; Cancel asks for confirmation; after cancelling, the unit is free.
6. Bookings filter Dec 20 → Dec 20: lists the booking that checks in Dec 20.
7. `/admin/bookings/new-multi`: book two units Dec 27 → Dec 29; the detail page shows Dec 27 → Dec 29, and in Studio (or `psql "$DB_URL"`) `check_in` is `2026-12-27 06:00:00+00`.

- [x] **Step 3: Read-only prod preview (agent runs, user reviews)** — 2026-10-12: 180 bookings, 0 Manila-day changes; split 106 × 15:00/11:00, 72 × 00:00/00:00, 1 × 00:00/11:00, 1 × 15:48/00:00; missing_availability 107; same_day 0; confirmed_overlap 0; newest booking 2026-10-10 03:47Z. Matches the baseline

```bash
supabase db query --linked "
SELECT booking_reference, booking_status, check_in, check_out,
  ((check_in AT TIME ZONE 'Asia/Manila')::date + TIME '14:00') AT TIME ZONE 'Asia/Manila' AS new_check_in,
  ((check_out AT TIME ZONE 'Asia/Manila')::date + TIME '12:00') AT TIME ZONE 'Asia/Manila' AS new_check_out
FROM public.bookings ORDER BY check_in;"
supabase db query --linked "SELECT count(*) AS missing_availability FROM public.booking_units bu WHERE NOT EXISTS (SELECT 1 FROM public.booking_unit_availability a WHERE a.booking_id = bu.booking_id AND a.unit_id = bu.unit_id);"
supabase db query --linked "SELECT count(*) AS same_day FROM public.bookings WHERE (check_out AT TIME ZONE 'Asia/Manila')::date <= (check_in AT TIME ZONE 'Asia/Manila')::date;"
supabase db query --linked "
SELECT a.booking_reference || ' & ' || b.booking_reference AS confirmed_overlap
FROM public.booking_units au
JOIN public.bookings a ON a.booking_id = au.booking_id
JOIN public.booking_units bu ON bu.unit_id = au.unit_id AND bu.booking_id > au.booking_id
JOIN public.bookings b ON b.booking_id = bu.booking_id
WHERE a.booking_status IN ('Confirmed', 'CheckedIn') AND b.booking_status IN ('Confirmed', 'CheckedIn')
  AND tstzrange(((a.check_in AT TIME ZONE 'Asia/Manila')::date + TIME '14:00') AT TIME ZONE 'Asia/Manila',
                ((a.check_out AT TIME ZONE 'Asia/Manila')::date + TIME '12:00') AT TIME ZONE 'Asia/Manila', '[)')
   && tstzrange(((b.check_in AT TIME ZONE 'Asia/Manila')::date + TIME '14:00') AT TIME ZONE 'Asia/Manila',
                ((b.check_out AT TIME ZONE 'Asia/Manila')::date + TIME '12:00') AT TIME ZONE 'Asia/Manila', '[)');"
```

Expected (2026-10-11 baseline): no Manila day changes between old and new columns; `missing_availability` 107; `same_day` 0; no `confirmed_overlap` rows (the migration raises on any). Any difference → stop and report.

Tell the user before `db push`: the normalization fires the audit trigger (about 2 audit rows per changed booking, ~360 rows) and the guest-statistics trigger, and bumps `updated_at` on every booking it touches. The migration also revokes EXECUTE on `create_multi_unit_booking` from `anon`/`authenticated` (only the Worker calls it).

- [x] **Step 4: User pushes the migration** (`supabase db push`); agent confirms read-only: `normalize_booking_stays` exists, re-running the split query shows only 14:00 / 12:00, `missing_availability` = 0, and `create_multi_unit_booking`'s `proacl` lists only `postgres` and `service_role`. — 2026-10-12: pushed; both functions SECURITY DEFINER with proacl `{postgres=X/postgres,service_role=X/postgres}`; split 180 × 14:00/12:00; missing_availability 0; same_day 0; still 180 bookings, newest 2026-10-10 03:47Z.
- [ ] **Step 5: Push commits** (`git push` with `timeout: 600000`; verify `git fetch origin && git rev-parse HEAD origin/main` match).
- [ ] **Step 6: User runs the manual deploy** from a clean worktree (memory: manual deploy recipe; never build with `.env.local`).
- [ ] **Step 7: Post-deploy normalize, the day after the deploy.** Open tabs and installed admin PWAs keep the old client until the update prompt is accepted (`registerType: "prompt"`); the old dialog still writes 15:00/11:00 without an availability row. Once every family device has updated, the agent re-runs the split query; if any row is off 14:00 / 12:00 or `missing_availability` > 0, the user runs `SELECT * FROM public.normalize_booking_stays();` in the SQL editor (idempotent). Agent re-runs the split query: only 14:00 / 12:00.
