# Guest Retention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anonymize a guest's personal data in place 24 months after their last check-out (weekly job) or on an owner's request, and make guest delete scrub the same data first.

**Architecture:** One migration adds SQL functions that hold every rule: `anonymize_booking` and `anonymize_guest` clear columns and scrub the guest's audit rows in one transaction; `anonymize_expired_guests` loops over eligible guests; `delete_guest` anonymizes, then deletes. Workers call them with the service role: a weekly cron endpoint and two admin endpoints. They delete the returned payment-proof files after the commit. The UI adds an owner-only Anonymize action and an anonymized state.

**Tech Stack:** Postgres (PL/pgSQL, Supabase), Cloudflare Pages Functions, React 19 + TanStack Query/Router, Vitest (+ local Supabase for DB tests), GitHub Actions.

**Spec:** `docs/plans/2026-10-21-guest-retention-design.md`. Precedent: `docs/plans/2026-10-18-audit-retention-implementation.md`.

## Global Constraints

- Window: `24 months` after `max(check_out)` (parameter default). Never describe it as legally compliant.
- Placeholder for NOT NULL names: `'Removed guest'`. Other cleared columns: `NULL`.
- Cleared columns: `guests.guest_name/email/phone_number`; `bookings.guest_name/email/contact_number/special_requests/internal_notes/payment_proof_url`; `booking_units.guest_names/unit_notes`; `payments.notes/proof_url`; `guest_assignments.room_preferences`. Everything else is kept.
- Marker: `anonymized_at timestamptz` on `guests` and `bookings`.
- Open balance = `payment_status IN ('Pending', 'Partial')` and `booking_status IS DISTINCT FROM 'Cancelled'`. It blocks the weekly job only.
- Manual anonymize: owner/admin (`OWNER_OR_ABOVE`). Delete: manager+ (`MANAGER_OR_ABOVE`), refused with Confirmed/CheckedIn bookings.
- Custom SQLSTATEs: `PT404` (guest not found), `PT409` (blocked by a booking). PostgREST maps `PTxyz` to HTTP status `xyz`.
- All new public functions: `SECURITY DEFINER`, `SET search_path = ''`, EXECUTE revoked from `public, anon, authenticated`, granted to `service_role`. Helpers (`_`-prefixed): revoked, no grant.
- No tax/BIR scope. Money columns stay for internal summaries.
- Prod changes (`supabase db push`, workflow runs) are done by the user. The Bash guard blocks `supabase db push` for agents.
- Run `npm run verify` before every commit. DB tests need `supabase start`; run one vitest at a time (CLAUDE.md, "Vitest global setup stops Supabase").

---

## File map

| File                                                                                                                                                                  | Responsibility                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `supabase/migrations/20261021000000_guest_retention.sql` (create)                                                                                                     | Columns, backup-table drop, delete-policy drop, audit helpers, the four functions |
| `supabase/rollbacks/20261021000000_rollback_guest_retention.sql` (create)                                                                                             | Reverse of the migration                                                          |
| `src/__tests__/database/guest-anonymization.test.ts` (create)                                                                                                         | Rules, eligibility, audit scrub, delete, grants, failure isolation                |
| `src/__tests__/database/retention-column-coverage.test.ts` (create)                                                                                                   | Every column of the five tables is classified                                     |
| `src/__tests__/database/audit-trigger-coverage.test.ts`, `rls-core-tables.test.ts` (modify)                                                                           | Backup table gone; guests delete denied to clients                                |
| `functions/lib/payment-proof-storage.ts` (create)                                                                                                                     | Delete proof files, report deleted/failed                                         |
| `functions/scheduled/cleanup-payment-proofs.ts`, `functions/api/cron/cleanup-payment-proofs.ts` (modify)                                                              | Use the helper; return `deleted_count`                                            |
| `functions/scheduled/anonymize-guests.ts`, `functions/api/cron/anonymize-guests.ts` (create)                                                                          | Weekly job + endpoint                                                             |
| `functions/lib/guest-retention.ts` (create)                                                                                                                           | Run `anonymize_guest` / `delete_guest`, map errors, delete files                  |
| `functions/api/admin/guests/[guestId]/anonymize.ts`, `functions/api/admin/guests/[guestId].ts` (create)                                                               | Admin endpoints                                                                   |
| `.github/workflows/scheduled-cleanup.yml` (modify)                                                                                                                    | Weekly `anonymize-guests` job                                                     |
| `src/lib/guests/retention.ts` (create)                                                                                                                                | Pure blockers check for the dialog                                                |
| `src/stores/useGuestStore.ts` (modify)                                                                                                                                | `useAnonymizeGuest`; `useDeleteGuest` calls the endpoint                          |
| `src/components/guests/GuestDetail/AnonymizeGuestDialog.tsx` (create), `GuestDetail/index.tsx` (modify)                                                               | Action + anonymized state                                                         |
| `src/components/bookings/BookingDetail/index.tsx`, `src/components/guests/GuestsTable.tsx`, `src/components/audit/AuditDiffViewer.tsx`, `src/types/index.ts` (modify) | Badge, delete gating, label, types                                                |

---

### Task 1: Anonymize SQL functions (booking, guest) and column coverage

**Files:**

- Create: `supabase/migrations/20261021000000_guest_retention.sql`
- Create: `supabase/rollbacks/20261021000000_rollback_guest_retention.sql`
- Create: `src/__tests__/database/guest-anonymization.test.ts`
- Create: `src/__tests__/database/retention-column-coverage.test.ts`
- Modify: `src/__tests__/database/audit-trigger-coverage.test.ts:22` (remove the `bookings_conflict_backup` entry)
- Modify: `src/types/database.types.ts:13` (comment that names `bookings_conflict_backup`)
- Regenerate: `src/types/database.generated.ts` (`npm run gen:types`)

**Interfaces:**

- Produces (SQL): `public.anonymize_booking(p_booking_id uuid) RETURNS TABLE(proof_path text)`; `public.anonymize_guest(p_guest_id uuid) RETURNS TABLE(proof_path text)` (raises `PT404`, `PT409`); internal `public._anonymize_audit_rows(uuid[]) RETURNS bigint`, `public._audit_ids_for_records(text[]) RETURNS uuid[]`, `public._payment_proof_path(text) RETURNS text`. `anonymize_audit_logs(interval)` keeps its signature and result.
- Produces (columns): `guests.anonymized_at`, `bookings.anonymized_at` (`timestamptz`, NULL until anonymized).

- [x] **Step 1: Write the failing column-coverage test**

`src/__tests__/database/retention-column-coverage.test.ts`:

```ts
/**
 * Guest retention fails safe: every column of the tables anonymize_guest touches must be
 * on its clear-list or its keep-list. A new column fails here until someone classifies it
 * (and, if personal, clears it in supabase/migrations/20261021000000_guest_retention.sql).
 *
 * @vitest-environment node
 */

import { beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import { shouldRunDatabaseTests } from "../setup/test-db";

const COLUMNS: Record<string, { clear: string[]; keep: string[] }> = {
  guests: {
    clear: ["guest_name", "email", "phone_number"],
    keep: [
      "guest_id",
      "total_bookings",
      "total_spent",
      "created_at",
      "updated_at",
      "anonymized_at",
    ],
  },
  bookings: {
    clear: [
      "guest_name",
      "email",
      "contact_number",
      "special_requests",
      "internal_notes",
      "payment_proof_url",
    ],
    keep: [
      "booking_id",
      "booking_reference",
      "guest_id",
      "booking_status",
      "payment_status",
      "payment_method",
      "check_in",
      "check_out",
      "num_guests",
      "base_amount",
      "discount_amount",
      "discount_percent",
      "downpayment_required",
      "tax_amount",
      "total_amount",
      "total_surcharges",
      "pricing_metadata",
      "pricing_snapshot",
      "is_guest_booking",
      "is_multi_unit",
      "is_walk_in",
      "requested_unit_count",
      "unit_assignment_status",
      "unit_count",
      "upload_status",
      "upload_expires_at",
      "created_at",
      "updated_at",
      "anonymized_at",
    ],
  },
  booking_units: {
    clear: ["guest_names", "unit_notes"],
    keep: [
      "booking_unit_id",
      "booking_id",
      "unit_id",
      "unit_price",
      "weekend_surcharge",
      "extra_person_charge",
      "subtotal",
      "assigned_guests",
      "created_at",
      "updated_at",
    ],
  },
  payments: {
    clear: ["notes", "proof_url"],
    keep: [
      "payment_id",
      "booking_id",
      "account_id",
      "amount",
      "payment_date",
      "payment_method",
      "status",
      "created_at",
    ],
  },
  guest_assignments: {
    clear: ["room_preferences"],
    keep: ["assignment_id", "booking_unit_id", "guest_id", "is_primary", "created_at"],
  },
};

describe("guest retention column coverage", () => {
  let canRun = false;

  beforeAll(async () => {
    canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
  });

  it.each(Object.keys(COLUMNS))("classifies every column of %s", (table) => {
    if (!canRun) return;
    const columns = runPsql(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY 1;
    `);
    const { clear, keep } = COLUMNS[table];
    const classified = [...clear, ...keep];

    expect(columns.filter((column) => !classified.includes(column))).toEqual([]);
    expect(classified.filter((column) => !columns.includes(column))).toEqual([]);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/database/retention-column-coverage.test.ts`
Expected: FAIL for `guests` and `bookings` (`anonymized_at` is a stale entry). If another table fails with an unclassified column (local schema has columns the generated types do not show), STOP: classify it in this file and in the spec's column table, and ask the user if the column is personal.

- [x] **Step 3: Write the failing anonymization test**

`src/__tests__/database/guest-anonymization.test.ts` (Task 2 appends to it):

```ts
/**
 * Guest retention (RA 10173): anonymize_guest / anonymize_booking clear personal columns,
 * keep money and dates, and scrub the guest's audit rows in the same transaction.
 * See docs/plans/2026-10-21-guest-retention-design.md.
 *
 * Dates come from the database clock: src/test/setup.ts pins Date.now() to 2025.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import {
  testSupabaseAdmin as admin,
  cleanupTestData,
  createTestBooking,
  createTestGuest,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let canRun = false;
const guestIds: string[] = [];

async function guestWithStay(monthsAgo: number, bookingStatus = "CheckedOut") {
  const guest = await createTestGuest();
  guestIds.push(guest.guest_id);
  const booking = await createTestBooking({ guest, booking_status: bookingStatus });
  runPsql(`
    UPDATE public.bookings
    SET check_in = now() - interval '${monthsAgo} months' - interval '2 days',
        check_out = now() - interval '${monthsAgo} months',
        special_requests = 'call ${guest.email}',
        internal_notes = 'regular',
        payment_proof_url = 'bookings/${booking.booking_id}/proof.jpg'
    WHERE booking_id = '${booking.booking_id}';
    UPDATE public.booking_units SET guest_names = ARRAY['${guest.guest_name}'], unit_notes = 'near pool'
    WHERE booking_id = '${booking.booking_id}';
  `);
  return { guest, booking };
}

async function pay(bookingId: string, amount: number, proofUrl: string | null = null) {
  const { error } = await admin.from("payments").insert({
    booking_id: bookingId,
    amount,
    status: "Active",
    payment_method: "Cash",
    notes: "paid by guest",
    proof_url: proofUrl,
  });
  if (error) throw new Error(`payment insert failed: ${error.message}`);
}

function auditRowsMentioning(text: string): number {
  const [count] = runPsql(`
    SELECT count(*) FROM (
      SELECT old_data, new_data, description FROM public.audit_logs
      UNION ALL SELECT old_data, new_data, description FROM public.audit_logs_archive
    ) a
    WHERE concat(a.old_data::text, a.new_data::text, a.description) LIKE '%${text}%';
  `);
  return Number(count);
}

beforeAll(async () => {
  canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
  if (!canRun) {
    console.log("⏭️  Skipping guest anonymization tests — database or psql unavailable");
    return;
  }
  await cleanupTestData({ includeTestFixtures: true });
});

afterAll(async () => {
  if (!canRun) return;
  await cleanupTestData({ includeTestFixtures: true });
  if (guestIds.length) {
    runPsql(`DELETE FROM public.guests WHERE guest_id IN ('${guestIds.join("','")}');`);
  }
});

describe("anonymize_guest", () => {
  it("only the service role can execute the functions", () => {
    if (!canRun) return;
    for (const fn of ["public.anonymize_guest(uuid)", "public.anonymize_booking(uuid)"]) {
      expect(
        runPsql(`
          SELECT has_function_privilege('anon', '${fn}', 'EXECUTE'),
                 has_function_privilege('authenticated', '${fn}', 'EXECUTE'),
                 has_function_privilege('service_role', '${fn}', 'EXECUTE');
        `)
      ).toEqual(["f|f|t"]);
    }
  });

  it("clears personal columns, keeps money and dates, and returns proof paths", async () => {
    if (!canRun) return;
    const { guest, booking } = await guestWithStay(25);
    await pay(booking.booking_id, 5000, "REF_1.png");

    const { data, error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect((data ?? []).map((row) => row.proof_path).sort()).toEqual([
      "REF_1.png",
      `bookings/${booking.booking_id}/proof.jpg`,
    ]);

    const { data: guestRow } = await admin
      .from("guests")
      .select("guest_name, email, phone_number, total_spent, anonymized_at")
      .eq("guest_id", guest.guest_id)
      .single();
    expect(guestRow).toMatchObject({
      guest_name: "Removed guest",
      email: null,
      phone_number: null,
    });
    expect(guestRow?.anonymized_at).not.toBeNull();

    const { data: bookingRow } = await admin
      .from("bookings")
      .select(
        "guest_name, email, contact_number, special_requests, internal_notes, payment_proof_url, total_amount, booking_reference, anonymized_at"
      )
      .eq("booking_id", booking.booking_id)
      .single();
    expect(bookingRow).toMatchObject({
      guest_name: "Removed guest",
      email: null,
      contact_number: null,
      special_requests: null,
      internal_notes: null,
      payment_proof_url: null,
      total_amount: booking.total_amount,
      booking_reference: booking.booking_reference,
    });
    expect(bookingRow?.anonymized_at).not.toBeNull();

    const { data: unitRows } = await admin
      .from("booking_units")
      .select("guest_names, unit_notes, subtotal")
      .eq("booking_id", booking.booking_id);
    expect(unitRows).toEqual([{ guest_names: null, unit_notes: null, subtotal: 5000 }]);

    const { data: paymentRows } = await admin
      .from("payments")
      .select("notes, proof_url, amount")
      .eq("booking_id", booking.booking_id);
    expect(paymentRows).toEqual([{ notes: null, proof_url: null, amount: 5000 }]);
  });

  it("scrubs the guest's audit rows of any age, including the ones it writes", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(25);
    const other = await guestWithStay(1);
    runPsql(`
      INSERT INTO public.audit_logs (audit_id, action, source, table_name, record_id, old_data, created_at)
      VALUES (gen_random_uuid(), 'UPDATE', 'db', 'guests', '${guest.guest_id}',
              '{"email":"${guest.email}"}', now() - interval '1 month');
      INSERT INTO public.audit_logs_archive (audit_id, action, source, table_name, record_id, old_data, created_at)
      VALUES (gen_random_uuid(), 'UPDATE', 'db', 'guests', '${guest.guest_id}',
              '{"email":"${guest.email}"}', now() - interval '1 month');
    `);
    expect(auditRowsMentioning(guest.email!)).toBeGreaterThan(0);

    const { error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect(auditRowsMentioning(guest.email!)).toBe(0);
    expect(auditRowsMentioning(guest.guest_name)).toBe(0);
    expect(auditRowsMentioning(other.guest.email!)).toBeGreaterThan(0);
  });

  // A negative "months ago" puts the stay in the future on the database clock.
  it("refuses a guest with a current or future booking", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(-1, "Confirmed");

    const { error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error?.code).toBe("PT409");
  });

  it("ignores a cancelled future booking", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(-1, "Cancelled");

    const { error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
  });

  it("reports an unknown guest as PT404", async () => {
    if (!canRun) return;
    const { error } = await admin.rpc("anonymize_guest", {
      p_guest_id: "00000000-0000-0000-0000-000000000001",
    });

    expect(error?.code).toBe("PT404");
  });

  it("is a no-op the second time", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(25);
    await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });
    const [before] = runPsql(
      `SELECT anonymized_at FROM public.guests WHERE guest_id = '${guest.guest_id}';`
    );

    const { data, error } = await admin.rpc("anonymize_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(
      runPsql(`SELECT anonymized_at FROM public.guests WHERE guest_id = '${guest.guest_id}';`)
    ).toEqual([before]);
  });
});
```

- [x] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/__tests__/database/guest-anonymization.test.ts`
Expected: FAIL (`Could not find the function public.anonymize_guest`).

Done note (2026-10-21): the audit fixture INSERTs also set `changed_fields = ARRAY['email']`; a `db` UPDATE row without it breaks the `valid_changed_fields` CHECK.

- [x] **Step 5: Write the migration (part 1)**

`supabase/migrations/20261021000000_guest_retention.sql`:

```sql
-- Guest retention (RA 10173): personal data of past guests is anonymized in place.
-- anonymize_booking / anonymize_guest hold every rule: they clear the personal columns,
-- keep money, dates and statuses for the family's internal summaries, and scrub the
-- guest's audit rows in the same transaction (the audit trigger copies the old values
-- into a new row on every UPDATE). Proof-file paths are returned for the caller to
-- delete from storage. See docs/plans/2026-10-21-guest-retention-design.md.

ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS anonymized_at timestamptz;

-- One-off snapshot from database/migrations/014; prod held 2 test rows (user, 2026-10-21).
DROP TABLE IF EXISTS public.bookings_conflict_backup;

-- The anonymize_audit_logs rules (20261018000000), shared with guest anonymization.
CREATE OR REPLACE FUNCTION public._anonymize_audit_rows(p_audit_ids uuid[])
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_keep_tables text[] := ARRAY['units', 'pricing_config', 'schema_migrations', 'maintenance_logs'];
    v_marker jsonb := jsonb_build_object('anonymized_at', now());
    v_live_count bigint;
    v_archived_count bigint;
BEGIN
    UPDATE public.audit_logs a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.audit_id = ANY (p_audit_ids)
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_live_count = ROW_COUNT;

    UPDATE public.audit_logs_archive a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.audit_id = ANY (p_audit_ids)
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RETURN v_live_count + v_archived_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_audit_logs(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
BEGIN
    RETURN QUERY SELECT
        public._anonymize_audit_rows(ARRAY(
            SELECT a.audit_id FROM public.audit_logs a WHERE a.created_at < v_cutoff
            UNION ALL
            SELECT a.audit_id FROM public.audit_logs_archive a WHERE a.created_at < v_cutoff
        )),
        pg_total_relation_size('public.audit_logs');
END;
$$;

-- Audit rows about these records: by record_id, or by a booking_id / guest_id in the row data
-- (child tables, and legacy app-logged rows such as table_name 'booking').
CREATE OR REPLACE FUNCTION public._audit_ids_for_records(p_record_ids text[])
RETURNS uuid[]
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT COALESCE(array_agg(s.audit_id), '{}')
    FROM (
        SELECT a.audit_id FROM public.audit_logs a
        WHERE a.record_id = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'booking_id' = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'guest_id' = ANY (p_record_ids)
        UNION ALL
        SELECT a.audit_id FROM public.audit_logs_archive a
        WHERE a.record_id = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'booking_id' = ANY (p_record_ids)
           OR COALESCE(a.old_data, a.new_data) ->> 'guest_id' = ANY (p_record_ids)
    ) s;
$$;

-- Same path rule as cleanup_expired_payment_proofs: a bucket path, or a storage URL stripped to one.
CREATE OR REPLACE FUNCTION public._payment_proof_path(p_url text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
    SELECT regexp_replace(
        split_part(p_url, '?', 1),
        '^.*/storage/v1/object/(public|sign|authenticated)/payment-proofs/',
        ''
    );
