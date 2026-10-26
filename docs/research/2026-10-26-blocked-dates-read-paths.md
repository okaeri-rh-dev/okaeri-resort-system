# Blocked dates: schema and read paths (from code)

Research for issue #154 (map #153). Sources are the repo's migrations and source at commit 617d0324. **Prod state is not verified here**: nothing below was checked against the production database. Whether `availability_blackouts` exists on prod, its live columns/RLS and its rows must be checked separately (for example with the migration list in section 1).

## 1. `public.availability_blackouts` as the migrations define it

Columns (`supabase/migrations/20251014235258_create_availability_blackouts.sql:18-28`):

| column                 | type                      | notes                                                           |
| ---------------------- | ------------------------- | --------------------------------------------------------------- |
| blackout_id            | UUID PK                   | default `uuid_generate_v4()`                                    |
| unit_id                | UUID, nullable            | FK `units(unit_id)` ON DELETE CASCADE                           |
| blackout_type          | VARCHAR(20) NOT NULL      | CHECK in ('Maintenance','Renovation','Seasonal','Manual')       |
| start_date             | DATE NOT NULL             | comment: inclusive (line 63-64)                                 |
| end_date               | DATE NOT NULL             | CHECK `end_date >= start_date`; comment: inclusive (line 66-67) |
| reason                 | TEXT                      |                                                                 |
| created_by             | VARCHAR(100)              | free text, not an FK to auth users                              |
| created_at, updated_at | TIMESTAMPTZ default NOW() | no trigger maintains updated_at                                 |

Indexes: GiST on `(unit_id, daterange(start_date, end_date, '[]'))` and B-tree on `(start_date, end_date)` (lines 35-43). No exclusion constraint, so overlapping blocks are allowed. Grants: SELECT to anon and authenticated (lines 50-51).

RLS (`20260209120000_security_hardening.sql:150-179`): RLS enabled; `availability_blackouts_select_public` lets anon and authenticated SELECT all rows; `availability_blackouts_manage_staff` lets any authenticated user with an active `app_roles` row of admin/owner/manager/staff do ALL.

Triggers: only `audit_availability_blackouts_trigger` (AFTER INSERT/UPDATE/DELETE, `audit_trigger_func('blackout_id')`), from `20261005000000_audit_trigger_full_coverage.sql:87-122`. That migration skips the table if it is absent (`to_regclass` check, line 106), so it succeeds on a database that lacks the table.

Not in the `supabase_realtime` publication in any migration, although `src/hooks/useMultiUnitRealtime.ts:113-123` subscribes to it.

### Migrations since 20251014235258 that touch the table or the public RPC

Check prod's `supabase_migrations.schema_migrations` against this list:

1. `20251014235258_create_availability_blackouts.sql`: creates the table, indexes, grants.
2. `20251015000622_create_public_availability_function.sql`: creates `get_public_aggregate_availability(DATE, DATE)`, grants EXECUTE to anon/authenticated (lines 146-147).
3. `20251019000000_hotfix_availability_timezone.sql`: redefines the RPC (Manila timezone).
4. `20260209000000_fix_calendar_availability_sync.sql`: redefines the RPC to read `booking_unit_availability`.
5. `20260209120000_security_hardening.sql`: enables RLS and the two policies on the table; DROPs and re-CREATEs the RPC with `SET search_path = ''` (lines 879-970). No GRANT follows the re-create in any migration; anon access then relies on Postgres/Supabase default EXECUTE privileges.
6. `20261005000000_audit_trigger_full_coverage.sql`: audit trigger on the table (if it exists).

No other migration names `availability_blackouts` or `get_public_aggregate_availability`.

## 2. Which read paths respect blocks

| path                                                           | respects blocks | evidence                                                                            |
| -------------------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| Public calendar RPC `get_public_aggregate_availability`        | Partly          | latest def `20260209120000_security_hardening.sql:948-967`                          |
| Admin availability check (`check_multi_unit_availability`)     | No              | `20261011120000_normalize_booking_stays.sql:89-117`                                 |
| Admin "available units" for assigning guest bookings           | No              | `functions/api/admin/available-units.ts:204-249`                                    |
| Guest online booking API                                       | No              | `functions/api/guest-booking/multi-unit.ts:244-245`                                 |
| Booking create (`createBooking` / `create_multi_unit_booking`) | No              | `src/lib/bookings/create.ts:45`, `20261011120000_normalize_booking_stays.sql:15-84` |
| Guest booking unit assignment (`assign_units_to_booking`)      | No              | `20261013000000_online_booking.sql:147-202`                                         |

### Public calendar RPC

Called by `functions/api/public/v1/availability.ts:260` (anon key) and rendered by `src/components/calendar/PublicAvailabilityCalendar.tsx:95`. The `blackout_per_day` CTE (`security_hardening.sql:948-958`) counts `COUNT(DISTINCT ab.unit_id)` for rows where `ab.unit_id IN (Available units)` and `ds.date >= start_date AND ds.date < end_date`, and subtracts that from the Available-unit total (line 964). Three defects:

- **NULL `unit_id` rows count for nothing.** `NULL IN (...)` is never true, so a resort-wide block (unit_id NULL) is ignored; `COUNT(DISTINCT NULL)` would also be 0.
- **The last day is not blocked.** The column comments say `end_date` is inclusive, but the RPC uses `< end_date`. A one-day block (start = end) blocks nothing.
- `DATE AT TIME ZONE 'Asia/Manila'` first casts the DATE to timestamptz in the session time zone; with UTC sessions it yields the same date, so this is harmless today but depends on session TZ.

Also, the endpoint reports `totalUnits: 3` hardcoded (`functions/api/public/v1/availability.ts:284`).

### Admin availability check

`src/lib/bookings/availability.ts` only formats results (`unavailableReason`, lines 15-25). The data comes from `useMultiUnitAvailability` (`src/hooks/useMultiUnitBookingQueries.ts:36-49`) → `GET /api/availability/multi-unit` → RPC `check_multi_unit_availability` (`functions/api/availability/multi-unit.ts:119`). The latest RPC definition joins only `booking_unit_availability` (Confirmed/CheckedIn overlaps) and filters `u.unit_status = 'Available'` (`normalize_booking_stays.sql:107-115`). No reference to `availability_blackouts`. `db.availability.checkMultiUnitAvailability` (`src/lib/supabase.ts:216-222`) calls the same RPC.

### Guest online booking API

`functions/api/guest-booking/multi-unit.ts` only caps the request at the count of Available units (lines 227-241) and states "We do NOT validate availability ... Admin handles availability during unit assignment" (line 244). The RPC `create_guest_booking` (`20261013000000_online_booking.sql:63-136`) inserts the booking with no availability or blackout check. Assignment later goes through `functions/api/admin/available-units.ts` (Available units minus Confirmed/CheckedIn overlaps from `booking_unit_availability`, lines 204-249) and `assign_units_to_booking` (online_booking.sql:147-202), which relies on the `booking_unit_availability` exclusion constraint. Neither reads blackouts.

### Booking create path

`createBooking` (`src/lib/bookings/create.ts:39-71`) calls `create_multi_unit_booking`, which inserts `bookings`, `booking_units` and `booking_unit_availability` rows with no check (`normalize_booking_stays.sql:15-84`). The Worker `functions/api/bookings/multi-unit.ts:202-223` pre-checks with `check_multi_unit_availability` and returns 409 for unavailable units, so it inherits that RPC's blindness to blocks. The only DB-level guard is the `booking_unit_availability` exclusion constraint (`20251008152700_multi_unit_schema.sql:112, 133`), which covers bookings only.

### Callers of `db.blackouts`

`db.blackouts` (`src/lib/supabase.ts:301-316`) has no callers in `src/` or `functions/` outside tests. There is no UI to create, list or edit blocks.

## 3. `units.unit_status = 'Maintenance'` today

It is all-or-nothing and undated: a unit not 'Available' (Maintenance, Occupied, Reserved; `src/types/index.ts:9`) disappears from every availability calculation for all dates.

- Public calendar: total = count of Available units, and bookings/blocks only counted on Available units (`security_hardening.sql:914-916, 944, 954`). A Maintenance unit lowers capacity on every date.
- Admin check: `check_multi_unit_availability` omits non-Available units (`normalize_booking_stays.sql:114`); the form shows "Not available" for a missing unit (`src/lib/bookings/availability.ts:14,21`; used in `src/components/bookings/BookingForm.tsx:196,346`). The create Worker rejects with 409 (`functions/api/bookings/multi-unit.ts:209-223`).
- Guest booking: caps requested cabins at the Available count (`functions/api/guest-booking/multi-unit.ts:228-241`); `rates.ts:55-58` reports that count as `max_units_in_system`.
- Unit assignment: `functions/api/admin/available-units.ts:208` lists only Available units.
- UI: unit card availability `src/components/bookings/MultiUnitSelector.tsx:294`; dashboard count `src/components/dashboard/DashboardStats.tsx:29`; set via units table (`src/components/units/UnitsTable/components/TableHeader.tsx:188`, `UnitColumns.tsx:119-128`).
- Existing bookings on that unit are not touched or flagged.

## 4. `maintenance_logs` in app code

Not read or written by app code. The only non-test, non-generated references are labels in the audit log filter: `src/lib/audit-constants.ts:27` (`PHYSICAL_AUDIT_TABLES`) and `:66` (display name "Maintenance"). No `from("maintenance_logs")` in `src/` or `functions/`. It appears in migrations only (remote_schema dumps, grants, RLS, retention/anonymization).

## Not verified

- Anything about prod: table existence, live columns, RLS, rows, applied migrations, and whether anon can EXECUTE the re-created RPC.
- Runtime behaviour: no queries or tests were run; the NULL-`unit_id` and exclusive-end findings are read from SQL, not executed.
- `*.phase3-4` files and Supabase edge functions were not reviewed.
