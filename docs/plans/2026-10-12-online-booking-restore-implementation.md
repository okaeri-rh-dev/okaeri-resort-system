# Online Booking Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest can book cabins online on prod; staff verify the downpayment and assign cabins without errors.

**Architecture:** One idempotent forward migration (`20261013000000_online_booking.sql`) rewrites `create_guest_booking` and `assign_units_to_booking`, adds the four `bookings` columns and `guest_booking_unit_requests`, and drops the unfinished objects. Workers endpoints and admin screens are fixed to match: stays as Manila days (ADR 0002), payment status derived from `payments` (ADR 0001), conflicts checked on `booking_unit_availability`.

**Tech Stack:** Postgres (Supabase local, PL/pgSQL), Cloudflare Pages Functions (TypeScript), React + TanStack Router, Vitest, Playwright.

Scope, problem table and accepted decisions D1–D3 live in the tracking doc `docs/plans/2026-10-12-online-booking-restore.md`. Decisions D4–D8 below were found while writing this plan and accepted by the user.

## Global Constraints

- Local DB URL: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (from `supabase status -o env`). Run `supabase start` first if it is down.
- The migration must stay idempotent (`IF EXISTS` / `IF NOT EXISTS` / `CREATE OR REPLACE`): it applies to local (has most objects) and prod (has none). During development, re-apply it with `psql -f`; Task 4 proves a clean apply with `supabase db reset`.
- New and rewritten SQL functions: `SET search_path = ''`, schema-qualified names, executable by `service_role` only (`REVOKE ALL … FROM PUBLIC, anon, authenticated`).
- App code never writes `bookings.payment_status` (ADR 0001). Stays are Manila days at 14:00 / 12:00 (ADR 0002, `src/lib/bookings/stay.ts`).
- Never `supabase db query --linked` or any prod command as the agent; the user runs prod commands with `!`.
- The prod schema dump (D3) goes in the session scratchpad and is never committed (public repo).
- Commits: Conventional Commits, no Co-Authored-By line. Run `npm run verify` before each commit that touches TS.
- Copy: "cabin" in guest/staff-facing text; no front-desk/reception wording (memory: no front desk).

## Decisions & Deferrals (D4–D8 accepted as recommended, user, 2026-10-12)

- **D4. Drop `payment_before_assignment` instead of rewriting it.** Why: the status is derived from `payments`, so deleting or refunding a payment on an assigned booking would hit the CHECK and fail. `assign_units_to_booking` already enforces the order. Revisit: n/a.
- **D5. Single-cabin guest bookings go through the queue.** Why: `pending-bookings.ts:117` filters `is_multi_unit = true`, which `create_guest_booking` sets only for 2+ cabins, so a 1-cabin guest booking was never shown. Queue and assign key on `is_guest_booking`. Revisit: n/a.
- **D6. Guest booking sends Manila days.** Why: the form sends browser-local midnight (`toISOString()`), so availability rows written at assignment would use a different convention from every other booking (ADR 0002) and pricing counts weekend nights a day off in the Worker. Revisit: n/a.
- **D7. `guest_booking_unit_requests` keeps only `guests_per_unit`.** Why: guests pick a guest count per cabin; `unit_type`, `quantity` and `special_requests` are never sent and no reader selects them. Revisit: if cabin types are introduced.
- **D8. `create_guest_booking` stores `payment_proof_url` and the idempotency key.** Why: the endpoint never passed the proof URL (so D1's `proof_url` would be empty) and never wrote `idempotency_keys` (so its duplicate check never matched). Revisit: n/a.
- **Assignment indexes dropped, not kept (design item 1).** Why: the queue scans a few dozen guest bookings; three partial indexes on `bookings` cost more to keep in sync with drift than they save. Revisit: if the queue gets slow.
- **Task 1 of the outline (investigation), done 2026-10-12.** `authenticated_users_insert_booking_units` (from `20251028154441`) lets any signed-in user insert `booking_units` for any booking: dropped in this migration. `pricing_config_admin_policy` (from `20251108000000`) is unrelated: pricing writes go through `createSupabaseAdmin` (`functions/api/pricing/update-config.ts:89`), so its absence on prod breaks nothing; its baseline line moves to its own group in Task 9. Revisit: n/a.
- **Plan test arithmetic corrected during execution (2026-10-12).** Guests `[2, 4]` price to 7000 + 9000 = 16000 (downpayment 8000), not 15000/7500; Task 2's second cabin is `extra_person_charge` 2000 / `subtotal` 9000. Task 1 also dropped `unit_type`/`quantity` from `constraints.test.ts` inserts and regenerated `database.generated.ts`. Revisit: n/a.
- **Review-driven changes (2026-10-12, user).** D4 and repeat-assignment tests now assert the first assignment succeeded (`93e3395`). The rollback keeps guest bookings instead of deleting them; its header says so and asks for a manual export/cancel first (`863640f`), so a rollback never silently deletes real reservations. Task 4's lint step still reports the unused `p_turnstile_token`/`p_guest_data` parameters, which are kept for the caller's signature. Revisit: n/a.
- **Final review: `bookings.pricing_snapshot` added to the migration (2026-10-12).** Why: it comes from drifted `20251104184719` and is absent on prod (baseline listed it under "Seasonal pricing"), so both functions would fail with `42703` after a clean push. Revisit: n/a.
- **Deferred: cabin ↔ guest-group pairing (2026-10-12, user).** `assign_units_to_booking` pairs `p_unit_ids[i]` with `unit_breakdown[i]`, and the UI sends cabins in click order, so for mixed groups (e.g. 6 + 2) per-cabin `assigned_guests`/price can land on the wrong cabin; there is no capacity check. Totals stay right. Revisit: when a guest books cabins with different group sizes, or a cabin is over capacity (Task 10's prod test uses 2 cabins of different sizes).
- **Deferred: concurrent double-verify (2026-10-12, user).** Two staff verifying the same booking at once in different browsers both insert the downpayment (derives `Completed`). Buttons are disabled per browser; one-family team. Fix if needed: atomic verify RPC (`FOR UPDATE`, insert only while `Pending`). Revisit: when more than one person verifies payments.
- **Deferred: `cleanup_expired_payment_proofs`** stays in the baseline (deferred-list item 3). **Deferred: `preview-pricing.ts`** has no caller; left as is.

## File Structure

| File                                                                                                                                             | Change | Responsibility                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------- |
| `supabase/migrations/20261013000000_online_booking.sql`                                                                                          | create | All schema and function changes                          |
| `supabase/rollbacks/20261013000000_rollback_online_booking.sql`                                                                                  | create | Return prod to its pre-migration state                   |
| `src/__tests__/database/online-booking.test.ts`                                                                                                  | create | DB tests for both functions, RLS and D4                  |
| `src/__tests__/database/audit-trigger-coverage.test.ts`                                                                                          | modify | Remove the `guest_booking_unit_requests` allowlist entry |
| `functions/api/admin/assign-units.ts`                                                                                                            | modify | Map the wrong-count error                                |
| `functions/api/admin/available-units.ts`                                                                                                         | modify | Conflicts from `booking_unit_availability`               |
| `src/routes/admin/bookings/$bookingId.assign-units.tsx`                                                                                          | modify | Pass Manila days; payment guard on derived status        |
| `src/types/guest-booking-multi-unit.ts`                                                                                                          | modify | Server schema takes Manila days                          |
| `functions/lib/guest-booking-data.ts`                                                                                                            | create | Build `p_booking_data` for `create_guest_booking`        |
| `functions/api/guest-booking/multi-unit.ts`                                                                                                      | modify | Use Manila days and the builder; failure copy            |
| `src/components/guest-booking/MultiUnitGuestBookingForm.tsx`                                                                                     | modify | Send Manila days                                         |
| `functions/api/admin/verify-payment.ts`                                                                                                          | modify | D1/D2                                                    |
| `src/types/booking-status.ts`, `src/types/index.ts`, `src/types/database.types.ts`                                                               | modify | `PAYMENT_STATUSES`, narrow `bookings.payment_status`     |
| `src/lib/bookings/payment.ts`                                                                                                                    | create | `isPaymentReceived`                                      |
| `functions/api/admin/pending-bookings.ts`                                                                                                        | modify | D5                                                       |
| `src/components/admin/PendingBookingsQueue.tsx`, `src/components/admin/PaymentProofViewer.tsx`, `src/routes/admin/verify-payment.$bookingId.tsx` | modify | Derived statuses                                         |
| `e2e/online-booking.spec.ts`                                                                                                                     | create | Verify → assign in the browser                           |
| `scripts/drift/baseline.txt`                                                                                                                     | modify | Remove fixed lines; move `pricing_config` line           |

---

### Task 1: `create_guest_booking` stores the whole guest booking

**Files:**

- Create: `supabase/migrations/20261013000000_online_booking.sql`
- Create: `src/__tests__/database/online-booking.test.ts`
- Modify: `src/__tests__/database/audit-trigger-coverage.test.ts:26-27`

**Interfaces:**

- Produces: `public.create_guest_booking(p_turnstile_token TEXT, p_booking_data JSONB, p_unit_requests JSONB, p_guest_data JSONB DEFAULT NULL) RETURNS JSONB` → `{"success": true, "booking": {"booking_id": uuid, "booking_reference": text}}`. `p_booking_data` keys: `booking_reference, guest_name, email, phone_number, check_in, check_out (ISO instants), special_requests, total_amount, downpayment_required, discount_percent, discount_amount, pricing_snapshot ({total, downpayment_required, unit_breakdown: [{guests, extra_person_fees, total, …}]}), payment_proof_url, idempotency_key (uuid)`. `p_unit_requests`: `[{guests_per_unit}]`.
- Produces (test helpers, reused in Task 2): `guestBookingArgs(guests: number[])`, `createGuestBooking(guests: number[]): Promise<string>` in `online-booking.test.ts`.

- [x] **Step 1: Write the failing tests**

Create `src/__tests__/database/online-booking.test.ts`:

```ts
// src/__tests__/database/online-booking.test.ts
/**
 * Online booking: create_guest_booking, assign_units_to_booking and the
 * guest_booking_unit_requests table (migration 20261013000000).
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || "http://localhost:54321";
const ANON_KEY =
  process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

// Manila 2027-03-10 14:00 to 2027-03-12 12:00 (docs/adr/0002)
const STAY = { check_in: "2027-03-10T06:00:00.000Z", check_out: "2027-03-12T04:00:00.000Z" };
const NIGHTLY_SUBTOTAL = 7000;
const EXTRA_PERSON_FEE = 500;

function guestBookingArgs(guests: number[]) {
  const unit_breakdown = guests.map((count, index) => {
    const extra = Math.max(0, count - 2) * EXTRA_PERSON_FEE * 2;
    const total = NIGHTLY_SUBTOTAL + extra;
    return {
      unit_index: index + 1,
      guests: count,
      subtotal: NIGHTLY_SUBTOTAL,
      extra_person_fees: extra,
      total,
      downpayment: total / 2,
    };
  });
  const total = unit_breakdown.reduce((sum, unit) => sum + unit.total, 0);

  return {
    p_turnstile_token: "test-token",
    p_booking_data: {
      booking_reference: `TB-OB-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
      guest_name: "Online Test Guest",
      email: "online-guest-test@example.com",
      phone_number: "+639171234567",
      ...STAY,
      special_requests: null,
      total_amount: total,
      downpayment_required: total / 2,
      discount_percent: null,
      discount_amount: null,
      pricing_snapshot: { total, downpayment_required: total / 2, unit_breakdown },
      payment_proof_url: "TEMP-test_1.png",
      idempotency_key: crypto.randomUUID(),
    },
    p_unit_requests: guests.map((count) => ({ guests_per_unit: count })),
    p_guest_data: null,
  };
}