$$;

CREATE OR REPLACE FUNCTION public.anonymize_booking(p_booking_id uuid)
RETURNS TABLE(proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_paths text[];
    v_record_ids text[];
BEGIN
    SELECT COALESCE(array_agg(DISTINCT public._payment_proof_path(s.url)), '{}')
    INTO v_paths
    FROM (
        SELECT b.payment_proof_url AS url FROM public.bookings b
        WHERE b.booking_id = p_booking_id AND b.anonymized_at IS NULL
        UNION ALL
        SELECT p.proof_url FROM public.payments p
        JOIN public.bookings b ON b.booking_id = p.booking_id
        WHERE p.booking_id = p_booking_id AND b.anonymized_at IS NULL
    ) s
    WHERE s.url IS NOT NULL;

    v_record_ids := ARRAY[p_booking_id::text]
        || ARRAY(SELECT p.payment_id::text FROM public.payments p WHERE p.booking_id = p_booking_id)
        || ARRAY(SELECT u.booking_unit_id::text FROM public.booking_units u WHERE u.booking_id = p_booking_id)
        || ARRAY(SELECT r.id::text FROM public.guest_booking_unit_requests r WHERE r.booking_id = p_booking_id);

    UPDATE public.bookings
    SET guest_name = 'Removed guest',
        email = NULL,
        contact_number = NULL,
        special_requests = NULL,
        internal_notes = NULL,
        payment_proof_url = NULL,
        anonymized_at = now()
    WHERE booking_id = p_booking_id AND anonymized_at IS NULL;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.booking_units SET guest_names = NULL, unit_notes = NULL
    WHERE booking_id = p_booking_id;
    UPDATE public.payments SET notes = NULL, proof_url = NULL
    WHERE booking_id = p_booking_id;
    UPDATE public.guest_assignments ga SET room_preferences = NULL
    FROM public.booking_units u
    WHERE ga.booking_unit_id = u.booking_unit_id AND u.booking_id = p_booking_id;

    PERFORM public._anonymize_audit_rows(public._audit_ids_for_records(v_record_ids));

    RETURN QUERY SELECT unnest(v_paths);
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_guest(p_guest_id uuid)
RETURNS TABLE(proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_booking_id uuid;
    v_paths text[] := '{}';
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.guests g WHERE g.guest_id = p_guest_id) THEN
        RAISE EXCEPTION 'Guest % not found', p_guest_id USING ERRCODE = 'PT404';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.guest_id = p_guest_id
          AND b.check_out > now()
          AND b.booking_status IS DISTINCT FROM 'Cancelled'
    ) THEN
        RAISE EXCEPTION 'Guest % has a current or future booking', p_guest_id USING ERRCODE = 'PT409';
    END IF;

    FOR v_booking_id IN SELECT b.booking_id FROM public.bookings b WHERE b.guest_id = p_guest_id LOOP
        v_paths := v_paths || ARRAY(SELECT a.proof_path FROM public.anonymize_booking(v_booking_id) a);
    END LOOP;

    UPDATE public.guests
    SET guest_name = 'Removed guest', email = NULL, phone_number = NULL, anonymized_at = now()
    WHERE guest_id = p_guest_id AND anonymized_at IS NULL;
    UPDATE public.guest_assignments SET room_preferences = NULL WHERE guest_id = p_guest_id;

    PERFORM public._anonymize_audit_rows(public._audit_ids_for_records(ARRAY[p_guest_id::text]));

    RETURN QUERY SELECT unnest(v_paths);
END;
$$;

