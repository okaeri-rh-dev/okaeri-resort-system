# afterWrite inputs on today's main: tables, key roots, cascades

Question (issue #341, map #262): which tables the client writes, which query-key roots read each one, and which trigger or foreign-key cascades a client write can set off. The result is diffed against `READERS` / `CASCADES` in Task 2 of `docs/plans/2026-10-14-invalidate-by-domain-fact.md` (plan lines 360-404).

Checked against `main` at `2c3d944a`. Sources: `src/` query and mutation code, `functions/api/` routes, `supabase/migrations/` (latest definition of each trigger and function), `src/types/database.generated.ts`. Status is against the plan: **same**, **changed**, **new** (not in the plan) or **gone** (in the plan, no longer true).

## 1. READERS: table → key roots whose fetch reads it

Roots are named by factory (`src/lib/query-keys.ts`) with the root string. "Availability" below means `availabilityKeys.availableUnits.all` (`available-units`) and `availabilityKeys.multiUnit.all` (`multi-unit-availability`), the plan's `AVAILABILITY`.

| Table | Key roots that read it today | Status | Evidence |
|---|---|---|---|
| `bookings` | `bookingKeys` (list, detail, adminDetail), `guestKeys` (detail embeds `bookings(*)`, `guestKeys.bookings`), `paymentKeys` (detail and list embed `booking:bookings`), `multiUnitBookingKeys.pending`, **`availabilityKeys.calendar`** (`availability-calendar`), **`availabilityKeys.blackouts`** (`unit-blackouts`, conflicts) | changed: + calendar, + blackouts | `useBookingStore.ts:320`, `supabase.ts:166-180`, `supabase.ts:276-286`, `useGuestStore.ts:188-200`, `usePaymentStore.ts:89,125`, `functions/api/admin/pending-bookings.ts:83`, `functions/api/admin/bookings/[bookingId].ts:169`, `supabase.ts:183-191` (`unitStaysInNights` embeds `booking:bookings`), `useBlocks.ts:168-174` → `get_block_conflicts` → `find_block_conflicts` reads `bookings` (`20261027100000_block_conflicts.sql:39`) |
| `booking_units` | `bookingKeys` (list embed and unit filter), `guestKeys` (`guestKeys.bookings` embed) | same | `useBookingStore.ts:306,320-327`, `useGuestStore.ts:192-197` |
| `booking_unit_availability` | Availability (both API routes call `check_multi_unit_availability`), **`unitKeys`** (`unitKeys.states` via `get_cabin_states`), **`availabilityKeys.calendar`**, **`availabilityKeys.blackouts`** (conflicts) | changed: + units, + calendar, + blackouts | `functions/api/admin/available-units.ts:209`, `functions/api/availability/multi-unit.ts:86`, `20261027200000_availability_honours_blocks.sql:52`, `useUnitStore.ts:332` → `20261027300000_derived_cabin_state.sql:31`, `supabase.ts:183-191`, `20261027100000_block_conflicts.sql:55,73,89` |
| `guests` | `guestKeys`, `bookingKeys` (embed `guest:guests`), `paymentKeys` (detail embeds `guest:guests`) | same | `useGuestStore.ts:137`, `supabase.ts:162,176`, `usePaymentStore.ts:97` |
| `guest_booking_unit_requests` | `bookingKeys` (adminDetail sits under `bookingKeys.detail`), `multiUnitBookingKeys.pending` | same | `functions/api/admin/bookings/[bookingId].ts:184`, `functions/api/admin/pending-bookings.ts:96` |
| `units` | `unitKeys`, `bookingKeys` (embed), `guestKeys` (`guestKeys.bookings` embed), Availability, **`availabilityKeys.blackouts`** (conflicts join `units`); memo `pricingKeys` (`/api/pricing/calculate` reads `units`) | changed: + blackouts, + pricing memo | `useUnitStore.ts:105,117,132`, `useBookingStore.ts:322-326`, `useGuestStore.ts:195`, `functions/api/admin/available-units.ts:190`, `functions/api/availability/multi-unit.ts:106`, `20261027100000_block_conflicts.sql:74,90`, `functions/api/pricing/calculate.ts:151,211` |
| `payments` | `paymentKeys`, `accountKeys` (balances RPC), **`bookingKeys`** (list embeds `payments(amount, status)`) | changed: + bookings | `usePaymentStore.ts:85,121`, `useAccountStore.ts:155` → `20261102000000_guest_statistics_definer_manila_balances.sql` (balances read `payments` Active only), `useBookingStore.ts:327` |
| `expenses` | `expenseKeys`, `accountKeys` | same | `useExpenseStore.ts:146,217`, balances RPC |
| `accounts` | `accountKeys`, `transferKeys` (embeds `from_account`/`to_account`) | same | `useAccountStore.ts:112,133,155`, `useTransferStore.ts:115-127` |
| `account_transfers` | `transferKeys`, `accountKeys` | same | `useTransferStore.ts:115`, balances RPC |
| `app_roles` | `roleKeys` (`roles`), `pendingUsersKeys` (`pending-users`, via `/api/admin/pending-users`), `userRoleKeys` (`user-role`, via `get_current_audit_role`) | same | `audit-roles.ts:413`, `functions/api/admin/pending-users.ts:90`, `useUserRole.ts:17-19` |
| `audit_logs` | `auditKeys` (`audit-logs`, including `recentRecordAuditLogsQuery`), `roleKeys` (history) | same | `audit-hooks.ts:41-60,89`, `useRoleManagement.ts:83-93` |
| `payment_methods` | `paymentMethodKeys` | same | `usePaymentMethods.ts:10,22` |
| `expense_categories` | `expenseCategoryKeys` | same | `useExpenseCategories.ts:10,22` |
| `contact_channels` | `contactChannelKeys` (`contact-channels`): settings table, documents, letterhead, landing, policy and booking-confirmation pages | new | `useContactChannels.ts:27,39`, `supabase.ts:100-108` |
| `pricing_config` | `pricingConfigKeys`; memo `pricingKeys` | same | `usePricingConfig.ts:13`, `functions/lib/pricing.ts:36` |
| `seasonal_rates` | `seasonalRateKeys`; memo `pricingKeys` | same | `useSeasonalRates.ts:12`, `functions/lib/pricing.ts:120` |
| `discount_rules` | `discountRuleKeys` only. The pricing memo does not read it: `/api/pricing/calculate` and `functions/lib/pricing.ts` never touch `discount_rules` | changed: drop the `pricingKeys` memo entry | `useDiscountRules.ts:12`; grep of `functions/api/pricing/calculate.ts`, `functions/lib/pricing.ts` |
| `availability_blackouts` | **`availabilityKeys.blackouts`** (list, inNights, conflicts), Availability (`is_unit_blocked`), **`unitKeys`** (`unitKeys.states`); `publicAvailability` (not table data) | changed: plan has `[]` | `useBlocks.ts:59,169`, `useAvailabilityTimeline.ts:26`, `DashboardCalendar.tsx:200`, `DayPane.tsx:39`, `20261027000000_blocks_hold.sql:30-48`, `20261027300000_derived_cabin_state.sql:42-46` |
| `maintenance_logs` | none | same | only `audit-constants.ts:27,66` |
| `audit_logs_archive` | none | same | no client reader |
| `guest_assignments` | none | same | no client reader |
| `idempotency_keys` | none | same | read only by `functions/api/guest-booking/multi-unit.ts:153` and cron |
| `bookings_conflict_backup` | (table no longer exists) | gone | absent from `database.generated.ts` Tables; drop from `ALL_TABLES` (plan line 212) and `READERS` (line 382) |

### Key roots: live, dead, and conflicts with Task 1

Task 1 (plan line 70) deletes `availabilityKeys.calendar` and `availabilityKeys.blackouts` as dead. Both are now **live**: `calendar.stays` (`useAvailabilityTimeline.ts:13`) and `blackouts.list/inNights/conflicts` (`useBlocks.ts:59,169`, `useAvailabilityTimeline.ts:26`, used by the dashboard calendar and day pane). Task 1 must keep them.

Still dead (no `queryKey` reader in `src/`): `unit-availability`, `unit-availability-fast`, `available-units-by-type`, `batch-unit-availability`, `upcoming-checkins`, `upcoming-checkouts`, `multi-unit-bookings` (`.all`, `.detail`), `blackouts.byUnit/range`, `availableUnits.search`, `multiUnit.search`, `guestKeys.byEmail/statistics`, `paymentKeys.byBooking`, `transferKeys.detail/byAccount`, `accountKeys.list`, `seasonalRateKeys.active/forDate`, `queryKeys.audit`. New live root since the plan: `contactChannelKeys` (`contact-channels`), which `NOT_TABLE_DATA` and the root-coverage test must reach through `contact_channels`.

Task 1's move of `roleKeys`, `pendingUsersKeys`, `userRoleKeys`, `auditKeys` into `query-keys.ts` is still undone (`useRoleManagement.ts:23`, `usePendingUsers.ts:13`, `useUserRole.ts:13`, `audit-hooks.ts:24`).

## 2. CASCADES: tables a write also changes

Live non-audit triggers reconstructed from all 72 migrations (CREATE minus later DROP), then each function's latest body read.

| From | To | Mechanism | Status | Evidence |
|---|---|---|---|---|
| `payments` | `bookings` | `refresh_booking_payment_status` AFTER INSERT/UPDATE/DELETE → `bookings.payment_status` | same | `20261010120000_derive_booking_payment_status.sql:47-85` |
| `booking_units` | `bookings` | `trigger_update_booking_totals` AFTER INSERT/UPDATE/DELETE (totals, unit_count, num_guests) | same | `20251017000000_unified_multi_unit.sql:340`, body `20260222000100_fix_multi_unit_booking_function.sql:128` |
| `booking_units` | `booking_unit_availability` | `trigger_cleanup_availability` AFTER DELETE | same | `20251008152700_multi_unit_schema.sql:581`, body `20260209120000_security_hardening.sql:775` |
| `booking_units` | (nothing) | `trigger_sync_availability_unit` AFTER UPDATE OF unit_id runs a body that handles only INSERT and DELETE, so it is a no-op | new observation | `20251008152700_multi_unit_schema.sql:609`, body `20260209120000_security_hardening.sql:785-807` |
| `bookings` | `guests` | `trigger_update_guest_statistics` AFTER INSERT/UPDATE/DELETE, now recomputes both OLD and NEW guest | same | `20251006093452_remote_schema.sql:1618`, body `20261102000000_guest_statistics_definer_manila_balances.sql:12-44` |
| `bookings` | `booking_unit_availability` | `trigger_sync_booking_dates` AFTER UPDATE; `trigger_cascade_status` AFTER UPDATE OF booking_status | same | `20251008152700_multi_unit_schema.sql:528,555`, bodies `20260209120000_security_hardening.sql:751-772` |
| `bookings` | `payments` | `airbnb_payout_follows_source` AFTER UPDATE OF booking_source: inserts, reactivates or soft-deletes the "Airbnb payout" payment | **new** | `20261104500000_airbnb_payout_follows_source.sql:108-151` (ADR 0006) |
| `bookings` | `bookings` | `refresh_payment_status_on_total_change` (payment_status); `sync_booking_source` BEFORE (flags) | new, self only: no new table | `20261010120000_derive_booking_payment_status.sql:88`, `20261104000000_booking_source.sql:20-52` |
| `guests` | `bookings` | `bookings.guest_id` ON DELETE SET NULL | same | `20251006093452_remote_schema.sql:1658` |
| `units` | `booking_unit_availability`, `availability_blackouts`, `maintenance_logs` | ON DELETE CASCADE. `booking_units.unit_id` is ON DELETE RESTRICT, so a unit with bookings cannot be deleted at all | same (edges); note RESTRICT | `20251017000000_unified_multi_unit.sql:84,113`, `20251014235258_create_availability_blackouts.sql:20`, `20251006093452_remote_schema.sql:1668` |
| `bookings` | `booking_units`, `booking_unit_availability`, `payments`, `guest_booking_unit_requests`, `guest_assignments`, `idempotency_keys` | ON DELETE CASCADE, unreachable: no client or route deletes a booking | not in plan; leave out | `20251006093452_remote_schema.sql:1673`, `20251017000000_unified_multi_unit.sql:83,114`, `20261013000000_online_booking.sql:33`; grep finds no `bookings` delete |
| `availability_blackouts`, `booking_unit_availability`, `contact_channels` | (nothing) | BEFORE guards (`enforce_block_locks`, `refuse_block_over_bookings`, `refuse_booking_on_blocked_nights`) and `updated_at`/`created_by` setters only | new rows, no edges | `20261027000000_blocks_hold.sql:112,298,303,355`, `20261027100000_block_conflicts.sql:177`, `20261021120000_contact_channels.sql:29` |
| every table | `audit_logs` | audit trigger | changed: not every table. `audit_logs`, `audit_logs_archive`, `idempotency_keys`, `booking_unit_availability`, `guest_assignments` are unaudited. Adding `audit_logs` unconditionally only over-invalidates | `src/__tests__/database/audit-trigger-coverage.test.ts:19-25` |

`unit_status` (ADR 0005): the column is dropped (`20261030000000_drop_unit_status.sql:10-11`), and nothing in `src/` or `functions/` reads it. No trigger writes cabin state. It is read-derived: `get_cabin_states` reads `units`, `booking_unit_availability` and `availability_blackouts` (`20261027300000_derived_cabin_state.sql:12-48`). So `unitKeys` (`unitKeys.states`) belongs in `READERS` of the two latter tables, which section 1 shows. Today's `invalidateAvailability()` already refreshes `unitKeys.allStates()` (`query-invalidation.ts:60`); the plan's map would drop that.

Chain example with the new edge: `booking_units` → `bookings` → {`guests`, `booking_unit_availability`, `payments`} → `bookings`. The plan's Set walk handles the cycle.

## 3. What each client write path writes (inputs for `*_WRITES` constants)

| Write path | Tables written directly | vs plan | Evidence |
|---|---|---|---|
| `POST /api/bookings/multi-unit` → `create_multi_unit_booking` (+ guest lookup or insert) | `guests`, `bookings`, `booking_units`, `booking_unit_availability`, **`payments`** (Airbnb payout on entry) | changed: `BOOKING_CREATE_WRITES` (plan line 462) lacks `payments` | `src/lib/bookings/create.ts:49,93`, `20261104400000_airbnb_confirmation_code.sql:34,64,78,90` |
| `update_booking` RPC (`useUpdateBooking`) | `bookings`; via `set_booking_total`: `booking_units`, `payments`; may insert `guests` | new path | `src/lib/bookings/operations.ts:65,91`, `20261104400000_airbnb_confirmation_code.sql:98-126`, `20261104500000_airbnb_payout_follows_source.sql:84-104` |
| Status change and cancel | `bookings` | same | `operations.ts:124-131` |
| Payments create, update, soft delete, proof | `payments` (+ storage) | same | `src/lib/payments/index.ts:42,76,81` |
| `POST /api/admin/assign-units` → `assign_units_to_booking` | `booking_units`, `booking_unit_availability`, `bookings` | same | `functions/api/admin/assign-units.ts:287`, `20261027000000_blocks_hold.sql:234-250` |
| `POST /api/admin/verify-payment` | `payments` (verify only), `audit_logs` | changed: no `bookings` write; a trigger derives payment_status | `functions/api/admin/verify-payment.ts:257,316` |
| Guest edit | `guests` | same | `useGuestStore.ts:231`, `useEntityEdit.ts` (`db.guests.update`) |
| `/api/admin/guests/:id[/anonymize]` → `delete_guest` / `anonymize_guest` | `guests`, `bookings`, `booking_units`, `payments`, `guest_assignments`, `audit_logs`, `audit_logs_archive` | new path | `functions/api/admin/guests/[guestId].ts`, `20261021000000_guest_retention.sql:116-298` |
| Units create, update, delete | `units` | same | `useUnitStore.ts:179,232,281` |
| Blocks create, update, delete | `availability_blackouts` | new | `useBlocks.ts:112-155`, `supabase.ts:340-351` |
| `cancel_bookings_and_save_block` | `bookings`, `availability_blackouts` | new | `useBlocks.ts:195`, `20261027100000_block_conflicts.sql:316-335` |
| Expenses, accounts, transfers | `expenses`; `accounts`; `account_transfers` | same | `useExpenseStore.ts:298,374,411`, `useAccountStore.ts:188,243,281,308`, `useTransferStore.ts:206,264` |
| Roles | `app_roles` | same | `audit-roles.ts:176,246,300,361` |
| Payment methods, expense categories | their tables | same | `supabase.ts:1164-1176,1219-1231` |
| Contact channels (+ `reorder_contact_channel`) | `contact_channels` | new | `supabase.ts:1185-1196`, `20261021130000_contact_channels_reorder.sql:53,82` |
| `POST /api/pricing/update-config` | `pricing_config` | same | `functions/api/pricing/update-config.ts:159` |
| Seasonal rates, discount rules bulk upsert (delete + insert) | `seasonal_rates`; `discount_rules` | same | `supabase.ts:951-1012,1036-1050` |
| `POST /api/audit/log-with-ip` | `audit_logs` | not in plan | `functions/api/audit/log-with-ip.ts:123` |

Public guest booking (`create_guest_booking`: `idempotency_keys`, `guests`, `bookings`, `guest_booking_unit_requests`; `20261030400000_no_duplicate_downpayment_or_guest_booking.sql:56-131`) runs on the guest's device. No admin cache sees it, so it needs no `afterWrite`.

## 4. Other drift that touches the plan

- Units and blocks mutations refresh in `onSuccess`, not `onSettled` (`useUnitStore.ts:213,270,285`, `useBlocks.ts:119,137,152,214`). The plan's constraint says `onSettled`.
- The dashboard's refresh button invalidates `bookings`, `units` and `guests` (`Dashboard.tsx:30-34`) but not the blocks it shows (`DashboardCalendar.tsx:200`, `DayPane.tsx:39`). Task 6's "Dashboard `refetch()` from `useBookings`" no longer fits: the dashboard reads `useAllBookings`, `useBlockCabins` and `blocksInNightsQuery`.
- Realtime: `availability_blackouts` is now in the `supabase_realtime` publication (`20261027000000_blocks_hold.sql:364-366`), and `useMultiUnitRealtime.ts:118-122` listens to it. Part of the hook Task 6 deletes is now live. The `multi_unit_bookings` channel (`useMultiUnitRealtime.ts:106`) still points at a table that does not exist.
- `useClearPricingCache` (`usePricingCalculation.ts:232`) still has no caller, as the plan expected.

## Decisions this raises (for #344)

1. **Keep `availabilityKeys.calendar` and `.blackouts` in Task 1, and give them `READERS` rows.** Recommended default: yes; they are live dashboard, timeline and blocks reads.
2. **Add `unitKeys` to `READERS` of `availability_blackouts` and `booking_unit_availability`** (cabin states, ADR 0005). Recommended default: yes; otherwise a block or booking leaves the cabin-state badge stale, which today's code avoids.
3. **Add the `bookings` → `payments` cascade (Airbnb payout).** Recommended default: yes. It changes nothing visible today (`READERS.bookings` already holds `paymentKeys`) but keeps the walk honest for `accountKeys`.
4. **`BOOKING_CREATE_WRITES` gains `payments`; add `UPDATE_BOOKING_WRITES`, `GUEST_RETENTION_WRITES`, `CANCEL_AND_BLOCK_WRITES`.** Recommended default: yes, one constant per RPC or route that writes more than one table.
5. **Drop `discount_rules` → `pricingKeys` memo; add `units` → `pricingKeys`.** Recommended default: yes, it matches what `/api/pricing/calculate` reads.
6. **`audit_logs` on every write despite 5 unaudited tables.** Recommended default: keep unconditional; the over-invalidation is one cheap root.
7. **Keep or delete the `availability_blackouts` realtime subscription in Task 6.** Recommended default: keep only that listener, mapped through `afterWrite("availability_blackouts")`. It is the one cross-device refresh that works; drop the `multi_unit_bookings` one.
8. **Move units and blocks invalidation to `onSettled`.** Recommended default: yes, as the plan's constraint says.
9. **Dashboard refresh: use `afterWrite`-style roots or refetch every dashboard query, blocks included.** Recommended default: refetch the three dashboard queries directly; it is a read refresh, not a write.

## Not verified

- No live database was queried: the local Supabase stack was not running, so triggers and FKs come from reading migrations in order, not from `pg_trigger`. Regex parsing could miss a trigger created inside dynamic SQL (`EXECUTE format(...)`). The audit trigger coverage came from the test's allowlist, not a run.
- Prod schema was not checked. The `seasonal_rates` absence on prod (memory note) was not re-checked.
- `functions/lib/guest-retention.ts` was not opened beyond the route files that call it. Whether it writes anything besides the RPC (for example storage removals) is unchecked.
- The architecture plan's round-2 read map was not re-diffed row by row. The diff here is against the Task 2 code block only.
- Component-level `fetch` reads outside TanStack Query (`useMultiUnitBookingStore.ts:458-559`, `fetchRates`) were treated as uncached and left out.
- Phase-suffixed files (`*.phase3-4*`) were excluded.