async function createGuestBooking(guests: number[]): Promise<string> {
  const { data, error } = await supabase.rpc("create_guest_booking", guestBookingArgs(guests));
  if (error) throw error;
  return (data as { booking: { booking_id: string } }).booking.booking_id;
}

describe("create_guest_booking", () => {
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

  it("stores a pending guest booking with its cabin requests and pricing", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2, 4]);

    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        "is_guest_booking, unit_assignment_status, requested_unit_count, unit_count, num_guests, total_amount, downpayment_required, pricing_snapshot, payment_proof_url, payment_status, booking_status, check_in, guest_booking_unit_requests(guests_per_unit)"
      )
      .eq("booking_id", bookingId)
      .single();
    expect(error).toBeNull();

    expect(booking).toMatchObject({
      is_guest_booking: true,
      unit_assignment_status: "pending",
      requested_unit_count: 2,
      unit_count: 2,
      num_guests: 6,
      total_amount: 15000,
      downpayment_required: 7500,
      payment_proof_url: "TEMP-test_1.png",
      payment_status: "Pending",
      booking_status: "Pending",
    });
    expect(new Date(booking!.check_in).toISOString()).toBe(STAY.check_in);
    expect((booking!.pricing_snapshot as { total: number }).total).toBe(15000);
    expect(booking!.guest_booking_unit_requests.map((r) => r.guests_per_unit).sort()).toEqual([
      2, 4,
    ]);
  });

  it("records the idempotency key against the booking", async () => {
    if (!shouldRun) return;
    const args = guestBookingArgs([2]);
    const { data, error } = await supabase.rpc("create_guest_booking", args);
    expect(error).toBeNull();

    const { data: key } = await supabase
      .from("idempotency_keys")
      .select("booking_id")
      .eq("key", args.p_booking_data.idempotency_key)
      .single();
    expect(key?.booking_id).toBe((data as { booking: { booking_id: string } }).booking.booking_id);
  });

  it("refuses an empty cabin list", async () => {
    if (!shouldRun) return;
    const args = { ...guestBookingArgs([2]), p_unit_requests: [] };

    const { error } = await supabase.rpc("create_guest_booking", args);
    expect(error?.message).toMatch(/between 1 and 10 cabins/);
  });

  it("refuses to run for the anon key", async () => {
    if (!shouldRun) return;
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { data, error } = await anon.rpc("create_guest_booking", guestBookingArgs([2]));
    expect(data).toBeNull();
    expect(error?.message).toMatch(/permission denied/);
  });

  it("hides cabin requests from the anon key", async () => {
    if (!shouldRun) return;
    await createGuestBooking([2]);
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { data } = await anon.from("guest_booking_unit_requests").select("id");
    expect(data ?? []).toEqual([]);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/database/online-booking.test.ts`
Expected: FAIL. "stores a pending guest booking" fails on `requested_unit_count` (null) / missing unit requests; "records the idempotency key" fails (no row); "refuses an empty cabin list" fails on the message (`At least one unit request is required`); "refuses to run for the anon key" fails (anon can execute today). "hides cabin requests" may pass already (no rows written).

- [x] **Step 3: Write the migration (part 1)**

Create `supabase/migrations/20261013000000_online_booking.sql`:

```sql
-- supabase/migrations/20261013000000_online_booking.sql
-- Online booking: a guest requests cabins, staff verify the downpayment, then assign cabins
-- (docs/plans/2026-10-12-online-booking-restore.md). Idempotent: local has most of these
-- objects from 20251028154441 / 20251104184719, prod has none of them.
-- 1. bookings: unit_assignment_status, requested_unit_count, downpayment_required, discount_percent.
-- 2. guest_booking_unit_requests: one row per requested cabin, staff-readable, audited.
-- 3. create_guest_booking: stores the requests, pricing, proof and idempotency key;
--    executable by service_role only (the Worker).
-- 4. assign_units_to_booking: writes booking_units and availability after the downpayment.
-- 5. Drops the unfinished objects nothing calls.

BEGIN;

-- 1. bookings columns (NULL for staff-made bookings)
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS unit_assignment_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS requested_unit_count INTEGER,
    ADD COLUMN IF NOT EXISTS downpayment_required NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2);

ALTER TABLE public.bookings
    ALTER COLUMN unit_assignment_status DROP DEFAULT,
    ALTER COLUMN requested_unit_count DROP DEFAULT;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_unit_assignment_status_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_unit_assignment_status_check
    CHECK (unit_assignment_status IN ('pending', 'assigned'));

-- 2. guest_booking_unit_requests
CREATE TABLE IF NOT EXISTS public.guest_booking_unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(booking_id) ON DELETE CASCADE,
    guests_per_unit INTEGER NOT NULL CHECK (guests_per_unit > 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.guest_booking_unit_requests
    DROP COLUMN IF EXISTS unit_type,
    DROP COLUMN IF EXISTS quantity,
    DROP COLUMN IF EXISTS special_requests;

DROP INDEX IF EXISTS public.idx_guest_booking_requests_booking;
CREATE INDEX IF NOT EXISTS idx_guest_booking_unit_requests_booking_id
    ON public.guest_booking_unit_requests (booking_id);

ALTER TABLE public.guest_booking_unit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS authenticated_users_read_unit_requests ON public.guest_booking_unit_requests;
DROP POLICY IF EXISTS guest_booking_requests_insert_policy ON public.guest_booking_unit_requests;
DROP POLICY IF EXISTS guest_booking_requests_select_policy ON public.guest_booking_unit_requests;
DROP POLICY IF EXISTS guest_booking_unit_requests_select_staff ON public.guest_booking_unit_requests;
CREATE POLICY guest_booking_unit_requests_select_staff ON public.guest_booking_unit_requests
    FOR SELECT TO authenticated USING (public.is_staff_or_above());

DROP TRIGGER IF EXISTS audit_guest_booking_unit_requests_trigger ON public.guest_booking_unit_requests;
CREATE TRIGGER audit_guest_booking_unit_requests_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.guest_booking_unit_requests
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- 3. create_guest_booking. The Worker verifies the Turnstile token; p_turnstile_token and
-- p_guest_data stay only so the caller's signature does not change.
CREATE OR REPLACE FUNCTION public.create_guest_booking(
    p_turnstile_token TEXT,
    p_booking_data JSONB,
    p_unit_requests JSONB,
    p_guest_data JSONB DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_email TEXT := lower(p_booking_data->>'email');
    v_unit_count INTEGER;
    v_guest_id UUID;
    v_booking_id UUID;
    v_booking_reference TEXT;
BEGIN
    IF jsonb_typeof(p_unit_requests) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'unit_requests must be an array';
    END IF;

    v_unit_count := jsonb_array_length(p_unit_requests);
    IF v_unit_count NOT BETWEEN 1 AND 10 THEN
        RAISE EXCEPTION 'Book between 1 and 10 cabins';
    END IF;

    INSERT INTO public.guests (guest_name, email, phone_number)
    VALUES (p_booking_data->>'guest_name', v_email, p_booking_data->>'phone_number')
    ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING guest_id INTO v_guest_id;

    INSERT INTO public.bookings (
        booking_reference, guest_id, guest_name, contact_number, email,
        check_in, check_out, num_guests, special_requests,
        total_amount, downpayment_required, discount_percent, discount_amount, pricing_snapshot,
        payment_proof_url, booking_status,
        is_guest_booking, is_multi_unit, unit_count, requested_unit_count, unit_assignment_status
    ) VALUES (
        p_booking_data->>'booking_reference',
        v_guest_id,
        p_booking_data->>'guest_name',
        p_booking_data->>'phone_number',
        v_email,
        (p_booking_data->>'check_in')::TIMESTAMPTZ,
        (p_booking_data->>'check_out')::TIMESTAMPTZ,
        (SELECT SUM((request->>'guests_per_unit')::INTEGER) FROM jsonb_array_elements(p_unit_requests) AS request),
        p_booking_data->>'special_requests',
        (p_booking_data->>'total_amount')::NUMERIC,
        (p_booking_data->>'downpayment_required')::NUMERIC,
        (p_booking_data->>'discount_percent')::NUMERIC,
        (p_booking_data->>'discount_amount')::NUMERIC,
        p_booking_data->'pricing_snapshot',
        p_booking_data->>'payment_proof_url',
        'Pending',
        TRUE,
        v_unit_count > 1,
        v_unit_count,
        v_unit_count,
        'pending'
    ) RETURNING booking_id, booking_reference INTO v_booking_id, v_booking_reference;

    INSERT INTO public.guest_booking_unit_requests (booking_id, guests_per_unit)
    SELECT v_booking_id, (request->>'guests_per_unit')::INTEGER
    FROM jsonb_array_elements(p_unit_requests) AS request;

    IF p_booking_data ? 'idempotency_key' THEN
        INSERT INTO public.idempotency_keys (key, booking_id)
        VALUES ((p_booking_data->>'idempotency_key')::UUID, v_booking_id)
        ON CONFLICT (key) DO UPDATE
        SET booking_id = EXCLUDED.booking_id, created_at = now(), expires_at = now() + INTERVAL '48 hours';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'booking', jsonb_build_object('booking_id', v_booking_id, 'booking_reference', v_booking_reference)
    );
END;
$$ LANGUAGE plpgsql SET search_path = '';

REVOKE ALL ON FUNCTION public.create_guest_booking(TEXT, JSONB, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_booking(TEXT, JSONB, JSONB, JSONB) TO service_role;

COMMIT;
```

`CREATE OR REPLACE` resets every property it does not state (Postgres keeps only owner and grants), so the local function loses `SECURITY DEFINER` here. The Worker calls it with the service role, which bypasses RLS, so it does not need definer rights.

- [x] **Step 4: Remove the audit allowlist entry**

In `src/__tests__/database/audit-trigger-coverage.test.ts`, delete these two lines from `UNAUDITED_TABLES`:

```ts
  guest_booking_unit_requests:
    "online booking flow, absent in prod and deferred (plan 2026-10-03, Decisions & Deferrals)",
```

- [x] **Step 5: Apply the migration and run the tests**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/migrations/20261013000000_online_booking.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/migrations/20261013000000_online_booking.sql
npx vitest run src/__tests__/database/online-booking.test.ts src/__tests__/database/audit-trigger-coverage.test.ts
```

Expected: both `psql` runs end with `COMMIT` (the second proves idempotency); all tests PASS. If `ALTER TABLE … ADD CONSTRAINT bookings_unit_assignment_status_check` fails, list offending rows with `select booking_id, unit_assignment_status from bookings where unit_assignment_status not in ('pending','assigned')` and stop: report them, do not delete data.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20261013000000_online_booking.sql src/__tests__/database/online-booking.test.ts src/__tests__/database/audit-trigger-coverage.test.ts
git commit -m "feat(db): store full guest bookings in create_guest_booking"
```

---

### Task 2: `assign_units_to_booking` writes cabins and availability

**Files:**

- Modify: `supabase/migrations/20261013000000_online_booking.sql` (insert part 2 before `COMMIT;`)
- Modify: `src/__tests__/database/online-booking.test.ts` (append)
- Modify: `functions/api/admin/assign-units.ts` (`parseRpcError`)
- Modify: `src/__tests__/api/admin-assign-units.test.ts` (append)

**Interfaces:**

- Consumes: `createGuestBooking(guests)` from Task 1's test file.
- Produces: `public.assign_units_to_booking(p_booking_id UUID, p_unit_ids UUID[]) RETURNS VOID`. Error messages (matched by `parseRpcError`): `Booking <id> not found or not in pending state`, `Payment must be verified before unit assignment (payment status: <status>)`, `Must assign exactly <n> cabins, got <m>`; a taken cabin raises SQLSTATE `23P01` (`conflicting key value violates exclusion constraint …`).

- [x] **Step 1: Write the failing DB tests**

Add `createTestBooking, createTestUnit` to the `../setup/test-db` import in `online-booking.test.ts`, then append:

```ts
async function payDownpayment(bookingId: string) {
  const { data: booking } = await supabase
    .from("bookings")
    .select("downpayment_required")
    .eq("booking_id", bookingId)
    .single();
  const { error } = await supabase
    .from("payments")
    .insert({ booking_id: bookingId, amount: booking!.downpayment_required!, status: "Active" });
  if (error) throw error;
}

async function bookingState(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "unit_assignment_status, booking_status, payment_status, total_amount, num_guests, booking_units(unit_id, unit_price, extra_person_charge, subtotal, assigned_guests), booking_unit_availability(unit_id, check_in, check_out, booking_status)"
    )
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data;
}

describe("assign_units_to_booking", () => {
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

  it("refuses before the downpayment is recorded", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    const unit = await createTestUnit();

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(error?.message).toMatch(/Payment must be verified/);
  });

  it("assigns cabins at the quoted prices and blocks their dates", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2, 4]);
    await payDownpayment(bookingId);
    const [first, second] = [await createTestUnit(), await createTestUnit()];

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [first.unit_id, second.unit_id],
    });
    expect(error).toBeNull();

    const state = await bookingState(bookingId);
    expect(state).toMatchObject({
      unit_assignment_status: "assigned",
      booking_status: "Confirmed",
      payment_status: "Partial",
      total_amount: 15000,
      num_guests: 6,
    });
    const units = [...state.booking_units].sort((a, b) => a.subtotal - b.subtotal);
    expect(units).toEqual([
      {
        unit_id: first.unit_id,
        unit_price: 7000,
        extra_person_charge: 0,
        subtotal: 7000,
        assigned_guests: 2,
      },
      {
        unit_id: second.unit_id,
        unit_price: 7000,
        extra_person_charge: 1000,
        subtotal: 8000,
        assigned_guests: 4,
      },
    ]);
    expect(state.booking_unit_availability).toHaveLength(2);
    for (const row of state.booking_unit_availability) {
      expect(row.booking_status).toBe("Confirmed");
      expect(new Date(row.check_in).toISOString()).toBe(STAY.check_in);
      expect(new Date(row.check_out).toISOString()).toBe(STAY.check_out);
    }
  });

  it("refuses the wrong number of cabins and writes nothing", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2, 2]);
    await payDownpayment(bookingId);
    const unit = await createTestUnit();

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(error?.message).toMatch(/Must assign exactly 2 cabins, got 1/);
    const state = await bookingState(bookingId);
    expect(state.unit_assignment_status).toBe("pending");
    expect(state.booking_units).toEqual([]);
  });

  it("refuses a cabin already booked for those dates and writes nothing", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    await createTestBooking({
      unit,
      check_in: new Date(STAY.check_in),
      check_out: new Date(STAY.check_out),
    });
    const bookingId = await createGuestBooking([2]);
    await payDownpayment(bookingId);

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });
    expect(error?.code).toBe("23P01");
    const state = await bookingState(bookingId);
    expect(state.unit_assignment_status).toBe("pending");
    expect(state.booking_units).toEqual([]);
    expect(state.booking_unit_availability).toEqual([]);
  });

  it("refuses a second assignment", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    await payDownpayment(bookingId);
    const [first, second] = [await createTestUnit(), await createTestUnit()];
    await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [first.unit_id],
    });

    const { error } = await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [second.unit_id],
    });
    expect(error?.message).toMatch(/not found or not in pending state/);
  });

  it("lets staff delete the payment of an assigned booking (D4)", async () => {
    if (!shouldRun) return;
    const bookingId = await createGuestBooking([2]);
    await payDownpayment(bookingId);
    const unit = await createTestUnit();
    await supabase.rpc("assign_units_to_booking", {
      p_booking_id: bookingId,
      p_unit_ids: [unit.unit_id],
    });

    const { error } = await supabase.from("payments").delete().eq("booking_id", bookingId);
    expect(error).toBeNull();
    expect((await bookingState(bookingId)).payment_status).toBe("Pending");
  });

  it("refuses to run for the anon key", async () => {
    if (!shouldRun) return;
    const anon = createClient(SUPABASE_URL, ANON_KEY);

    const { error } = await anon.rpc("assign_units_to_booking", {
      p_booking_id: crypto.randomUUID(),
      p_unit_ids: [crypto.randomUUID()],
    });
    expect(error?.message).toMatch(/permission denied/);
  });
});
```

- [x] **Step 2: Write the failing endpoint test**

Append to `src/__tests__/api/admin-assign-units.test.ts`, inside the existing `describe`:

```ts
it("maps a wrong cabin count to 400", async () => {
  rpcError = { message: "Must assign exactly 2 cabins, got 1", code: "P0001" };

  const response = await assignUnits();

  expect(response.status).toBe(400);
  const body = (await response.json()) as { error: string; details: string };
  expect(body.error).toBe("Wrong number of cabins");
  expect(body.details).toBe("Must assign exactly 2 cabins, got 1");
});
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/database/online-booking.test.ts src/__tests__/api/admin-assign-units.test.ts`
Expected: FAIL. The old function reads `bookings.check_in_date` (`column "check_in_date" does not exist` inside `Assignment failed: …`), anon can still execute it, and the endpoint maps the count error to 500.

- [x] **Step 4: Write the migration (part 2)**

In `20261013000000_online_booking.sql`, insert before `COMMIT;`:

```sql
-- 4. assign_units_to_booking. Each cabin takes the price the guest was quoted for the
-- request in the same position (pricing_snapshot.unit_breakdown). booking_units triggers
-- recompute total_amount and num_guests from these rows, so the sums must match the quote.
-- Availability rows are written as Confirmed so the exclusion constraint rejects a taken cabin.
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS payment_before_assignment;