REVOKE ALL ON FUNCTION public._anonymize_audit_rows(uuid[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public._audit_ids_for_records(text[]) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public._payment_proof_path(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.anonymize_booking(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.anonymize_guest(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_booking(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_guest(uuid) TO service_role;
```

- [x] **Step 6: Write the rollback (part 1)**

`supabase/rollbacks/20261021000000_rollback_guest_retention.sql`:

```sql
-- ============================================
-- ROLLBACK for 20261021000000_guest_retention.sql
-- ============================================
-- Drops the retention functions and the anonymized_at markers, restores anonymize_audit_logs
-- to its 20261018000000 body and the guests delete policy, and recreates
-- bookings_conflict_backup EMPTY (its 2 test rows are not restored).
-- Anonymized rows stay anonymized: their personal data is gone.
-- Local: use `supabase db reset` instead.
-- ============================================

BEGIN;

DROP FUNCTION IF EXISTS public.anonymize_guest(uuid);
DROP FUNCTION IF EXISTS public.anonymize_booking(uuid);
DROP FUNCTION IF EXISTS public._payment_proof_path(text);
DROP FUNCTION IF EXISTS public._audit_ids_for_records(text[]);

-- 20261018000000 body (it must not call _anonymize_audit_rows, which is dropped next)
CREATE OR REPLACE FUNCTION public.anonymize_audit_logs(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(anonymized_count bigint, audit_logs_bytes bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
    v_keep_tables text[] := ARRAY['units', 'pricing_config', 'schema_migrations', 'maintenance_logs'];
    v_marker jsonb := jsonb_build_object('anonymized_at', now());
    v_live_count bigint;
    v_archived_count bigint;
BEGIN
    UPDATE public.audit_logs a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.created_at < v_cutoff
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_live_count = ROW_COUNT;

    UPDATE public.audit_logs_archive a
    SET user_email = NULL,
        ip_address = NULL,
        user_agent = NULL,
        old_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.old_data END,
        new_data = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.new_data END,
        description = CASE WHEN a.table_name = ANY (v_keep_tables) THEN a.description END,
        metadata = CASE
            WHEN a.table_name = ANY (v_keep_tables) THEN COALESCE(a.metadata, '{}'::jsonb) || v_marker
            ELSE v_marker
        END
    WHERE a.created_at < v_cutoff
      AND NOT COALESCE(a.metadata ? 'anonymized_at', false);
    GET DIAGNOSTICS v_archived_count = ROW_COUNT;

    RETURN QUERY SELECT v_live_count + v_archived_count, pg_total_relation_size('public.audit_logs');
END;
$$;
REVOKE ALL ON FUNCTION public.anonymize_audit_logs(interval) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_audit_logs(interval) TO service_role;

DROP FUNCTION IF EXISTS public._anonymize_audit_rows(uuid[]);

ALTER TABLE public.guests DROP COLUMN IF EXISTS anonymized_at;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS anonymized_at;

CREATE TABLE IF NOT EXISTS public.bookings_conflict_backup (
    booking_id uuid,
    booking_reference character varying(20),
    unit_id uuid,
    guest_id uuid,
    guest_name character varying(100),
    contact_number character varying(20),
    email character varying(100),
    num_guests integer,
    check_in date,
    check_out date,
    total_amount numeric(10,2),
    booking_status character varying(20),
    payment_status character varying(20),
    payment_method character varying(20),
    payment_proof_url text,
    special_requests text,
    internal_notes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    is_guest_booking boolean,
    upload_status text,
    upload_expires_at timestamp with time zone
);
ALTER TABLE public.bookings_conflict_backup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only access to conflict backups" ON public.bookings_conflict_backup
    USING (public.is_admin_or_owner(auth.uid()));

COMMIT;
```

- [x] **Step 7: Apply locally, regenerate types, run both tests and the #2 test**

```bash
npx supabase db reset
npm run gen:types
npx vitest run src/__tests__/database/retention-column-coverage.test.ts
npx vitest run src/__tests__/database/guest-anonymization.test.ts
npx vitest run src/__tests__/database/audit-anonymization.test.ts
```

Expected: all PASS. `audit-anonymization.test.ts` proves the refactored `anonymize_audit_logs` behaves as before. Afterwards check the stack is up: `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:54321/rest/v1/` → `200`.

- [x] **Step 8: Remove the backup table from the audit allowlist and the types comment**

In `src/__tests__/database/audit-trigger-coverage.test.ts` delete the line `bookings_conflict_backup: "one-off snapshot from a conflict cleanup, no writers",`. In `src/types/database.types.ts:13` remove `bookings_conflict_backup is a snapshot with no …` from the comment (keep the rest of the sentence grammatical). Then:

Run: `npx vitest run src/__tests__/database/audit-trigger-coverage.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [x] **Step 9: Commit**

```bash
git add supabase/migrations/20261021000000_guest_retention.sql supabase/rollbacks/20261021000000_rollback_guest_retention.sql \
  src/__tests__/database/guest-anonymization.test.ts src/__tests__/database/retention-column-coverage.test.ts \
  src/__tests__/database/audit-trigger-coverage.test.ts src/types/database.types.ts src/types/database.generated.ts
git commit -m "feat(db): anonymize a guest's personal data and audit rows in place"
```

---

### Task 2: Weekly batch, delete_guest, and the guests delete policy

**Files:**

- Modify: `supabase/migrations/20261021000000_guest_retention.sql` (append)
- Modify: `supabase/rollbacks/20261021000000_rollback_guest_retention.sql`
- Modify: `src/__tests__/database/guest-anonymization.test.ts` (append)
- Modify: `src/__tests__/database/rls-core-tables.test.ts:44`

**Interfaces:**

- Consumes: `anonymize_guest(uuid)`, `anonymize_booking(uuid)` from Task 1.
- Produces: `public.anonymize_expired_guests(p_older_than interval DEFAULT '24 months') RETURNS TABLE(guests_count bigint, bookings_count bigint, failed_count bigint, proof_paths text[])`; `public.delete_guest(p_guest_id uuid) RETURNS TABLE(proof_path text)` (raises `PT404`, `PT409`). Clients can no longer `DELETE` from `guests`.

- [ ] **Step 1: Append the failing tests**

Append to `src/__tests__/database/guest-anonymization.test.ts`:

```ts
describe("anonymize_expired_guests", () => {
  it("anonymizes guests past the window, skips recent ones and open balances", async () => {
    if (!canRun) return;
    const settled = await guestWithStay(25);
    await pay(settled.booking.booking_id, 5000);
    const recent = await guestWithStay(23);
    await pay(recent.booking.booking_id, 5000);
    const partial = await guestWithStay(25);
    await pay(partial.booking.booking_id, 1000);
    const cancelledUnpaid = await guestWithStay(25, "Cancelled");

    const { data, error } = await admin.rpc("anonymize_expired_guests");

    expect(error).toBeNull();
    expect(data?.[0]?.failed_count).toBe(0);
    const names = runPsql(`
      SELECT guest_id || '|' || guest_name FROM public.guests
      WHERE guest_id IN ('${settled.guest.guest_id}', '${recent.guest.guest_id}',
                         '${partial.guest.guest_id}', '${cancelledUnpaid.guest.guest_id}');
    `);
    expect(names).toEqual(
      expect.arrayContaining([
        `${settled.guest.guest_id}|Removed guest`,
        `${recent.guest.guest_id}|${recent.guest.guest_name}`,
        `${partial.guest.guest_id}|${partial.guest.guest_name}`,
        `${cancelledUnpaid.guest.guest_id}|Removed guest`,
      ])
    );
  });

  it("anonymizes an orphan booking past the window", async () => {
    if (!canRun) return;
    const { booking } = await guestWithStay(25);
    await pay(booking.booking_id, 5000);
    runPsql(
      `UPDATE public.bookings SET guest_id = NULL WHERE booking_id = '${booking.booking_id}';`
    );

    const { data, error } = await admin.rpc("anonymize_expired_guests");

    expect(error).toBeNull();
    expect(data?.[0]?.bookings_count).toBeGreaterThanOrEqual(1);
    expect(
      runPsql(`SELECT guest_name FROM public.bookings WHERE booking_id = '${booking.booking_id}';`)
    ).toEqual(["Removed guest"]);
  });

  it("keeps going when one guest fails", async () => {
    if (!canRun) return;
    const good = await guestWithStay(25);
    await pay(good.booking.booking_id, 5000);
    const bad = await guestWithStay(25);
    await pay(bad.booking.booking_id, 5000);
    runPsql(`
      CREATE FUNCTION public.test_fail_guest() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.guest_id = '${bad.guest.guest_id}' THEN RAISE EXCEPTION 'forced failure'; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_guest BEFORE UPDATE ON public.guests
        FOR EACH ROW EXECUTE FUNCTION public.test_fail_guest();
    `);
    try {
      const { data, error } = await admin.rpc("anonymize_expired_guests");

      expect(error).toBeNull();
      expect(data?.[0]?.failed_count).toBe(1);
      expect(
        runPsql(`SELECT guest_name FROM public.guests WHERE guest_id = '${good.guest.guest_id}';`)
      ).toEqual(["Removed guest"]);
      expect(
        runPsql(
          `SELECT guest_name FROM public.bookings WHERE booking_id = '${bad.booking.booking_id}';`
        )
      ).toEqual([bad.guest.guest_name]);
    } finally {
      runPsql(`
        DROP TRIGGER test_fail_guest ON public.guests;
        DROP FUNCTION public.test_fail_guest();
      `);
    }
  });
});

describe("delete_guest", () => {
  it("anonymizes the guest's bookings, then deletes the guest", async () => {
    if (!canRun) return;
    const { guest, booking } = await guestWithStay(3);

    const { error } = await admin.rpc("delete_guest", { p_guest_id: guest.guest_id });

    expect(error).toBeNull();
    expect(
      runPsql(`SELECT count(*) FROM public.guests WHERE guest_id = '${guest.guest_id}';`)
    ).toEqual(["0"]);
    expect(
      runPsql(
        `SELECT guest_name || '|' || coalesce(guest_id::text, 'null') FROM public.bookings WHERE booking_id = '${booking.booking_id}';`
      )
    ).toEqual(["Removed guest|null"]);
    expect(auditRowsMentioning(guest.email!)).toBe(0);
  });

  it("refuses a guest with a confirmed booking", async () => {
    if (!canRun) return;
    const { guest } = await guestWithStay(3, "Confirmed");

    const { error } = await admin.rpc("delete_guest", { p_guest_id: guest.guest_id });

    expect(error?.code).toBe("PT409");
  });

  it("clients can no longer delete guests directly", () => {
    if (!canRun) return;
    expect(
      runPsql(
        `SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'guests' AND cmd = 'DELETE';`
      )
    ).toEqual(["0"]);
  });

  it("only the service role can execute the batch and delete functions", () => {
    if (!canRun) return;
    for (const fn of ["public.anonymize_expired_guests(interval)", "public.delete_guest(uuid)"]) {
      expect(
        runPsql(`
          SELECT has_function_privilege('anon', '${fn}', 'EXECUTE'),
                 has_function_privilege('authenticated', '${fn}', 'EXECUTE'),
                 has_function_privilege('service_role', '${fn}', 'EXECUTE');
        `)
      ).toEqual(["f|f|t"]);
    }
  });
});
```

Note: `guestWithStay(3, "Confirmed")` has a past check-out, so the 409 comes from the Confirmed/CheckedIn rule of `delete_guest`, not from the future-booking rule.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/__tests__/database/guest-anonymization.test.ts`
Expected: FAIL (`anonymize_expired_guests` / `delete_guest` not found; policy count `1`).

- [ ] **Step 3: Append to the migration**

```sql
-- Weekly job: guests whose last check-out (or creation, with no bookings) is past the window
-- and who have no open balance; then bookings with no guest row, on their own check-out.
-- Each guest runs in its own subtransaction, so one failure does not stop the rest.
CREATE OR REPLACE FUNCTION public.anonymize_expired_guests(p_older_than interval DEFAULT interval '24 months')
RETURNS TABLE(guests_count bigint, bookings_count bigint, failed_count bigint, proof_paths text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cutoff timestamptz := now() - p_older_than;
    v_id uuid;
    v_guests bigint := 0;
    v_bookings bigint := 0;
    v_failed bigint := 0;
    v_paths text[] := '{}';
BEGIN
    FOR v_id IN
        SELECT g.guest_id FROM public.guests g
        WHERE g.anonymized_at IS NULL
          AND COALESCE(
                (SELECT max(b.check_out) FROM public.bookings b WHERE b.guest_id = g.guest_id),
                g.created_at
              ) < v_cutoff
          AND NOT EXISTS (
                SELECT 1 FROM public.bookings b
                WHERE b.guest_id = g.guest_id
                  AND COALESCE(b.payment_status, '') IN ('Pending', 'Partial')
                  AND b.booking_status IS DISTINCT FROM 'Cancelled')
    LOOP
        BEGIN
            v_paths := v_paths || ARRAY(SELECT a.proof_path FROM public.anonymize_guest(v_id) a);
            v_guests := v_guests + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            RAISE WARNING 'anonymize_guest(%) failed: %', v_id, SQLERRM;
        END;
    END LOOP;

    FOR v_id IN
        SELECT b.booking_id FROM public.bookings b
        WHERE b.guest_id IS NULL
          AND b.anonymized_at IS NULL
          AND b.check_out < v_cutoff
          AND NOT (COALESCE(b.payment_status, '') IN ('Pending', 'Partial')
                   AND b.booking_status IS DISTINCT FROM 'Cancelled')
    LOOP
        BEGIN
            v_paths := v_paths || ARRAY(SELECT a.proof_path FROM public.anonymize_booking(v_id) a);
            v_bookings := v_bookings + 1;
        EXCEPTION WHEN OTHERS THEN
            v_failed := v_failed + 1;
            RAISE WARNING 'anonymize_booking(%) failed: %', v_id, SQLERRM;
        END;
    END LOOP;

    RETURN QUERY SELECT v_guests, v_bookings, v_failed, v_paths;
END;
$$;

-- Guest delete always scrubs first: a bare DELETE left the name and contact on the
-- bookings (guest_id is ON DELETE SET NULL) and in the audit trail.
CREATE OR REPLACE FUNCTION public.delete_guest(p_guest_id uuid)
RETURNS TABLE(proof_path text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_paths text[];
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.guest_id = p_guest_id AND b.booking_status IN ('Confirmed', 'CheckedIn')
    ) THEN
        RAISE EXCEPTION 'Guest % has active bookings', p_guest_id USING ERRCODE = 'PT409';
    END IF;

    v_paths := ARRAY(SELECT a.proof_path FROM public.anonymize_guest(p_guest_id) a);

    -- guest_assignments.guest_id is ON DELETE RESTRICT
    DELETE FROM public.guest_assignments WHERE guest_id = p_guest_id;
    DELETE FROM public.guests WHERE guest_id = p_guest_id;

    RETURN QUERY SELECT unnest(v_paths);
END;
$$;

-- Deletes go through delete_guest (service role) so they cannot skip the scrub.
DROP POLICY IF EXISTS "guests_delete_manager" ON public.guests;

REVOKE ALL ON FUNCTION public.anonymize_expired_guests(interval) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_guest(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_expired_guests(interval) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_guest(uuid) TO service_role;
```

- [ ] **Step 4: Extend the rollback**

In `supabase/rollbacks/20261021000000_rollback_guest_retention.sql`, right after `BEGIN;` add:

```sql
DROP FUNCTION IF EXISTS public.delete_guest(uuid);
DROP FUNCTION IF EXISTS public.anonymize_expired_guests(interval);
CREATE POLICY "guests_delete_manager" ON public.guests
    FOR DELETE TO authenticated USING (public.is_manager_or_above());
```

- [ ] **Step 5: Update the RLS matrix**

In `src/__tests__/database/rls-core-tables.test.ts:44` change the guests entry to `delete: []` and extend the comment above `MATRIX` with: `// guests DELETE has no client policy: deletes go through delete_guest (20261021000000).` Read how the test treats an empty role list before running; if it skips empty lists, add an explicit assertion that a manager's delete affects 0 rows.

- [ ] **Step 6: Apply and run**

```bash
npx supabase db reset
npm run gen:types
npx vitest run src/__tests__/database/guest-anonymization.test.ts
npx vitest run src/__tests__/database/rls-core-tables.test.ts
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261021000000_guest_retention.sql supabase/rollbacks/20261021000000_rollback_guest_retention.sql \
  src/__tests__/database/guest-anonymization.test.ts src/__tests__/database/rls-core-tables.test.ts src/types/database.generated.ts
git commit -m "feat(db): weekly guest anonymization and scrub-first guest delete"
```

---

### Task 3: Shared proof-file deletion; cleanup returns `deleted_count`

**Files:**

- Create: `functions/lib/payment-proof-storage.ts`
- Create: `src/__tests__/api/payment-proof-storage.test.ts`
- Modify: `functions/scheduled/cleanup-payment-proofs.ts:41-96`
- Modify: `functions/api/cron/cleanup-payment-proofs.ts:35-46`
- Modify: `src/__tests__/api/cleanup-payment-proofs.test.ts`

**Interfaces:**

- Produces: `deletePaymentProofFiles(supabase: SupabaseClient<Database>, paths: string[], logger: Logger): Promise<{ deleted: string[]; failed: string[] }>`; `cleanupPaymentProofs(env): Promise<{ deletedCount: number }>`; endpoint JSON gains `deleted_count`.

- [ ] **Step 1: Write the failing helper test**

`src/__tests__/api/payment-proof-storage.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import { deletePaymentProofFiles } from "../../../functions/lib/payment-proof-storage";

const remove = vi.fn();
const supabase = {
  storage: { from: vi.fn(() => ({ remove })) },
} as unknown as SupabaseClient<Database>;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

describe("deletePaymentProofFiles", () => {
  beforeEach(() => {
    remove.mockReset();
    logger.warn.mockReset();
  });

  it("deletes the files and reports them", async () => {
    remove.mockResolvedValue({ data: [], error: null });

    await expect(deletePaymentProofFiles(supabase, ["a.png", "b.png"], logger)).resolves.toEqual({
      deleted: ["a.png", "b.png"],
      failed: [],
    });
    expect(remove).toHaveBeenCalledWith(["a.png", "b.png"]);
  });

  it("reports every file as failed and logs the paths when storage errors", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "denied" } });

    await expect(deletePaymentProofFiles(supabase, ["a.png"], logger)).resolves.toEqual({
      deleted: [],
      failed: ["a.png"],
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("a.png"));
  });

  it("skips storage when there is nothing to delete", async () => {
    await expect(deletePaymentProofFiles(supabase, [], logger)).resolves.toEqual({
      deleted: [],
      failed: [],
    });
    expect(remove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/api/payment-proof-storage.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

`functions/lib/payment-proof-storage.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import type { createLogger } from "./logger";

type Logger = ReturnType<typeof createLogger>;

/**
 * Deletes payment-proof files after their database references were cleared.
 * A failure is logged with the paths: nothing else points to those files any more.
 */
export async function deletePaymentProofFiles(
  supabase: SupabaseClient<Database>,
  paths: string[],
  logger: Logger
): Promise<{ deleted: string[]; failed: string[] }> {
  if (paths.length === 0) return { deleted: [], failed: [] };

  const { error } = await supabase.storage.from("payment-proofs").remove(paths);
  if (error) {
    logger.warn(
      `[WARN] Storage deletion failed: ${error.message}. Orphaned files: ${paths.join(", ")}`
    );
    return { deleted: [], failed: paths };
  }

  logger.info(`[STORAGE] Deleted ${paths.length} payment-proof files`);
  return { deleted: paths, failed: [] };
}
```

If `createLogger`'s return type is not exported this way, use the logger type `functions/lib/logger.ts` exports; check that file first.

- [ ] **Step 4: Use it in the cleanup job and return the count**

In `functions/scheduled/cleanup-payment-proofs.ts`: change the signature to `export async function cleanupPaymentProofs(env: Env): Promise<{ deletedCount: number }>`; replace the `if (filePaths.length > 0) { … }` storage block with:

```ts
const { deleted } = await deletePaymentProofFiles(supabase, filePaths, logger);
```

change the completion log to `${deleted.length} files deleted`, and replace `return;` (the success exit of the retry loop) with `return { deletedCount: deleted.length };`. Add the import `import { deletePaymentProofFiles } from "../lib/payment-proof-storage";`. Keep the alert on `filePaths.length`. After the loop add `throw new Error("unreachable");` only if TypeScript reports a missing return.

In `functions/api/cron/cleanup-payment-proofs.ts` replace `await cleanupPaymentProofs(env);` with `const { deletedCount } = await cleanupPaymentProofs(env);` and add `deleted_count: deletedCount,` to the success JSON.

- [ ] **Step 5: Extend the cleanup test**

In `src/__tests__/api/cleanup-payment-proofs.test.ts`, in "deletes the files the SQL function returns", change the call to `await expect(cleanupPaymentProofs(env)).resolves.toEqual({ deletedCount: 2 });`. In "skips storage when nothing expired" expect `{ deletedCount: 0 }`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/__tests__/api/payment-proof-storage.test.ts src/__tests__/api/cleanup-payment-proofs.test.ts && npx tsc --noEmit -p functions/tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add functions/lib/payment-proof-storage.ts functions/scheduled/cleanup-payment-proofs.ts functions/api/cron/cleanup-payment-proofs.ts \
  src/__tests__/api/payment-proof-storage.test.ts src/__tests__/api/cleanup-payment-proofs.test.ts
git commit -m "feat(api): report deleted proof files from the cleanup job"
```

---

### Task 4: Weekly anonymize-guests job, endpoint and schedule

**Files:**

- Create: `functions/scheduled/anonymize-guests.ts`
- Create: `functions/api/cron/anonymize-guests.ts`
- Create: `src/__tests__/api/anonymize-guests.test.ts`
- Modify: `.github/workflows/scheduled-cleanup.yml`

**Interfaces:**

- Consumes: `anonymize_expired_guests` (Task 2), `deletePaymentProofFiles` (Task 3), `verifyCronAuth` (`functions/lib/cron-auth.ts`).
- Produces: `anonymizeExpiredGuests(env): Promise<{ guestsCount: number; bookingsCount: number; failedCount: number; deletedFiles: string[]; failedFiles: string[] }>`; `POST /api/cron/anonymize-guests`.

- [ ] **Step 1: Write the failing test**

`src/__tests__/api/anonymize-guests.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../../../functions/api/cron/anonymize-guests";
import { anonymizeExpiredGuests } from "../../../functions/scheduled/anonymize-guests";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc, storage: { from: vi.fn(() => ({ remove })) } })),
}));

vi.mock("../../../functions/lib/logger", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  CRON_SECRET: "secret",
};

const post = (authorization?: string) =>
  onRequestPost({
    request: new Request("https://example.com/api/cron/anonymize-guests", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    }),
    env,
  });

const result = (failed = 0) => ({
  data: [{ guests_count: 2, bookings_count: 1, failed_count: failed, proof_paths: ["a.png"] }],
  error: null,
});

describe("anonymizeExpiredGuests", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("returns the counts and deletes the returned proof files", async () => {
    rpc.mockResolvedValue(result());

    await expect(anonymizeExpiredGuests(env)).resolves.toEqual({
      guestsCount: 2,
      bookingsCount: 1,
      failedCount: 0,
      deletedFiles: ["a.png"],
      failedFiles: [],
    });
    expect(rpc).toHaveBeenCalledWith("anonymize_expired_guests");
    expect(remove).toHaveBeenCalledWith(["a.png"]);
  });

  it("throws on a database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(anonymizeExpiredGuests(env)).rejects.toThrow("Database error: boom");
  });
});

describe("POST /api/cron/anonymize-guests", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("rejects requests without the cron secret", async () => {
    const response = await post();
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the job result", async () => {
    rpc.mockResolvedValue(result());

    const response = await post("Bearer secret");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      guests_count: 2,
      bookings_count: 1,
      failed_count: 0,
      deleted_files: 1,
    });
  });

  it("returns 500 when a guest failed, so the workflow step fails", async () => {
    rpc.mockResolvedValue(result(1));

    const response = await post("Bearer secret");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, failed_count: 1 });
  });

  it("returns 500 when the job throws", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await post("Bearer secret");

    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/api/anonymize-guests.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the job**

`functions/scheduled/anonymize-guests.ts`:

```ts
/**
 * Guest retention (RA 10173): anonymizes guests 24 months after their last check-out,
 * then deletes their payment-proof files. The rules live in the anonymize_expired_guests
 * SQL function; see docs/plans/2026-10-21-guest-retention-design.md.
 */

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "../lib/logger";
import { deletePaymentProofFiles } from "../lib/payment-proof-storage";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

export async function anonymizeExpiredGuests(env: Env): Promise<{
  guestsCount: number;
  bookingsCount: number;
  failedCount: number;
  deletedFiles: string[];
  failedFiles: string[];
}> {
  const logger = createLogger(env);
  const supabase = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("anonymize_expired_guests");
  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

  const row = data?.[0];
  const guestsCount = row?.guests_count ?? 0;
  const bookingsCount = row?.bookings_count ?? 0;
  const failedCount = row?.failed_count ?? 0;
  const { deleted, failed } = await deletePaymentProofFiles(
    supabase,
    row?.proof_paths ?? [],
    logger
  );

  logger.info(
    `[CRON] Guest anonymization: ${guestsCount} guests, ${bookingsCount} orphan bookings, ` +
      `${failedCount} failed, ${deleted.length} proof files deleted`
  );

  return { guestsCount, bookingsCount, failedCount, deletedFiles: deleted, failedFiles: failed };
}
```

- [ ] **Step 4: Implement the endpoint**

`functions/api/cron/anonymize-guests.ts`:

```ts
/**
 * HTTP endpoint for guest anonymization.
 * Triggered weekly by .github/workflows/scheduled-cleanup.yml (Bearer CRON_SECRET).
 * Returns 500 when any guest failed, so the workflow run fails and GitHub emails.
 */

import { verifyCronAuth } from "../../lib/cron-auth";
import { anonymizeExpiredGuests } from "../../scheduled/anonymize-guests";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  CRON_SECRET: string;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const startTime = Date.now();

  const auth = verifyCronAuth(request, env.CRON_SECRET);
  if (!auth.valid) {
    console.warn("[CRON] Unauthorized guest anonymization attempt:", auth.error);
    return Response.json({ error: "Unauthorized", message: auth.error }, { status: 401 });
  }

  try {
    const result = await anonymizeExpiredGuests(env);
    const success = result.failedCount === 0;

    return Response.json(
      {
        success,
        guests_count: result.guestsCount,
        bookings_count: result.bookingsCount,
        failed_count: result.failedCount,
        deleted_files: result.deletedFiles.length,
        failed_files: result.failedFiles,
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: success ? 200 : 500 }
    );
  } catch (error) {
    console.error("[CRON] Guest anonymization failed:", error);

    return Response.json(
      {
        success: false,
        error: "Anonymization failed",
        message: error instanceof Error ? error.message : "Unknown error",
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/__tests__/api/anonymize-guests.test.ts && npx tsc --noEmit -p functions/tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 6: Add the workflow job**

In `.github/workflows/scheduled-cleanup.yml`:

1. In the header comment, after the line ending `24 months; docs/plans/2026-10-18-audit-retention-design.md)`, add `#   and guest anonymization (24 months after the last check-out;` and `#   docs/plans/2026-10-21-guest-retention-design.md)`.
2. Change the weekly cron comment to `# Weekly, Sunday 3:00 AM UTC (11:00 AM PHT): payment proofs, audit and guest anonymization.`
3. Add `- anonymize-guests` under `options:` after `- anonymize-audit`.
4. Append this job at the end of the file:

```yaml
anonymize-guests:
  name: Anonymize Past Guests
  runs-on: ubuntu-latest
  # Run weekly on Sunday 3 AM UTC, or when manually triggered with 'all' or 'anonymize-guests'
  if: |
    github.event.schedule == '0 3 * * 0' ||
    (github.event_name == 'workflow_dispatch' && (github.event.inputs.task == 'all' || github.event.inputs.task == 'anonymize-guests'))
  steps:
    - name: Trigger guest anonymization
      run: |
        echo "Starting guest anonymization..."

        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
          -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
          -H "Content-Type: application/json" \
          "${{ env.PRODUCTION_URL }}/api/cron/anonymize-guests")

        HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
        BODY=$(echo "$RESPONSE" | sed '$d')

        echo "Response: $BODY"
        echo "HTTP Status: $HTTP_CODE"

        if [ "$HTTP_CODE" -ne 200 ]; then
          echo "::error::Guest anonymization failed with HTTP $HTTP_CODE"
          exit 1
        fi

        echo "Guest anonymization completed successfully"
```

Run: `npx prettier --check .github/workflows/scheduled-cleanup.yml && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/scheduled-cleanup.yml'))" && echo OK`
Expected: `OK`.

- [ ] **Step 7: Commit**

```bash
git add functions/scheduled/anonymize-guests.ts functions/api/cron/anonymize-guests.ts src/__tests__/api/anonymize-guests.test.ts .github/workflows/scheduled-cleanup.yml
git commit -m "feat(api): weekly guest anonymization job"
```

---

### Task 5: Admin anonymize and delete endpoints

**Files:**

- Create: `functions/lib/guest-retention.ts`
- Create: `functions/api/admin/guests/[guestId]/anonymize.ts`
- Create: `functions/api/admin/guests/[guestId].ts`
- Create: `src/__tests__/api/admin-guest-retention.test.ts`

**Interfaces:**

- Consumes: `anonymize_guest`, `delete_guest` (Tasks 1–2); `deletePaymentProofFiles` (Task 3); `requireRole`, `OWNER_OR_ABOVE`, `MANAGER_OR_ABOVE`, `UnauthorizedError`, `AuthenticatedData` (`functions/lib/rbac.ts`); `createMockContext`, `createMockRequest`, `generateTestJWT`, `mockEnv` (`src/__tests__/api/setup`).
- Produces: `POST /api/admin/guests/:guestId/anonymize` (owner/admin) and `DELETE /api/admin/guests/:guestId` (manager+). Both return `{ success: true, deleted_files: number, failed_files: string[] }`, or `{ error, message }` with 401/403/404/409/500.

- [ ] **Step 1: Write the failing test**

`src/__tests__/api/admin-guest-retention.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRole } from "../../../functions/lib/rbac";
import { createMockContext, createMockRequest, mockEnv } from "./setup";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc, storage: { from: vi.fn(() => ({ remove })) } })),
}));

const GUEST_ID = "11111111-1111-1111-1111-111111111111";

async function anonymizeAs(role: UserRole | null) {
  const { onRequestPost } = await import("../../../functions/api/admin/guests/[guestId]/anonymize");
  const request = createMockRequest(
    `https://api.example.com/api/admin/guests/${GUEST_ID}/anonymize`,
    {
      method: "POST",
    }
  );
  const context = {
    ...createMockContext(request, mockEnv, {}, role ? { id: "user-1", role } : undefined),
    params: { guestId: GUEST_ID },
  };
  return onRequestPost(context as never);
}

async function deleteAs(role: UserRole | null) {
  const { onRequestDelete } = await import("../../../functions/api/admin/guests/[guestId]");
  const request = createMockRequest(`https://api.example.com/api/admin/guests/${GUEST_ID}`, {
    method: "DELETE",
  });
  const context = {
    ...createMockContext(request, mockEnv, {}, role ? { id: "user-1", role } : undefined),
    params: { guestId: GUEST_ID },
  };
  return onRequestDelete(context as never);
}

describe("POST /api/admin/guests/:guestId/anonymize", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [{ proof_path: "a.png" }], error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("rejects a request with no user", async () => {
    expect((await anonymizeAs(null)).status).toBe(401);
  });

  it.each<UserRole>(["staff", "manager"])("forbids %s", async (role) => {
    expect((await anonymizeAs(role)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each<UserRole>(["owner", "admin"])(
    "lets %s anonymize and deletes the proof files",
    async (role) => {
      const response = await anonymizeAs(role);

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("anonymize_guest", { p_guest_id: GUEST_ID });
      expect(remove).toHaveBeenCalledWith(["a.png"]);
      await expect(response.json()).resolves.toEqual({
        success: true,
        deleted_files: 1,
        failed_files: [],
      });
    }
  );

  it.each([
    ["PT409", 409],
    ["PT404", 404],
    ["XX000", 500],
  ])("maps SQLSTATE %s to %i", async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "blocked" } });

    expect((await anonymizeAs("owner")).status).toBe(status);
  });
});

describe("DELETE /api/admin/guests/:guestId", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [], error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("forbids staff", async () => {
    expect((await deleteAs("staff")).status).toBe(403);
  });

  it("lets a manager delete through delete_guest", async () => {
    const response = await deleteAs("manager");

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("delete_guest", { p_guest_id: GUEST_ID });
  });

  it("maps active bookings to 409", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "active bookings" } });

    expect((await deleteAs("manager")).status).toBe(409);
  });
});
```

Check `createMockContext`'s signature in `src/__tests__/api/setup` before running; if it does not accept `undefined` for the user, pass the argument only when `role` is set.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/__tests__/api/admin-guest-retention.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the shared runner**

`functions/lib/guest-retention.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { createLogger } from "./logger";
import { deletePaymentProofFiles } from "./payment-proof-storage";
import { requireRole, UnauthorizedError, type AuthenticatedData, type UserRole } from "./rbac";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ENVIRONMENT?: string;
}

export interface GuestRetentionContext {
  env: Env;
  data: AuthenticatedData;
  params: { guestId?: string | string[] };
}

// PostgREST returns HTTP xyz for SQLSTATE PTxyz; anonymize_guest and delete_guest raise PT404 / PT409.
const STATUS_BY_SQLSTATE: Record<string, number> = { PT404: 404, PT409: 409 };

/** Runs anonymize_guest or delete_guest for an authorized caller, then deletes the proof files. */
export async function runGuestRetention(
  context: GuestRetentionContext,
  fn: "anonymize_guest" | "delete_guest",
  allowedRoles: UserRole[]
): Promise<Response> {
  try {
    requireRole(context.data.user, allowedRoles);
  } catch (error) {
    const status = error instanceof UnauthorizedError ? 401 : 403;
    return Response.json(
      { error: status === 401 ? "Unauthorized" : "Forbidden", message: (error as Error).message },
      { status }
    );
  }

  const guestId = context.params.guestId;
  if (typeof guestId !== "string") {
    return Response.json({ error: "Bad Request", message: "Missing guest id" }, { status: 400 });
  }

  const logger = createLogger(context.env);
  const supabase = createClient<Database>(
    context.env.SUPABASE_URL,
    context.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );

  const { data, error } = await supabase.rpc(fn, { p_guest_id: guestId });
  if (error) {
    const status = STATUS_BY_SQLSTATE[error.code ?? ""] ?? 500;
    if (status === 500) logger.error(`[GUEST] ${fn}(${guestId}) failed`, error);
    return Response.json({ error: fn, message: error.message }, { status });
  }

  const paths = (data ?? [])
    .map((row) => row.proof_path)
    .filter((path): path is string => Boolean(path));
  const { deleted, failed } = await deletePaymentProofFiles(supabase, paths, logger);

  return Response.json({ success: true, deleted_files: deleted.length, failed_files: failed });
}
```

- [ ] **Step 4: Implement both endpoints**

`functions/api/admin/guests/[guestId]/anonymize.ts`:

```ts
/** Owner/admin erasure request: anonymize one guest now (docs/plans/2026-10-21-guest-retention-design.md). */

import { runGuestRetention, type GuestRetentionContext } from "../../../../lib/guest-retention";
import { OWNER_OR_ABOVE } from "../../../../lib/rbac";

export const onRequestPost = (context: GuestRetentionContext): Promise<Response> =>
  runGuestRetention(context, "anonymize_guest", OWNER_OR_ABOVE);
```

`functions/api/admin/guests/[guestId].ts`:

```ts
/** Guest delete: delete_guest anonymizes the guest's bookings and audit rows first. */

import { runGuestRetention, type GuestRetentionContext } from "../../../lib/guest-retention";
import { MANAGER_OR_ABOVE } from "../../../lib/rbac";

export const onRequestDelete = (context: GuestRetentionContext): Promise<Response> =>
  runGuestRetention(context, "delete_guest", MANAGER_OR_ABOVE);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/__tests__/api/admin-guest-retention.test.ts && npx tsc --noEmit -p functions/tsconfig.json`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add functions/lib/guest-retention.ts "functions/api/admin/guests/[guestId]/anonymize.ts" "functions/api/admin/guests/[guestId].ts" \
  src/__tests__/api/admin-guest-retention.test.ts
git commit -m "feat(api): admin endpoints to anonymize and delete a guest"
```

---

### Task 6: Client mutations and delete gating

**Files:**

- Modify: `src/types/index.ts:34-42` (Guest), `src/types/index.ts:75` (Booking)
- Modify: `src/stores/useGuestStore.ts:255-290`
- Create: `src/stores/__tests__/guest-retention-mutations.test.tsx`
- Modify: `src/components/guests/GuestsTable.tsx:405-427`

**Interfaces:**

- Consumes: the Task 5 endpoints; `getAccessToken` (`src/hooks/useAuthToken.ts:88`).
- Produces: `useAnonymizeGuest(): UseMutationResult<{ deleted_files: number }, Error, string>`; `useDeleteGuest()` keeps its signature (`mutate(guestId)`); `Guest.anonymized_at?: string | null`; `Booking.anonymized_at?: string | null`.

- [ ] **Step 1: Add the optional fields**

In `src/types/index.ts` add `anonymized_at?: string | null;` to `interface Guest` (after `updated_at`) and to `interface Booking` (after `internal_notes`). Optional keeps existing fixtures valid.

- [ ] **Step 2: Write the failing mutation test**

`src/stores/__tests__/guest-retention-mutations.test.tsx`:

```tsx
import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAnonymizeGuest, useDeleteGuest } from "@/stores/useGuestStore";

vi.mock("@/hooks/useAuthToken", () => ({ getAccessToken: vi.fn(async () => "token") }));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
  >
    {children}
  </QueryClientProvider>
);

describe("guest retention mutations", () => {
  beforeEach(() => fetchMock.mockReset());

  it("anonymizes through the admin endpoint", async () => {
    fetchMock.mockResolvedValue(json({ success: true, deleted_files: 2, failed_files: [] }));
    const { result } = renderHook(() => useAnonymizeGuest(), { wrapper });

    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/guests/g1/anonymize", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    });
    expect(result.current.data).toMatchObject({ deleted_files: 2 });
  });

  it("surfaces the server message on 409", async () => {
    fetchMock.mockResolvedValue(
      json({ error: "anonymize_guest", message: "Guest g1 has a current or future booking" }, 409)
    );
    const { result } = renderHook(() => useAnonymizeGuest(), { wrapper });

    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("current or future booking");
  });

  it("deletes through the admin endpoint", async () => {
    fetchMock.mockResolvedValue(json({ success: true, deleted_files: 0, failed_files: [] }));
    const { result } = renderHook(() => useDeleteGuest(), { wrapper });

    result.current.mutate("g1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/guests/g1", {
      method: "DELETE",
      headers: { Authorization: "Bearer token" },
    });
  });
});
```

Run: `npx vitest run src/stores/__tests__/guest-retention-mutations.test.tsx`
Expected: FAIL (`useAnonymizeGuest` is not exported; delete calls Supabase, not fetch). If the store's zustand optimistic map needs a provider in tests, check an existing store test and copy its setup.

- [ ] **Step 3: Implement the mutations**

In `src/stores/useGuestStore.ts` add the import `import { getAccessToken } from "@/hooks/useAuthToken";` and, above `useDeleteGuest`:

```ts
async function callGuestRetention(path: string, method: "POST" | "DELETE") {
  const response = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  const body = (await response.json().catch(() => ({}))) as {
    deleted_files?: number;
    message?: string;
  };
  if (!response.ok) throw new Error(body.message ?? `Request failed (${response.status})`);
  return { deleted_files: body.deleted_files ?? 0 };
}

// Erasure request (owner/admin): personal data is cleared, money and dates stay
export const useAnonymizeGuest = () =>
  useMutation({
    mutationFn: (guestId: string) =>
      callGuestRetention(`/api/admin/guests/${guestId}/anonymize`, "POST"),
    onSuccess: () => {
      invalidateGuests();
    },
  });
```

In `useDeleteGuest`, replace the whole `mutationFn` body (the Supabase active-bookings check and the `.delete()`) with:

```ts
    mutationFn: (guestId: string) => callGuestRetention(`/api/admin/guests/${guestId}`, "DELETE"),
```

`delete_guest` enforces the active-bookings rule (409 with its message). Remove imports that become unused. Check that `invalidateGuests()` also invalidates `guestKeys.detail(...)`; if it does not, invalidate `guestKeys.all` in `useAnonymizeGuest`'s `onSuccess` with the hook's `queryClient`.

- [ ] **Step 4: Show Delete to managers and above only**

In `src/components/guests/GuestsTable.tsx`: import `useUserRole` from `@/hooks`, read `const { isManager } = useUserRole();` in `GuestsTableComponent`, and include the "Delete Guest" action only when `isManager` (spread `...(isManager ? [{ label: "Delete Guest", … }] : [])`). Add `isManager` to the `useMemo` dependency list of the columns.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/stores/__tests__/guest-retention-mutations.test.tsx src/components/guests && npx tsc --noEmit`
Expected: PASS, no type errors. Fix any existing GuestsTable test that relied on Delete being visible without a role mock (mock `useUserRole` as in `booking-card.test.tsx`).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/stores/useGuestStore.ts src/stores/__tests__/guest-retention-mutations.test.tsx src/components/guests/GuestsTable.tsx
git commit -m "feat(guest): anonymize and delete guests through the admin endpoints"
```

---

### Task 7: Anonymize action, anonymized state, labels

**Files:**

- Create: `src/lib/guests/retention.ts`, `src/lib/guests/__tests__/retention.test.ts`
- Create: `src/components/guests/GuestDetail/AnonymizeGuestDialog.tsx`, `src/components/guests/GuestDetail/__tests__/AnonymizeGuestDialog.test.tsx`
- Modify: `src/components/guests/GuestDetail/index.tsx`
- Modify: `src/components/bookings/BookingDetail/index.tsx:52-66`
- Modify: `src/components/audit/AuditDiffViewer.tsx:132`, `src/components/audit/__tests__/AuditDiffViewer.test.tsx:502`

**Interfaces:**

- Consumes: `useAnonymizeGuest` (Task 6), `useUserRole().isOwner`, `Guest.anonymized_at`, `Booking.anonymized_at`.
- Produces: `anonymizeBlockers(bookings: RetentionBooking[], now: Date): { hasCurrentOrFutureBooking: boolean; openBalanceCount: number }` where `RetentionBooking = { booking_status: string | null; payment_status: string | null; check_out: string }`; `<AnonymizeGuestDialog guestName bookings onConfirm isPending />`.

Read `DESIGN.md` before this task (CLAUDE.md requires it for UI work).

- [ ] **Step 1: Write the failing blockers test**

`src/lib/guests/__tests__/retention.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { anonymizeBlockers } from "../retention";

const now = new Date("2026-10-21T00:00:00Z");
const booking = (
  overrides: Partial<{ booking_status: string; payment_status: string; check_out: string }>
) => ({
  booking_status: "CheckedOut",
  payment_status: "Completed",
  check_out: "2025-01-02T04:00:00Z",
  ...overrides,
});

describe("anonymizeBlockers", () => {
  it("finds nothing for settled past stays", () => {
    expect(anonymizeBlockers([booking({})], now)).toEqual({
      hasCurrentOrFutureBooking: false,
      openBalanceCount: 0,
    });
  });

  it("flags a current or future booking unless cancelled", () => {
    expect(
      anonymizeBlockers(
        [booking({ check_out: "2026-11-01T04:00:00Z", booking_status: "Confirmed" })],
        now
      ).hasCurrentOrFutureBooking
    ).toBe(true);
    expect(
      anonymizeBlockers(
        [booking({ check_out: "2026-11-01T04:00:00Z", booking_status: "Cancelled" })],
        now
      ).hasCurrentOrFutureBooking
    ).toBe(false);
  });

  it("counts open balances on bookings that are not cancelled", () => {
    expect(
      anonymizeBlockers(
        [
          booking({ payment_status: "Partial" }),
          booking({ payment_status: "Pending" }),
          booking({ payment_status: "Pending", booking_status: "Cancelled" }),
        ],
        now
      ).openBalanceCount
    ).toBe(2);
  });
});
```

Run: `npx vitest run src/lib/guests/__tests__/retention.test.ts` → FAIL (module not found).

- [ ] **Step 2: Implement it**

`src/lib/guests/retention.ts`:

```ts
// Mirrors the anonymize_guest refusal and the weekly job's open-balance rule
// (supabase/migrations/20261021000000_guest_retention.sql) for the confirm dialog.

export interface RetentionBooking {
  booking_status: string | null;
  payment_status: string | null;
  check_out: string;
}

const OPEN_BALANCE = ["Pending", "Partial"];

export function anonymizeBlockers(bookings: RetentionBooking[], now: Date) {
  const live = bookings.filter((booking) => booking.booking_status !== "Cancelled");
  return {
    hasCurrentOrFutureBooking: live.some((booking) => new Date(booking.check_out) > now),
    openBalanceCount: live.filter((booking) => OPEN_BALANCE.includes(booking.payment_status ?? ""))
      .length,
  };
}
```

Run the test again → PASS.

- [ ] **Step 3: Write the failing dialog test**

`src/components/guests/GuestDetail/__tests__/AnonymizeGuestDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnonymizeGuestDialog } from "../AnonymizeGuestDialog";

// src/test/setup.ts pins the clock to 2025-09-25
const past = {
  booking_status: "CheckedOut",
  payment_status: "Completed",
  check_out: "2025-01-02T04:00:00Z",
};

async function open(props: Partial<Parameters<typeof AnonymizeGuestDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  render(
    <AnonymizeGuestDialog
      guestName="Ana Cruz"
      bookings={[past]}
      onConfirm={onConfirm}
      isPending={false}
      {...props}
    />
  );
  await userEvent.click(screen.getByRole("button", { name: "Anonymize guest" }));
  return onConfirm;
}

describe("AnonymizeGuestDialog", () => {
  it("enables the action only after the guest name is typed", async () => {
    const onConfirm = await open();
    const confirm = screen.getByRole("button", { name: "Anonymize" });

    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type the guest's name/i), "Ana Cruz");
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("warns about open balances", async () => {
    await open({ bookings: [{ ...past, payment_status: "Partial" }] });

    expect(screen.getByText(/1 booking has an unpaid balance/i)).toBeInTheDocument();
  });

  it("disables the trigger while a booking is current or upcoming", () => {
    render(
      <AnonymizeGuestDialog
        guestName="Ana Cruz"
        bookings={[{ ...past, booking_status: "Confirmed", check_out: "2025-10-02T04:00:00Z" }]}
        onConfirm={vi.fn()}
        isPending={false}
      />
    );

    expect(screen.getByRole("button", { name: "Anonymize guest" })).toBeDisabled();
    expect(screen.getByText(/cancel or finish the upcoming booking first/i)).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/components/guests/GuestDetail/__tests__/AnonymizeGuestDialog.test.tsx` → FAIL (module not found).

- [ ] **Step 4: Implement the dialog**

`src/components/guests/GuestDetail/AnonymizeGuestDialog.tsx`:

```tsx
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { anonymizeBlockers, type RetentionBooking } from "@/lib/guests/retention";

interface AnonymizeGuestDialogProps {
  guestName: string;
  bookings: RetentionBooking[];
  onConfirm: () => void;
  isPending: boolean;
}

export function AnonymizeGuestDialog({
  guestName,
  bookings,
  onConfirm,
  isPending,
}: AnonymizeGuestDialogProps) {
  const [typedName, setTypedName] = useState("");
  const { hasCurrentOrFutureBooking, openBalanceCount } = anonymizeBlockers(bookings, new Date());

  return (
    <div className="flex flex-col items-end gap-1">
      <AlertDialog onOpenChange={() => setTypedName("")}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={hasCurrentOrFutureBooking || isPending}>
            Anonymize guest
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anonymize guest</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {guestName}&apos;s name, contact details, notes and payment proofs from
              this guest, their bookings and the audit trail. Amounts and dates stay. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {openBalanceCount > 0 && (
            <p className="text-warning-foreground text-sm font-medium">
              {openBalanceCount === 1
                ? "1 booking has an unpaid balance."
                : `${openBalanceCount} bookings have an unpaid balance.`}{" "}
              You will not be able to contact this guest about it.
            </p>
          )}
          <div className="grid gap-2">
            <Label htmlFor="anonymize-confirm-name">Type the guest&apos;s name to confirm</Label>
            <Input
              id="anonymize-confirm-name"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={typedName.trim() !== guestName.trim() || isPending}
              onClick={onConfirm}
              className={buttonVariants({ variant: "destructive" })}
            >
              Anonymize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {hasCurrentOrFutureBooking && (
        <p className="text-muted-foreground text-xs">
          Cancel or finish the upcoming booking first.
        </p>
      )}
    </div>
  );
}
```

Check `DESIGN.md` for the warning text token; if `text-warning-foreground` is not a defined token, use the warning `Callout` from `@/components/patterns` instead of the `<p>`. Run the dialog test → PASS.

- [ ] **Step 5: Wire it into the guest detail page**

In `src/components/guests/GuestDetail/index.tsx`:

1. Add `"payment_status"` to the `Pick<Booking, …>` list in `GuestDetailPageProps`.
2. Import `toast` from `sonner`, `useUserRole` from `@/hooks`, `useAnonymizeGuest` from `@/stores/useGuestStore`, `StatusBadge` is already imported, and `AnonymizeGuestDialog` from `./AnonymizeGuestDialog`.
3. At the top of `GuestDetailPage`:

```tsx
const { isOwner } = useUserRole();
const anonymizeGuest = useAnonymizeGuest();
const isAnonymized = Boolean(guest.anonymized_at);

const handleAnonymize = () =>
  anonymizeGuest.mutate(guestId, {
    onSuccess: ({ deleted_files }) =>
      toast.success(`Guest anonymized. ${deleted_files} payment proof file(s) deleted.`),
    onError: (error) => toast.error(error.message),
  });
```

4. On `DetailPageLayout` pass:

```tsx
      status={
        isAnonymized ? (
          <StatusBadge tone="neutral">
            Anonymized on {formatFullDate(guest.anonymized_at!)}
          </StatusBadge>
        ) : undefined
      }
      actions={
        isOwner && !isAnonymized ? (
          <AnonymizeGuestDialog
            guestName={guest.guest_name}
            bookings={guest.bookings ?? []}
            onConfirm={handleAnonymize}
            isPending={anonymizeGuest.isPending}
          />
        ) : undefined
      }
      editRoute={isAnonymized ? undefined : { to: "/admin/guests/$guestId/edit", params: { guestId } }}
```

Check `src/components/patterns/DetailPageLayout.tsx:61` renders `actions` together with the Edit link; if it renders only one, put the Edit link inside `actions` the way that file expects.

5. In the Email and Phone fields, show `<span className="text-muted-foreground">Removed</span>` when `isAnonymized` (before the existing `guest.email ? … : —` check).

- [ ] **Step 6: Booking detail badge and the audit label**

In `src/components/bookings/BookingDetail/index.tsx`:

```tsx
      status={
        <>
          <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
          {booking.anonymized_at && (
            <StatusBadge tone="neutral">Anonymized on {formatFullDate(booking.anonymized_at)}</StatusBadge>
          )}
        </>
      }
      editRoute={
        canEdit && !booking.anonymized_at
          ? { to: "/admin/bookings/$bookingId/edit", params: { bookingId } }
          : undefined
      }
```

In `src/components/audit/AuditDiffViewer.tsx:132` change `"Details removed after the retention period"` to `"Details removed"`, and the same string in `src/components/audit/__tests__/AuditDiffViewer.test.tsx:502`.

- [ ] **Step 7: Run the UI tests**

Run: `npx vitest run src/lib/guests src/components/guests src/components/bookings src/components/audit && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 8: Browser check (local, `run` skill: `supabase start`, vite + `npm run dev:wrangler`)**

As owner: open a seeded guest with only past, paid stays → "Anonymize guest" → type the name → Anonymize → toast, page shows "Removed guest", the badge, "Removed" contact fields, no Edit. Open one of their bookings → badge, no Edit, guest name "Removed guest". Audit section shows "Details removed". As manager: the guest page has no Anonymize action; Guests table Delete works on a guest with no active bookings. As staff: no Delete in the Guests table. Take a screenshot of each state, Read each one, and record what it shows in this step.

- [ ] **Step 9: Commit**

```bash
git add src/lib/guests src/components/guests/GuestDetail src/components/bookings/BookingDetail/index.tsx \
  src/components/audit/AuditDiffViewer.tsx src/components/audit/__tests__/AuditDiffViewer.test.tsx
git commit -m "feat(guest): anonymize action and anonymized state on detail pages"
```

---

### Task 8: Verify, docs, PR, prod

- [ ] **Step 1: Full verification**

Run, one at a time: `npm run verify`, then `npm run test:db`, then `npm run build`. Expected: each exits 0. Quote the pass counts in the PR body. Check the Supabase stack is still up afterwards (CLAUDE.md, "Vitest global setup stops Supabase").

- [ ] **Step 2: Docs**

- `src/components/audit/CLAUDE.md`: add one line: "Guest anonymization (`anonymize_guest`, 20261021000000) scrubs a guest's audit rows at any age with the same rules and marker."
- `docs/plans/2026-10-03-guardrails-design.md`: item 8 → DONE with the PR number; Resume state updated.
- Tick the steps in this plan.

- [ ] **Step 3: Push and open the PR**

Push with `timeout: 600000` (CLAUDE.md, pre-push hook). Use the `mattpocock-skills:pr` skill for the body. Merge with `gh pr merge --auto --merge` after the user approves. Verify with `git fetch origin && git rev-parse HEAD origin/main` after merge.

- [ ] **Step 4: Prod (user)**

1. `! supabase db push` — it must list only `20261021000000_guest_retention.sql`.
2. `! npm run drift:prod` — expected: no new drift.
3. GitHub Actions → Scheduled Cleanup Tasks → Run workflow → `anonymize-guests`. Expected: HTTP 200, `guests_count: 0` (prod data starts 2025-10).
4. Also run `payment-proofs` once and confirm the response now has `deleted_count`.
5. Optional: anonymize one test guest on prod from its page and confirm `select count(*) from audit_logs where concat(old_data::text, new_data::text) like '%<test email>%'` returns 0.

---

## Decisions & Deferrals

- **A cancelled future booking does not block a manual anonymize (2026-10-21, plan).** Why: the spec said "a booking with check_out in the future"; a cancelled one holds no stay to serve. Revisit: n/a.
- **Guests with no bookings use `created_at` as their clock (2026-10-21, plan).** Why: otherwise a guest row with no stays keeps data forever. Revisit: n/a.
- **`anonymize_audit_logs` now calls the shared `_anonymize_audit_rows` helper (2026-10-21, plan).** Why: one copy of the audit rules; `audit-anonymization.test.ts` proves the behaviour is unchanged. Revisit: n/a.
- **`cleanup_expired_payment_proofs` keeps its own path regexp (2026-10-21, plan).** Why: changing it adds a prod function change outside this item; `_payment_proof_path` copies the same expression. Revisit: next time that function changes.
- **Guest delete is manager+ in the UI too (2026-10-21, plan).** Why: the UI showed Delete to staff, whose request RLS rejected; the endpoint now enforces manager+. Revisit: if delete should be owner/admin only (spec Decisions).
- **Run with `/mattpocock-skills:implement` in a worktree; one PR carries spec, plan and code (2026-10-21, user).** Why: no GitHub tickets exist, so `implement-spec` does not fit, and the tasks are mostly sequential; the docs branch `docs/guest-retention-design` is the worktree's base and is not pushed separately. Revisit: n/a.