CREATE OR REPLACE FUNCTION public.assign_units_to_booking(p_booking_id UUID, p_unit_ids UUID[])
RETURNS VOID AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_unit_count INTEGER := COALESCE(array_length(p_unit_ids, 1), 0);
    v_quote JSONB;
    v_position INTEGER;
    v_subtotal NUMERIC(10,2);
    v_extra NUMERIC(10,2);
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE booking_id = p_booking_id
      AND is_guest_booking
      AND unit_assignment_status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking % not found or not in pending state', p_booking_id;
    END IF;

    IF v_booking.payment_status NOT IN ('Partial', 'Completed') THEN
        RAISE EXCEPTION 'Payment must be verified before unit assignment (payment status: %)',
            v_booking.payment_status;
    END IF;

    IF v_unit_count <> v_booking.requested_unit_count THEN
        RAISE EXCEPTION 'Must assign exactly % cabins, got %', v_booking.requested_unit_count, v_unit_count;
    END IF;

    FOR v_position IN 1..v_unit_count LOOP
        v_quote := v_booking.pricing_snapshot->'unit_breakdown'->(v_position - 1);
        IF v_quote IS NULL THEN
            RAISE EXCEPTION 'Booking % has no quoted price for cabin %', p_booking_id, v_position;
        END IF;
        v_subtotal := round((v_quote->>'total')::NUMERIC, 2);
        v_extra := round((v_quote->>'extra_person_fees')::NUMERIC, 2);

        INSERT INTO public.booking_units (
            booking_id, unit_id, unit_price, extra_person_charge, subtotal, assigned_guests
        ) VALUES (
            p_booking_id, p_unit_ids[v_position], v_subtotal - v_extra, v_extra, v_subtotal,
            (v_quote->>'guests')::INTEGER
        );

        INSERT INTO public.booking_unit_availability (
            unit_id, booking_id, check_in, check_out, booking_status
        ) VALUES (
            p_unit_ids[v_position], p_booking_id, v_booking.check_in, v_booking.check_out, 'Confirmed'
        );
    END LOOP;

    UPDATE public.bookings
    SET unit_assignment_status = 'assigned', booking_status = 'Confirmed'
    WHERE booking_id = p_booking_id;
END;
$$ LANGUAGE plpgsql SET search_path = '';

REVOKE ALL ON FUNCTION public.assign_units_to_booking(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_units_to_booking(UUID, UUID[]) TO service_role;
```

`CREATE OR REPLACE` drops the local function's old `SET statement_timeout TO '5s'` (unstated properties reset); Step 6 checks that.

- [x] **Step 5: Map the count error in the endpoint**

In `functions/api/admin/assign-units.ts`, inside `parseRpcError`, add after the `"Payment must be verified"` branch:

```ts
if (errorMessage.includes("Must assign exactly")) {
  return {
    status: 400,
    message: "Wrong number of cabins",
    details: errorMessage,
  };
}
```

- [x] **Step 6: Apply and run the tests**

Run:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/migrations/20261013000000_online_booking.sql
npx vitest run src/__tests__/database/online-booking.test.ts src/__tests__/api/admin-assign-units.test.ts
```

Expected: `COMMIT`; all tests PASS. Check `psql … -XAt -c "select proconfig from pg_proc where proname='assign_units_to_booking'"` prints `{search_path=""}` only.

- [x] **Step 7: Commit**

```bash
git add supabase/migrations/20261013000000_online_booking.sql src/__tests__/database/online-booking.test.ts functions/api/admin/assign-units.ts src/__tests__/api/admin-assign-units.test.ts
git commit -m "feat(db): assign guest booking cabins with availability rows"
```

---

### Task 3: Available cabins come from `booking_unit_availability`

**Files:**

- Modify: `functions/api/admin/available-units.ts:221-229`
- Modify: `src/__tests__/api/admin-available-units.test.ts`
- Modify: `src/routes/admin/bookings/$bookingId.assign-units.tsx:443-449`

**Interfaces:**

- Consumes: `toStayInstants(checkInDay, checkOutDay)` and `manilaDayOf(instant)` from `@/lib/bookings/stay`.
- Produces: `GET /api/admin/available-units?check_in_date=YYYY-MM-DD&check_out_date=YYYY-MM-DD` (Manila days, unchanged contract) excludes cabins with a `Confirmed`/`CheckedIn` availability row overlapping the stay.

- [x] **Step 1: Rewrite the test's booked-rows fake**

In `src/__tests__/api/admin-available-units.test.ts`, replace the block from `type BookedRow` through the end of `bookingUnitsQuery` and the `fakeSupabase` definition with:

```ts
type BookedRow = { unit_id: string; booking_status: string };
let bookedRows: BookedRow[] = [];
let overlapBounds: { lt?: [string, string]; gt?: [string, string] } = {};

// Overlapping booking_unit_availability rows; applies the status filter and records the bounds.
function availabilityQuery() {
  let rows = bookedRows;
  const query = {
    select: () => query,
    in: (column: string, values: string[]) => {
      rows = rows.filter((row) => values.includes(row[column as keyof BookedRow]));
      return query;
    },
    lt: (column: string, value: string) => {
      overlapBounds.lt = [column, value];
      return query;
    },
    gt: async (column: string, value: string) => {
      overlapBounds.gt = [column, value];
      return { data: rows.map(({ unit_id }) => ({ unit_id })), error: null };
    },
  };
  return query;
}

const fakeSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: "staff-1" } }, error: null }) },
  from: (table: string) => {
    if (table === "units") return unitsQuery();
    if (table === "booking_unit_availability") return availabilityQuery();
    throw new Error(`unexpected table ${table}`);
  },
};
```

In `beforeEach`, add `overlapBounds = {};` after `bookedRows = [];`. Replace the `it.each` and the "cancelled" test with:

```ts
it.each(["Confirmed", "CheckedIn"])(
  "excludes a unit with an overlapping %s stay",
  async (status) => {
    bookedRows = [{ unit_id: "unit-1", booking_status: status }];

    const response = await getAvailableUnits();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { units: unknown[] };
    expect(body.units).toEqual([]);
  }
);

it("keeps a unit whose overlapping booking is still Pending", async () => {
  bookedRows = [{ unit_id: "unit-1", booking_status: "Pending" }];

  const response = await getAvailableUnits();

  const body = (await response.json()) as { units: unknown[] };
  expect(body.units).toHaveLength(1);
});

it("compares against the stay at 14:00 / 12:00 Manila", async () => {
  await getAvailableUnits();

  expect(overlapBounds.lt).toEqual(["check_in", "2026-12-22T04:00:00.000Z"]);
  expect(overlapBounds.gt).toEqual(["check_out", "2026-12-20T06:00:00.000Z"]);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/api/admin-available-units.test.ts`
Expected: FAIL with `unexpected table booking_units`.

- [x] **Step 3: Query availability rows**

In `functions/api/admin/available-units.ts`, add the import `import { toStayInstants } from "@/lib/bookings/stay";` with the other imports, and replace the `bookedUnits` query (the comment above it included) with:

```ts
// A cabin is taken when a Confirmed or CheckedIn stay overlaps [check-in, check-out)
const stay = toStayInstants(checkInDate, checkOutDate);
const { data: bookedUnits, error: bookingsError } = await supabase
  .from("booking_unit_availability")
  .select("unit_id")
  .in("booking_status", ["Confirmed", "CheckedIn"])
  .lt("check_in", stay.check_out)
  .gt("check_out", stay.check_in);
```

- [x] **Step 4: Pass Manila days from the assign page**

In `src/routes/admin/bookings/$bookingId.assign-units.tsx`, add `import { manilaDayOf } from "@/lib/bookings";` and change the `UnitAssignmentInterface` props:

```tsx
        checkInDate={manilaDayOf(booking.check_in)}
        checkOutDate={manilaDayOf(booking.check_out)}
```

- [x] **Step 5: Run the tests**

Run: `npx vitest run src/__tests__/api/admin-available-units.test.ts && npm run type-check`
Expected: PASS; type-check exits 0.

- [x] **Step 6: Commit**

```bash
git add functions/api/admin/available-units.ts src/__tests__/api/admin-available-units.test.ts 'src/routes/admin/bookings/$bookingId.assign-units.tsx'
git commit -m "fix(admin): read cabin conflicts from booking_unit_availability"
```

---

### Task 4: Drop the unfinished objects, rollback, types

**Files:**

- Modify: `supabase/migrations/20261013000000_online_booking.sql` (part 3 before `COMMIT;`)
- Create: `supabase/rollbacks/20261013000000_rollback_online_booking.sql`
- Modify: `src/types/database.generated.ts` (generated)

**Interfaces:**

- Produces: `booking_units` without `check_in_date`, `check_out_date`, `status`; no `calculate_booking_pricing`, `check_units_available_for_booking`, `create_guest_booking(jsonb,jsonb,jsonb,uuid)`, `authenticated_users_insert_booking_units`.

- [x] **Step 1: Confirm nothing else reads the dropped columns**

Run: `grep -rn "check_in_date\|check_out_date" functions src --include='*.ts' --include='*.tsx' | grep -v database.generated | grep -v __tests__`
Expected: only query-string/prop names (`available-units.ts` params, `UnitAssignmentInterface.tsx`, `PendingBookingsQueue.tsx`, `urgency-scoring.ts`, `usePricingCalculation.ts`, `guest-booking/multi-unit.ts` comments), none selecting `booking_units` columns. If a `.from("booking_units")` query names them, stop and report.

- [x] **Step 2: Write the migration (part 3)**

Insert before `COMMIT;`:

```sql
-- 5. Unfinished objects nothing calls (local only; prod never had them)
DROP FUNCTION IF EXISTS public.create_guest_booking(JSONB, JSONB, JSONB, UUID);
DROP FUNCTION IF EXISTS public.calculate_booking_pricing(JSONB, DATE, DATE);
DROP FUNCTION IF EXISTS public.check_units_available_for_booking(UUID, UUID[]);

-- Let any signed-in user add booking_units to any booking; booking_units_insert_staff covers staff.
DROP POLICY IF EXISTS authenticated_users_insert_booking_units ON public.booking_units;

-- Always NULL; booking_unit_availability is the overlap guard (20261011120000).
DROP INDEX IF EXISTS public.idx_booking_units_dates_status;
ALTER TABLE public.booking_units
    DROP COLUMN IF EXISTS check_in_date,
    DROP COLUMN IF EXISTS check_out_date,
    DROP COLUMN IF EXISTS status;

DROP INDEX IF EXISTS public.idx_bookings_assignment_pending;
DROP INDEX IF EXISTS public.idx_bookings_assignment_status;
DROP INDEX IF EXISTS public.idx_bookings_multi_unit;
```

- [x] **Step 3: Write the rollback**

Create `supabase/rollbacks/20261013000000_rollback_online_booking.sql`:

```sql
-- ============================================
-- ROLLBACK for 20261013000000_online_booking.sql
-- ============================================
-- Returns prod to its state before the migration (prod had none of these objects).
-- Deletes guest booking data: export guest_booking_unit_requests and the four bookings
-- columns first if any real guest booking exists. Local: use `supabase db reset` instead.
-- ============================================

BEGIN;

DROP FUNCTION IF EXISTS public.assign_units_to_booking(UUID, UUID[]);
DROP FUNCTION IF EXISTS public.create_guest_booking(TEXT, JSONB, JSONB, JSONB);
DROP TABLE IF EXISTS public.guest_booking_unit_requests;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_unit_assignment_status_check;
ALTER TABLE public.bookings
    DROP COLUMN IF EXISTS unit_assignment_status,
    DROP COLUMN IF EXISTS requested_unit_count,
    DROP COLUMN IF EXISTS downpayment_required,
    DROP COLUMN IF EXISTS discount_percent;

COMMIT;
```

- [x] **Step 4: Clean apply, regenerate types, run the DB suite**

Run:

```bash
supabase db reset
npm run gen:types
npm run test:db
npm run type-check
```

Expected: `db reset` finishes with `Finished supabase db reset`; `test:db` all PASS (paste the summary line); type-check exits 0. `git diff --stat src/types/database.generated.ts` shows the changed tables/functions only. If type-check fails on a dropped column, fix the caller in this task.

- [x] **Step 5: Lint the schema**

Run: `supabase db lint --local --schema public -o json | grep -E 'create_guest_booking|assign_units_to_booking|calculate_booking_pricing|check_units_available' || echo "no lint findings for these functions"`
Expected: the second command prints `no lint findings for these functions`.

- [x] **Step 6: Commit**

```bash
git add supabase/migrations/20261013000000_online_booking.sql supabase/rollbacks/20261013000000_rollback_online_booking.sql src/types/database.generated.ts
git commit -m "feat(db): drop unfinished online booking objects"
```

---

### Task 5: Guest booking endpoint sends Manila days, proof and idempotency key

**Files:**

- Create: `functions/lib/guest-booking-data.ts`
- Create: `src/__tests__/api/guest-booking-data.test.ts`
- Modify: `src/types/guest-booking-multi-unit.ts:32-58`
- Modify: `functions/api/guest-booking/multi-unit.ts` (pricing dates, RPC args, default error copy)
- Modify: `src/components/guest-booking/MultiUnitGuestBookingForm.tsx:211-219`

**Interfaces:**

- Consumes: `create_guest_booking` `p_booking_data` keys (Task 1); `toStayInstants`, `isManilaDay`, `manilaDayOf`, `pickedDay` from `@/lib/bookings/stay`.
- Produces: `toGuestBookingData(input: GuestBookingDataInput): Json`.

- [x] **Step 1: Write the failing test**

Create `src/__tests__/api/guest-booking-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { multiUnitBookingSchema } from "@/types/guest-booking-multi-unit";

import { toGuestBookingData } from "../../../functions/lib/guest-booking-data";

const pricing = {
  total: 7000,
  downpayment_required: 3500,
  discount: null,
  unit_breakdown: [
    {
      unit_index: 1,
      guests: 2,
      subtotal: 7000,
      extra_person_fees: 0,
      total: 7000,
      downpayment: 3500,
    },
  ],
};

describe("toGuestBookingData", () => {
  it("stores the stay as Manila 14:00 / 12:00 with the proof and idempotency key", () => {
    const data = toGuestBookingData({
      bookingReference: "BK-202703-ABC123",
      guestName: "Ana Cruz",
      email: "ana@example.com",
      phoneNumber: "+639171234567",
      checkInDay: "2027-03-10",
      checkOutDay: "2027-03-12",
      numGuests: 2,
      specialRequests: null,
      pricing,
      paymentProofUrl: "TEMP-abc_1.png",
      idempotencyKey: "4b7f0c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
    });

    expect(data).toMatchObject({
      check_in: "2027-03-10T06:00:00.000Z",
      check_out: "2027-03-12T04:00:00.000Z",
      total_amount: 7000,
      downpayment_required: 3500,
      discount_percent: null,
      discount_amount: null,
      pricing_snapshot: pricing,
      payment_proof_url: "TEMP-abc_1.png",
      idempotency_key: "4b7f0c1e-1d2a-4c3b-9e8f-0a1b2c3d4e5f",
    });
  });
});

describe("multiUnitBookingSchema stay days", () => {
  const base = {
    guest_name: "Ana Cruz",
    email: "ana@example.com",
    phone_number: "+639171234567",
    unit_requests: [{ guests_per_unit: 2 }],
    turnstile_token: "token",
    terms_accepted: true,
  };

  it("accepts Manila days", () => {
    const result = multiUnitBookingSchema.safeParse({
      ...base,
      check_in: "2099-03-10",
      check_out: "2099-03-12",
    });
    expect(result.success).toBe(true);
  });

  it("rejects instants", () => {
    const result = multiUnitBookingSchema.safeParse({
      ...base,
      check_in: "2099-03-09T16:00:00.000Z",
      check_out: "2099-03-11T16:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/__tests__/api/guest-booking-data.test.ts`
Expected: FAIL with `Failed to resolve import "../../../functions/lib/guest-booking-data"`.

- [x] **Step 3: Write the builder**

Create `functions/lib/guest-booking-data.ts`:

```ts
import { toStayInstants, type ManilaDay } from "@/lib/bookings/stay";
import type { Json } from "@/types/database.types";

export interface GuestBookingDataInput {
  bookingReference: string;
  guestName: string;
  email: string;
  phoneNumber: string;
  checkInDay: ManilaDay;
  checkOutDay: ManilaDay;
  numGuests: number;
  specialRequests: string | null;
  pricing: {
    total: number;
    downpayment_required: number;
    discount: { percent: number; amount: number } | null;
  };
  paymentProofUrl: string | null;
  idempotencyKey: string;
}

/** p_booking_data for create_guest_booking. */
export function toGuestBookingData(input: GuestBookingDataInput): Json {
  const stay = toStayInstants(input.checkInDay, input.checkOutDay);
  return {
    booking_reference: input.bookingReference,
    guest_name: input.guestName,
    email: input.email,
    phone_number: input.phoneNumber,
    check_in: stay.check_in,
    check_out: stay.check_out,
    num_guests: input.numGuests,
    special_requests: input.specialRequests,
    total_amount: input.pricing.total,
    downpayment_required: input.pricing.downpayment_required,
    discount_percent: input.pricing.discount?.percent ?? null,
    discount_amount: input.pricing.discount?.amount ?? null,
    pricing_snapshot: input.pricing as unknown as Json,
    payment_proof_url: input.paymentProofUrl,
    idempotency_key: input.idempotencyKey,
  };
}
```

- [x] **Step 4: Take Manila days in the server schema**

In `src/types/guest-booking-multi-unit.ts`, add `import { isManilaDay, manilaDayOf } from "@/lib/bookings/stay";` and replace the `check_in` / `check_out` fields and the trailing `.refine` with:

```ts
    check_in: z
      .string()
      .refine(isManilaDay, "Expected a YYYY-MM-DD day")
      .refine((day) => day >= manilaDayOf(new Date()), "Check-in must be today or in the future"),
    check_out: z.string().refine(isManilaDay, "Expected a YYYY-MM-DD day"),
```

```ts
  .refine((data) => data.check_out > data.check_in, {
    message: "Check-out must be after check-in",
    path: ["check_out"],
  });
```

- [x] **Step 5: Use the days and the builder in the endpoint**

In `functions/api/guest-booking/multi-unit.ts`:

1. Add imports: `import { toStayInstants } from "@/lib/bookings/stay";` and `import { toGuestBookingData } from "../../lib/guest-booking-data";`.
2. Replace `const checkIn = new Date(data.check_in);` / `const checkOut = new Date(data.check_out);` with:
   ```ts
   const stay = toStayInstants(data.check_in, data.check_out);
   const checkIn = new Date(stay.check_in);
   const checkOut = new Date(stay.check_out);
   ```
3. Replace the whole `p_booking_data: { … },` object in the `create_guest_booking` call with:
   ```ts
      p_booking_data: toGuestBookingData({
        bookingReference,
        guestName: sanitizedData.guest_name,
        email: data.email,
        phoneNumber: data.phone_number,
        checkInDay: data.check_in,
        checkOutDay: data.check_out,
        numGuests: totalGuests,
        specialRequests: sanitizedData.special_requests || null,
        pricing,
        paymentProofUrl: data.payment_proof_url ?? null,
        idempotencyKey,
      }),
   ```
4. Change the default failure copy (4b) from `"Booking creation failed. Please try again."` to `"Your booking was not saved. Nothing was charged; please try again."`, and in the outer `catch` change `"Booking creation failed. Please try again later."` to `"Your booking was not saved. Please try again later."`.

- [x] **Step 6: Send Manila days from the form**

In `src/components/guest-booking/MultiUnitGuestBookingForm.tsx`, add `import { pickedDay } from "@/lib/bookings/stay";` and in the `payload`:

```ts
        check_in: pickedDay(data.check_in),
        check_out: pickedDay(data.check_out),
```

- [x] **Step 7: Run the tests and checks**

Run: `npx vitest run src/__tests__/api/guest-booking-data.test.ts src/components/guest-booking && npm run type-check && npm run lint`
Expected: PASS; type-check and lint exit 0.

- [x] **Step 8: Commit**

```bash
git add functions/lib/guest-booking-data.ts src/__tests__/api/guest-booking-data.test.ts src/types/guest-booking-multi-unit.ts functions/api/guest-booking/multi-unit.ts src/components/guest-booking/MultiUnitGuestBookingForm.tsx
git commit -m "fix(guest-booking): send Manila days, proof and idempotency key"
```

---

### Task 6: Verify records the downpayment; Reject writes nothing (D1, D2)

**Files:**

- Modify: `src/types/booking-status.ts`, `src/types/index.ts:3,48-50`, `src/types/database.types.ts:14-20`
- Create: `src/__tests__/architecture/payment-status-parity.test.ts`
- Modify: `functions/api/admin/verify-payment.ts:195-327`
- Create: `src/__tests__/api/admin-verify-payment.test.ts`

**Interfaces:**

- Produces: `PAYMENT_STATUSES`, `type PaymentStatus` exported from `src/types/booking-status.ts` and re-exported from `@/types`. `bookings.payment_status` typed `PaymentStatus`.
- Produces: `POST /api/admin/verify-payment` → 200 `{ success, message, payment_status: PaymentStatus, audit_logged }`; 409 when not `Pending` or when `downpayment_required` is null.

- [x] **Step 1: Write the failing tests**

Create `src/__tests__/architecture/payment-status-parity.test.ts`:

```ts
/**
 * bookings.payment_status is derived by triggers (docs/adr/0001); the CHECK
 * constraint lists its values. PAYMENT_STATUSES narrows the column type and
 * must stay equal to it.
 */

import { describe, expect, it } from "vitest";

import { PAYMENT_STATUSES } from "@/types";

import { latestCheckConstraintValues } from "./check-constraint";

describe("payment_status parity", () => {
  it("PAYMENT_STATUSES equals the bookings_payment_status_check values", () => {
    expect([...PAYMENT_STATUSES].sort()).toEqual(
      latestCheckConstraintValues("bookings_payment_status_check").sort()
    );
  });
});
```

Create `src/__tests__/api/admin-verify-payment.test.ts`:

```ts
/**
 * POST /api/admin/verify-payment records the downpayment as a payment
 * (the trigger derives payment_status, docs/adr/0001) and never writes
 * bookings.payment_status. Reject writes nothing to the booking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bookingId = "11111111-1111-4111-8111-111111111111";

type BookingRow = {
  payment_status: string;
  downpayment_required: number | null;
  payment_method: string | null;
  payment_proof_url: string | null;
};

let booking: BookingRow | null;
let statusAfterInsert: string;
let inserts: Record<string, unknown[]>;
let updates: string[];

function table(name: string) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: booking, error: null }),
    single: async () => ({ data: { payment_status: statusAfterInsert }, error: null }),
    insert: async (row: unknown) => {
      (inserts[name] ??= []).push(row);
      return { error: null };
    },
    update: () => {
      updates.push(name);
      return query;
    },
  };
  return query;
}

async function post(body: unknown): Promise<Response> {
  const { onRequest } = await import("../../../functions/api/admin/verify-payment");
  const request = new Request("https://api.example.com/api/admin/verify-payment", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return onRequest({
    request: request as never,
    env: { SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: "key" },
    params: {},
  });
}

describe("POST /api/admin/verify-payment", () => {
  beforeEach(() => {
    booking = {
      payment_status: "Pending",
      downpayment_required: 3500,
      payment_method: "GCash",
      payment_proof_url: "TEMP-abc_1.png",
    };
    statusAfterInsert = "Partial";
    inserts = {};
    updates = [];
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "manager-1", email: "manager@example.com" }))
    );
    vi.doMock("../../../functions/lib/role-lookup", () => ({
      lookupUserRole: vi.fn(async () => "manager"),
    }));
    vi.doMock("../../../functions/lib/supabase-admin", () => ({
      createSupabaseAdmin: vi.fn(() => ({ from: table })),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verify inserts the downpayment and returns the derived status", async () => {
    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(200);
    expect(inserts.payments).toEqual([
      {
        booking_id: bookingId,
        amount: 3500,
        payment_method: "GCash",
        proof_url: "TEMP-abc_1.png",
        status: "Active",
        notes: "Online booking downpayment",
      },
    ]);
    expect(updates).toEqual([]);
    const body = (await response.json()) as { payment_status: string };
    expect(body.payment_status).toBe("Partial");
  });

  it("reject writes no payment and no booking update, and audits the reason", async () => {
    const response = await post({ booking_id: bookingId, action: "reject", reason: "Blurry" });

    expect(response.status).toBe(200);
    expect(inserts.payments).toBeUndefined();
    expect(updates).toEqual([]);
    expect(inserts.audit_logs).toEqual([
      expect.objectContaining({
        event_type: "payment.rejected",
        metadata: expect.objectContaining({ rejection_reason: "Blurry" }),
      }),
    ]);
    const body = (await response.json()) as { payment_status: string };
    expect(body.payment_status).toBe("Pending");
  });

  it("refuses a booking without a recorded downpayment", async () => {
    booking!.downpayment_required = null;

    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(409);
    expect(inserts.payments).toBeUndefined();
  });

  it("refuses a booking whose payment is no longer Pending", async () => {
    booking!.payment_status = "Partial";

    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(409);
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/__tests__/architecture/payment-status-parity.test.ts src/__tests__/api/admin-verify-payment.test.ts`
Expected: FAIL. Parity: `PAYMENT_STATUSES` is undefined. Verify: `updates` equals `["bookings"]` and no payment insert.

- [x] **Step 3: Add `PAYMENT_STATUSES` and narrow the column**

Append to `src/types/booking-status.ts`:

```ts
export const PAYMENT_STATUSES = ["Pending", "Partial", "Completed", "Refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
```

In `src/types/index.ts`, change line 3 to `import type { BookingStatus, PaymentStatus } from "./booking-status";`, replace line 48 with `export { BOOKING_STATUSES, type BookingStatus, PAYMENT_STATUSES, type PaymentStatus } from "./booking-status";`, and delete line 50 (`export type PaymentStatus = …`).

In `src/types/database.types.ts`, change the import to `import type { BookingStatus, PaymentStatus } from "./booking-status";`, the comment's first line to `// bookings and app_roles have the CHECKs (payment_status is derived, docs/adr/0001); the two availability relations copy`, and the bookings entry to:

```ts
bookings: {
  booking_status: BookingStatus;
  payment_status: PaymentStatus;
}
```

- [x] **Step 4: Rewrite the verify/reject write**

In `functions/api/admin/verify-payment.ts`:

1. Change the booking select to `.select("payment_status, downpayment_required, payment_method, payment_proof_url")`.
2. After the `payment_status !== "Pending"` 409 block, replace everything from `// Determine new payment status` through the end of the `if (updateError) { … }` block with:

```ts
// Verify records the downpayment; a trigger derives payment_status (docs/adr/0001).
// Reject leaves the booking and its proof as they are; the reason goes to the audit log.
let newPaymentStatus = booking.payment_status;
if (body.action === "verify") {
  const downpayment = booking.downpayment_required;
  if (downpayment === null) {
    return new Response(
      JSON.stringify({
        error: "Conflict",
        message: "This booking has no downpayment to record",
      }),
      {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { error: paymentError } = await supabase.from("payments").insert({
    booking_id: body.booking_id,
    amount: downpayment,
    payment_method: booking.payment_method,
    proof_url: booking.payment_proof_url,
    status: "Active",
    notes: "Online booking downpayment",
  } satisfies TablesInsert<"payments">);

  if (paymentError) {
    console.error("Failed to record payment:", paymentError);
    return new Response(
      JSON.stringify({
        error: "Internal Server Error",
        message: "Failed to record the downpayment",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: refreshed } = await supabase
    .from("bookings")
    .select("payment_status")
    .eq("booking_id", body.booking_id)
    .single();
  newPaymentStatus = refreshed?.payment_status ?? booking.payment_status;
}
```

3. Change the import line to `import type { TablesInsert } from "@/types/database.types";` (`TablesUpdate` is no longer used).

- [x] **Step 5: Run the tests and checks**

Run: `npx vitest run src/__tests__/architecture/payment-status-parity.test.ts src/__tests__/api/admin-verify-payment.test.ts && npm run type-check`
Expected: PASS. If type-check now fails elsewhere because `payment_status` is narrowed, each error is a place that compares or writes a value the CHECK rejects: fix it in this task if it is one of the admin files in Task 7's list (move that change here), otherwise stop and report the list.

- [x] **Step 6: Commit**

```bash
git add src/types/booking-status.ts src/types/index.ts src/types/database.types.ts src/__tests__/architecture/payment-status-parity.test.ts functions/api/admin/verify-payment.ts src/__tests__/api/admin-verify-payment.test.ts
git commit -m "fix(admin): verify records the downpayment instead of writing payment_status"
```

---

### Task 7: Admin screens read the derived status; queue shows single-cabin bookings

**Files:**

- Create: `src/lib/bookings/payment.ts`, `src/lib/bookings/__tests__/payment.test.ts`
- Modify: `src/lib/bookings/index.ts`
- Modify: `functions/api/admin/pending-bookings.ts:117`
- Modify: `src/components/admin/PendingBookingsQueue.tsx:56,175-181,354-371`
- Modify: `src/components/admin/PaymentProofViewer.tsx:43,153-159,194-213`
- Modify: `src/routes/admin/verify-payment.$bookingId.tsx:28,51-58,143-147`
- Modify: `src/routes/admin/bookings/$bookingId.assign-units.tsx:45,367-368`

**Interfaces:**

- Consumes: `PaymentStatus` from `@/types` (Task 6).
- Produces: `isPaymentReceived(status: PaymentStatus): boolean`; `PaymentProofViewer` prop `onStatusChange?: (action: "verify" | "reject") => void`.

- [x] **Step 1: Write the failing test**

Create `src/lib/bookings/__tests__/payment.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isPaymentReceived } from "../payment";

describe("isPaymentReceived", () => {
  it.each([
    ["Pending", false],
    ["Partial", true],
    ["Completed", true],
    ["Refunded", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isPaymentReceived(status)).toBe(expected);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/bookings/__tests__/payment.test.ts`
Expected: FAIL with `Failed to resolve import "../payment"`.

- [x] **Step 3: Write the helper**

Create `src/lib/bookings/payment.ts`:

```ts
import type { PaymentStatus } from "@/types";

/** A downpayment or more is recorded, so cabins can be assigned. */
export const isPaymentReceived = (status: PaymentStatus) =>
  status === "Partial" || status === "Completed";
```

Add `export * from "./payment";` to `src/lib/bookings/index.ts`.

- [x] **Step 4: Include single-cabin guest bookings in the queue (D5)**

In `functions/api/admin/pending-bookings.ts`, delete the line `.eq("is_multi_unit", true)`.

- [x] **Step 5: Update the queue**

In `src/components/admin/PendingBookingsQueue.tsx`:

- Import `import type { PaymentStatus } from "@/types";` and `import { isPaymentReceived } from "@/lib/bookings";`.
- Line 56: `payment_status: PaymentStatus;`
- Replace `getPaymentBadge`'s `variantMap` with:
  ```ts
  const variantMap: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
    Pending: "secondary",
    Partial: "default",
    Completed: "default",
    Refunded: "destructive",
  };
  ```
- In the action button, replace each `booking.payment_status === "Verified"` (three places: `title`, `onClick`, label) with `isPaymentReceived(booking.payment_status)`.

- [x] **Step 6: Update the proof viewer and verify page**

In `src/components/admin/PaymentProofViewer.tsx`:

- Import `import type { PaymentStatus } from "@/types";` and `import { isPaymentReceived } from "@/lib/bookings";`.
- Props: `currentPaymentStatus: PaymentStatus;` and `onStatusChange?: (action: "verify" | "reject") => void;`
- `onSuccess: () => {` → `onSuccess: (_data, variables) => {` and `onStatusChange?.();` → `onStatusChange?.(variables.action);`
- In `renderStatusBadge`, change `if (currentPaymentStatus === "Verified") {` to `if (isPaymentReceived(currentPaymentStatus)) {` and delete the whole `if (currentPaymentStatus === "Rejected") { … }` block (a rejection is not stored, D2).

In `src/routes/admin/verify-payment.$bookingId.tsx`:

- Import `import type { PaymentStatus } from "@/types";`; line 28: `payment_status: PaymentStatus;`
- Replace `handleStatusChange` with:
  ```ts
  const handleStatusChange = (action: "verify" | "reject") => {
    window.location.href =
      action === "verify" ? `/admin/bookings/${bookingId}/assign-units` : "/admin/bookings/queue";
  };
  ```
- If the page also checks `booking.payment_status === "Verified"` elsewhere (search the file), use `isPaymentReceived(booking.payment_status)`.

In `src/routes/admin/bookings/$bookingId.assign-units.tsx`:

- Import `import type { PaymentStatus } from "@/types";` and add `isPaymentReceived` to the `@/lib/bookings` import Task 3 added: `import { isPaymentReceived, manilaDayOf } from "@/lib/bookings";`.
- Line 45: `payment_status: PaymentStatus;`
- Replace the guard comment and condition with `if (!isPaymentReceived(booking.payment_status)) {`.

- [x] **Step 7: Confirm no `Verified`/`Rejected` payment comparisons remain**

Run: `grep -rn --include='*.ts' --include='*.tsx' '"Verified"\|"Rejected"' src/components/admin src/routes/admin functions/api/admin`
Expected: no output.

- [x] **Step 8: Run tests and checks**

Run: `npx vitest run src/lib/bookings src/components/admin && npm run type-check && npm run lint`
Expected: PASS; exit 0.

- [x] **Step 9: Commit**

```bash
git add src/lib/bookings functions/api/admin/pending-bookings.ts src/components/admin/PendingBookingsQueue.tsx src/components/admin/PaymentProofViewer.tsx 'src/routes/admin/verify-payment.$bookingId.tsx' 'src/routes/admin/bookings/$bookingId.assign-units.tsx'
git commit -m "fix(admin): read derived payment status in the online booking screens"
```

---

### Task 8: E2E — staff verify the downpayment, then assign a cabin

**Files:**

- Create: `e2e/online-booking.spec.ts`

**Interfaces:**

- Consumes: `create_guest_booking` (Task 1), the screens from Tasks 3 and 7, `loginAsAdmin` from `e2e/fixtures/auth.ts`.

- [x] **Step 1: Write the spec**

Create `e2e/online-booking.spec.ts`:

```ts
/**
 * Online booking, staff side: verify the guest's downpayment, then assign a
 * cabin. Seeds the guest booking through create_guest_booking (service role),
 * as the Worker does.
 */

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loginAsAdmin } from "./fixtures/auth";

// 1x1 PNG, accepted by the payment-proofs bucket (image/*)
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function admin(): SupabaseClient {
  return createClient(
    process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
      "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

test.describe("Online booking: verify then assign", () => {
  const db = admin();
  const reference = `E2E-OB-${Date.now().toString(36).toUpperCase()}`;
  const proofPath = `TEMP-${reference}.png`;
  let bookingId = "";

  async function bookingField(column: string) {
    const { data } = await db.from("bookings").select(column).eq("booking_id", bookingId).single();
    return (data as Record<string, unknown> | null)?.[column];
  }

  test.beforeAll(async () => {
    const upload = await db.storage
      .from("payment-proofs")
      .upload(proofPath, PNG_1X1, { contentType: "image/png", upsert: true });
    expect(upload.error).toBeNull();

    const unitBreakdown = [
      {
        unit_index: 1,
        guests: 2,
        subtotal: 7000,
        extra_person_fees: 0,
        total: 7000,
        downpayment: 3500,
      },
    ];
    const { data, error } = await db.rpc("create_guest_booking", {
      p_turnstile_token: "e2e",
      p_booking_data: {
        booking_reference: reference,
        guest_name: "E2E Online Guest",
        email: "e2e-online-guest-test@example.com",
        phone_number: "+639171234567",
        check_in: "2027-03-10T06:00:00.000Z",
        check_out: "2027-03-12T04:00:00.000Z",
        total_amount: 7000,
        downpayment_required: 3500,
        pricing_snapshot: {
          total: 7000,
          downpayment_required: 3500,
          unit_breakdown: unitBreakdown,
        },
        payment_proof_url: proofPath,
      },
      p_unit_requests: [{ guests_per_unit: 2 }],
      p_guest_data: null,
    });
    expect(error).toBeNull();
    bookingId = (data as { booking: { booking_id: string } }).booking.booking_id;
  });

  test.afterAll(async () => {
    if (bookingId) await db.from("bookings").delete().eq("booking_id", bookingId);
    await db.storage.from("payment-proofs").remove([proofPath]);
  });

  test("staff verify the downpayment, then assign one cabin", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`/admin/verify-payment/${bookingId}`);
    await page.getByRole("button", { name: "Verify Payment" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify Payment" }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/bookings/${bookingId}/assign-units`));
    await expect.poll(() => bookingField("payment_status")).toBe("Partial");

    await page
      .getByRole("button", { name: /^Unit .*, not selected$/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Assign 1 Unit to Booking" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Assign Units" }).click();

    await expect.poll(() => bookingField("booking_status")).toBe("Confirmed");
    await expect.poll(() => bookingField("unit_assignment_status")).toBe("assigned");
  });
});
```

- [x] **Step 2: Run it**

Run: `npx playwright test e2e/online-booking.spec.ts --project=chromium`
Expected: `1 passed`. If a locator does not match, read the failure screenshot under `test-results/` (Read it, state what it shows) and fix the locator only; the flow must not be weakened into a visibility check.

- [x] **Step 3: Run the neighbouring specs**

Run: `npx playwright test e2e/admin-queue.spec.ts e2e/booking-lifecycle.spec.ts --project=chromium`
Expected: same pass/skip counts as on `main` (memory: 0 known chromium failures). Report the summary line.

- [x] **Step 4: Commit**

```bash
git add e2e/online-booking.spec.ts
git commit -m "test(e2e): verify the downpayment and assign a cabin"
```

---

### Task 9: Prod replica check (D3), drift baseline, verify, PR

**Files:**

- Modify: `scripts/drift/baseline.txt:66-105`
- Modify: `docs/plans/2026-10-12-online-booking-restore.md` (task checkboxes, Resume state)

- [x] **Step 1: Ask the user for the prod schema dump**

Ask the user to run (agent prod reads are blocked):

```
! supabase db dump --linked --schema public -f <session scratchpad>/prod-schema.sql
```

Wait for it. Confirm the file exists and is non-empty (`wc -l`).

- [x] **Step 2: Load the dump into a scratch database and apply the migration**

Run (local Postgres from `supabase start`):

```bash
DB=postgresql://postgres:postgres@127.0.0.1:54322
psql "$DB/postgres" -c "drop database if exists prod_replica" -c "create database prod_replica"
# Roles (anon, authenticated, service_role) are cluster-wide and already exist. The dump needs
# the extensions schema and the auth helpers that policies and the audit trigger call.
psql "$DB/prod_replica" -v ON_ERROR_STOP=1 <<'SQL'
create schema extensions;
create extension "uuid-ossp" schema extensions;
create extension pgcrypto schema extensions;
create extension btree_gist schema extensions;
create schema auth;
create function auth.uid() returns uuid language sql as 'select null::uuid';
create function auth.jwt() returns jsonb language sql as 'select null::jsonb';
create function auth.role() returns text language sql as 'select null::text';
SQL
psql "$DB/prod_replica" -v ON_ERROR_STOP=0 -f <scratchpad>/prod-schema.sql > <scratchpad>/replica-load.log 2>&1
psql "$DB/prod_replica" -v ON_ERROR_STOP=1 -f supabase/migrations/20261013000000_online_booking.sql
psql "$DB/prod_replica" -v ON_ERROR_STOP=1 -f supabase/migrations/20261013000000_online_booking.sql
```

Expected: both migration runs end with `COMMIT`. Read `replica-load.log`: errors for `auth.users` foreign keys, storage and other Supabase-managed objects are expected. If an error touches `bookings`, `booking_units`, `booking_unit_availability`, `payments`, `guests`, `idempotency_keys` or `units`, add the missing prerequisite to the setup block, drop and recreate `prod_replica`, and reload. If `is_staff_or_above` is missing on prod, stop and tell the user (the new policy depends on it).

- [x] **Step 3: Exercise the functions on the replica**

Run in `$DB/prod_replica` as one transaction that is rolled back:

```sql
BEGIN;
INSERT INTO public.units (unit_name, unit_code, unit_type, base_rate, weekend_rate, max_occupancy, base_occupancy, extra_person_rate, unit_status)
VALUES ('Replica Unit', 'TEST-R1', 'Standard', 3500, 4000, 4, 2, 500, 'Available');
SELECT public.create_guest_booking('t',
  '{"booking_reference":"TB-REPLICA","guest_name":"Replica","email":"replica-test@example.com","phone_number":"+639171234567","check_in":"2027-03-10T06:00:00Z","check_out":"2027-03-12T04:00:00Z","total_amount":7000,"downpayment_required":3500,"pricing_snapshot":{"total":7000,"unit_breakdown":[{"guests":2,"extra_person_fees":0,"total":7000}]}}'::jsonb,
  '[{"guests_per_unit":2}]'::jsonb);
INSERT INTO public.payments (booking_id, amount, status)
SELECT booking_id, 3500, 'Active' FROM public.bookings WHERE booking_reference = 'TB-REPLICA';
SELECT public.assign_units_to_booking(
  (SELECT booking_id FROM public.bookings WHERE booking_reference = 'TB-REPLICA'),
  ARRAY[(SELECT unit_id FROM public.units WHERE unit_code = 'TEST-R1')]);
SELECT booking_status, payment_status, unit_assignment_status, total_amount FROM public.bookings WHERE booking_reference = 'TB-REPLICA';
ROLLBACK;
```

Expected: last select prints `Confirmed | Partial | assigned | 7000.00`. Then `psql "$DB/postgres" -c "drop database prod_replica"` and `rm <scratchpad>/prod-schema.sql`.

- [x] **Step 4: Update the drift baseline**

In `scripts/drift/baseline.txt`, delete every line from 68 to 104 except the `cleanup_expired_payment_proofs` line, rewrite the group header (lines 66-67) to:

```
# Payment proof cleanup (20251104184719 recorded as applied, function absent on prod). Deferred: guardrails
# plan deferred list item 3 (needs a retention rule).
```

and move the `pricing_config_admin_policy` line under a new group:

```
# pricing_config admin policy (20251108000000) absent on prod. Unused: pricing writes go through the
# service role (functions/api/pricing/update-config.ts). Drop it locally or leave as is.
local-only policy pricing_config.pricing_config_admin_policy * roles=authenticated md5=81a979dae2eb74bd7947a276066fba2e
```

Keep line 101 (`authenticated_users_insert_booking_units`) deleted: the migration drops it locally. The remaining online-booking objects match after the push; `drift:prod` is run in Task 10 (after the push), when these lines must no longer differ.

- [x] **Step 5: Full verification**

Run: `npm run verify && npm run test:db`
Expected: both exit 0; paste each summary line. Then check the tracking doc's task boxes for Tasks 1–9 and update its Resume state.

- [x] **Step 6: Commit and open the PR**

```bash
git add scripts/drift/baseline.txt docs/plans/2026-10-12-online-booking-restore.md docs/plans/2026-10-12-online-booking-restore-implementation.md
git commit -m "chore(drift): drop fixed online booking baseline lines"
git push -u origin fix/restore-guest-booking-schema   # Bash timeout 600000 (pre-push hook)
gh pr create --fill-first
```

Use the `mattpocock-skills:pr` skill for the PR body. Verify the push: `git fetch origin && git rev-parse HEAD origin/fix/restore-guest-booking-schema` (hashes match).

---

### Task 10: User — push the migration to prod and test once

- [x] **Step 1 (user):** after the PR merges, `! supabase db push` and confirm it lists only `20261013000000_online_booking.sql`.
- [x] **Step 2 (user):** `! npm run drift:prod`; expected: no differences beyond the baseline.
- [x] **Step 3 (user):** one real guest booking on prod for one cabin, verify it in `/admin/bookings/queue`, assign a cabin, then cancel and delete the booking. Done 2026-10-21: BK-202610-FS2AWN ended `Cancelled | Partial | assigned`; the UI has no booking Delete (removed 2026-10-11), so the booking, its guest and its audit rows were deleted with SQL by the user (check query: all 0).
- [x] **Step 4:** update memory `project_prod_schema_drift_migration_20251104184719.md` (fixed) and `project_guardrails_deferred_list.md` (item 4 done).
