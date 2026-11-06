# Invalidate by domain fact Implementation Plan

> **Superseded by #352 (2026-11-06):** built from the spec in issue #352 and its tickets (#353-#358) instead of this plan. Kept for its grilling history only.

> **Out of date (2026-11-02):** written 2026-10-14 against `1b06d1b`; `main` has moved about 430 commits since. Re-check every call site, key root and file path before executing a task.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every client mutation reports the tables it wrote through one function, `afterWrite(...tables)`, and one module maps tables (plus their database cascades) to the cached reads that depend on them.

**Architecture:** `src/lib/after-write.ts` holds three things: `READERS` (table → query-key roots whose fetch reads that table, including embeds, RPCs and API routes), `CASCADES` (direct trigger/foreign-key edges between tables), and `afterWrite`, which walks the cascades, adds `audit_logs`, and invalidates (or, for the pricing memo, removes) each affected root once. Call sites stay where they are and swap their `after*`/`invalidateQueries` calls for `afterWrite`. A lint rule bans `invalidateQueries`/`removeQueries` everywhere else.

**Tech Stack:** TypeScript, React 19, TanStack Query 5, Zustand, Cloudflare Pages Functions, Vitest, ESLint flat config.

**Parent plan:** `docs/plans/2026-10-10-architecture-deepening.md` (Candidate 4). Design decisions: its "Candidate 4 grilling, round 1-3" blocks.

## Global Constraints

- `afterWrite` is the only export of `src/lib/after-write.ts` besides the `TableName` type. Table names are typed from `Database["public"]["Tables"]` (`@/types/database.types`).
- Callers report only tables they write directly; cascades and `audit_logs` are the module's job.
- Every mutation calls `afterWrite` in `onSettled` (not `onSuccess`, not `onError`).
- Worker-route writes are a `*_WRITES` constant next to the route's browser `fetch`; the route file carries a comment naming the constant.
- Optimistic `setQueryData`/`cancelQueries`/`getQueryData` stay where they are.
- `publicAvailability` is the only key root not reached from a table.
- No migration in this branch. The balances fix (`get_all_account_balances` counts only `Active`) is a separate branch/PR after this one.
- Commits: Conventional Commits, no Co-Authored-By line. Run `npm run verify` before each commit. Commit with `git commit -- <paths>`.

## File map

| File                                                                                                          | Responsibility                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/lib/query-keys.ts`                                                                                       | All key factories, including roles, pending users, current role, audit, public availability; dead entries removed |
| `src/lib/after-write.ts` (new)                                                                                | `READERS`, `CASCADES`, `afterWrite`                                                                               |
| `src/lib/__tests__/after-write.test.ts` (new)                                                                 | Per-table, cascade, dedupe, coverage tests                                                                        |
| `src/lib/query-invalidation.ts` + its test                                                                    | Deleted (Task 6)                                                                                                  |
| `src/lib/bookings/request.ts`                                                                                 | `BOOKING_CREATE_WRITES`                                                                                           |
| `src/stores/use{Booking,Payment,Account,Transfer,Expense,Unit,Guest}Store.ts`                                 | Call `afterWrite`                                                                                                 |
| `src/hooks/useMultiUnitBookingQueries.ts`                                                                     | `afterWrite(...BOOKING_CREATE_WRITES)`; dead cancel removed                                                       |
| `src/components/admin/UnitAssignmentInterface.tsx`, `PaymentProofViewer.tsx`                                  | Route write constants, `onSettled`                                                                                |
| `src/hooks/entity/useEntityEdit.ts`                                                                           | `afterWrite(ENTITY_TABLES[type])`                                                                                 |
| `src/hooks/use{PaymentMethods,ExpenseCategories,PricingConfig,SeasonalRates,DiscountRules,RoleManagement}.ts` | Call `afterWrite`                                                                                                 |
| `src/hooks/useMultiUnitRealtime.ts`, `useAvailabilityRealtime.ts`                                             | Deleted                                                                                                           |
| `src/hooks/usePricingCalculation.ts`                                                                          | `useClearPricingCache` deleted                                                                                    |
| `src/pages/Dashboard.tsx`                                                                                     | `refetch()` from `useBookings`                                                                                    |
| `eslint.config.js`                                                                                            | `no-restricted-properties` on `invalidateQueries`/`removeQueries`                                                 |

## Tasks

- [ ] Task 1: Key factories in one place, dead keys gone
- [ ] Task 2: `afterWrite` module and tests
- [ ] Task 3: Bookings, payments, assign-units, verify-payment
- [ ] Task 4: Accounts, transfers, expenses
- [ ] Task 5: Units, guests, `useEntityEdit`, settings and roles
- [ ] Task 6: Delete old helpers and realtime, Dashboard refetch, lint rule, docs
- [ ] Task 7: Browser check, PR, deploy

---

### Task 1: Key factories in one place, dead keys gone

**Files:**

- Modify: `src/lib/query-keys.ts`
- Modify: `src/hooks/useRoleManagement.ts:23-31`, `src/hooks/useUserRole.ts:13-15`, `src/hooks/usePendingUsers.ts:13-15`, `src/lib/audit-hooks.ts:25-36` (delete local factories, import from `query-keys`)
- Modify: `src/components/calendar/PublicAvailabilityCalendar.tsx:106-108` (use `publicAvailabilityKeys.month`)
- Modify: `src/lib/query-invalidation.ts` (drop references to deleted keys; the file itself goes in Task 6)
- Modify: `src/hooks/useMultiUnitBookingQueries.ts:96` (drop the cancel of `multiUnitBookingKeys.all`)

**Interfaces:**

- Produces in `@/lib/query-keys`: `roleKeys`, `pendingUsersKeys`, `userRoleKeys` (with `all: ["user-role"]` and `current: ["user-role","current"]`), `auditKeys`, `publicAvailabilityKeys` (`all: ["publicAvailability"]`, `month: (iso: string) => ["publicAvailability", iso]`). Existing shapes unchanged. Files that imported the local factories re-export nothing; importers switch to `@/lib/query-keys`.
- Deleted: `availabilityKeys.unit`, `.unitFast`, `.calendar`, `.availableUnitsByType`, `.batch`, `.blackouts`, `.availableUnits.search`, `.multiUnit.search`; `upcomingKeys`; `multiUnitBookingKeys.all`, `.detail` (`.pending` stays); `guestKeys.byEmail`, `.statistics`; `paymentKeys.byBooking`; `transferKeys.detail`, `.details`, `.byAccount`; `accountKeys.list`, `.lists`; `seasonalRateKeys.active`, `.forDate`; `queryKeys.audit`.

- [ ] **Step 1: Move the four local factories into `query-keys.ts` verbatim** (append after `discountRuleKeys`):

```ts
export const roleKeys = {
  all: ["roles"] as const,
  lists: () => [...roleKeys.all, "list"] as const,
  list: (filters: string) => [...roleKeys.lists(), { filters }] as const,
  details: () => [...roleKeys.all, "detail"] as const,
  detail: (id: string) => [...roleKeys.details(), id] as const,
  stats: () => [...roleKeys.all, "stats"] as const,
  history: (userId: string) => [...roleKeys.all, "history", userId] as const,
};

export const pendingUsersKeys = {
  all: ["pending-users"] as const,
};

export const userRoleKeys = {
  all: ["user-role"] as const,
  current: ["user-role", "current"] as const,
};

export const auditKeys = {
  all: ["audit-logs"] as const,
  lists: () => [...auditKeys.all, "list"] as const,
  list: (filters?: AuditLogFilters) => [...auditKeys.lists(), filters] as const,
  details: () => [...auditKeys.all, "detail"] as const,
  detail: (id: string) => [...auditKeys.details(), id] as const,
  record: (tableName: string, recordId: string) =>
    [...auditKeys.all, "record", tableName, recordId] as const,
  stats: (filters?: AuditLogFilters) => [...auditKeys.all, "stats", filters] as const,
  user: (email: string) => [...auditKeys.all, "user", email] as const,
  recent: (limit: number) => [...auditKeys.lists(), "recent", limit] as const,
  userActivity: (email: string, limit: number) => [...auditKeys.user(email), limit] as const,
};

// The public calendar; admin writes happen on another device and the edge caches it 300 s
export const publicAvailabilityKeys = {
  all: ["publicAvailability"] as const,
  month: (monthIso: string) => [...publicAvailabilityKeys.all, monthIso] as const,
};
```

Add `import type { AuditLogFilters } from "@/types/audit.types";`. Delete the local definitions and their "QUERY KEYS" banner comments; import from `@/lib/query-keys` in each file (`useRoleManagement.ts`, `useUserRole.ts`, `usePendingUsers.ts`, `audit-hooks.ts`) and in every other importer (`grep -rn "roleKeys\|pendingUsersKeys\|userRoleKeys\|auditKeys" src`). In `PublicAvailabilityCalendar.tsx` replace the literal `["publicAvailability", month.toISOString()]` with `publicAvailabilityKeys.month(month.toISOString())`.

- [ ] **Step 2: Delete the dead factory entries listed under Interfaces.** Delete the comment above `multiUnitBookingKeys` and the `availabilityKeys` comment ("covers each one"), replacing the latter with `// Availability reads sit under two top-level roots`. In `query-invalidation.ts`, reduce the helpers to keys that still exist:

```ts
export function invalidateAvailability() {
  queryClient.invalidateQueries({ queryKey: availabilityKeys.availableUnits.all });
  queryClient.invalidateQueries({ queryKey: availabilityKeys.multiUnit.all });
}

export function invalidateMultiUnitBookings() {
  queryClient.invalidateQueries({ queryKey: multiUnitBookingKeys.pending });
}
```

and delete `invalidateUpcoming` and its calls. In `useMultiUnitBookingQueries.ts` `onMutate`, delete `await queryClient.cancelQueries({ queryKey: multiUnitBookingKeys.all });` (nothing reads that key) and the now-unused import.

- [ ] **Step 3: Verify**

Run: `npm run verify`
Expected: exit 0 (type-check, lint, knip, unit suite). knip must not report any of the moved factories as unused.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(query): keep every query key factory in query-keys and drop unread keys" -- src/lib/query-keys.ts src/lib/query-invalidation.ts src/hooks/useRoleManagement.ts src/hooks/useUserRole.ts src/hooks/usePendingUsers.ts src/lib/audit-hooks.ts src/components/calendar/PublicAvailabilityCalendar.tsx src/hooks/useMultiUnitBookingQueries.ts <other importers>
```

---

### Task 2: `afterWrite` module and tests

**Files:**

- Create: `src/lib/after-write.ts`
- Test: `src/lib/__tests__/after-write.test.ts`

**Interfaces:**

- Consumes: key factories from Task 1.
- Produces: `export type TableName = keyof Database["public"]["Tables"];` and `export function afterWrite(...tables: TableName[]): void`.

- [ ] **Step 1: Write the failing tests**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { afterWrite, type TableName } from "@/lib/after-write";
import { queryClient } from "@/lib/query-client";
import * as queryKeys from "@/lib/query-keys";
import {
  accountKeys,
  auditKeys,
  availabilityKeys,
  bookingKeys,
  guestKeys,
  multiUnitBookingKeys,
  paymentKeys,
  pendingUsersKeys,
  pricingConfigKeys,
  pricingKeys,
  publicAvailabilityKeys,
  roleKeys,
  transferKeys,
  unitKeys,
  userRoleKeys,
} from "@/lib/query-keys";

const refreshedBy = (...tables: TableName[]) => {
  const invalidated = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const removed = vi.spyOn(queryClient, "removeQueries").mockImplementation(() => undefined);
  afterWrite(...tables);
  return {
    invalidated: invalidated.mock.calls.map(([filters]) => filters?.queryKey),
    removed: removed.mock.calls.map(([filters]) => filters?.queryKey),
  };
};

// Every static key array exported from query-keys, reduced to its root
const keyRoots = (value: unknown): string[] => {
  if (Array.isArray(value)) return typeof value[0] === "string" ? [value[0]] : [];
  if (value && typeof value === "object") return Object.values(value).flatMap(keyRoots);
  return [];
};

const NOT_TABLE_DATA = new Set([publicAvailabilityKeys.all[0]]);

const ALL_TABLES = [
  "account_transfers",
  "accounts",
  "app_roles",
  "audit_logs",
  "audit_logs_archive",
  "availability_blackouts",
  "booking_unit_availability",
  "booking_units",
  "bookings",
  "bookings_conflict_backup",
  "discount_rules",
  "expense_categories",
  "expenses",
  "guest_assignments",
  "guest_booking_unit_requests",
  "guests",
  "idempotency_keys",
  "maintenance_logs",
  "payment_methods",
  "payments",
  "pricing_config",
  "seasonal_rates",
  "units",
] satisfies TableName[];

describe("afterWrite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes payments, balances, the booking's payment status and the guest's totals after a payment write", () => {
    const { invalidated } = refreshedBy("payments");
    expect(invalidated).toEqual(
      expect.arrayContaining([paymentKeys.all, accountKeys.all, bookingKeys.all, guestKeys.all])
    );
  });

  it("follows booking_units through booking totals to guests and availability", () => {
    const { invalidated } = refreshedBy("booking_units");
    expect(invalidated).toEqual(
      expect.arrayContaining([
        bookingKeys.all,
        guestKeys.all,
        paymentKeys.all,
        availabilityKeys.availableUnits.all,
        availabilityKeys.multiUnit.all,
      ])
    );
  });

  it("refreshes bookings and payments that embed a guest after a guest write", () => {
    const { invalidated } = refreshedBy("guests");
    expect(invalidated).toEqual(
      expect.arrayContaining([guestKeys.all, bookingKeys.all, paymentKeys.all])
    );
  });

  it("refreshes bookings and availability after a unit write", () => {
    const { invalidated } = refreshedBy("units");
    expect(invalidated).toEqual(
      expect.arrayContaining([
        unitKeys.all,
        bookingKeys.all,
        availabilityKeys.availableUnits.all,
        availabilityKeys.multiUnit.all,
      ])
    );
  });

  it("refreshes transfers that embed account names after an account write", () => {
    expect(refreshedBy("accounts").invalidated).toContainEqual(transferKeys.all);
  });

  it("refreshes every role read after a role write", () => {
    const { invalidated } = refreshedBy("app_roles");
    expect(invalidated).toEqual(
      expect.arrayContaining([roleKeys.all, pendingUsersKeys.all, userRoleKeys.all])
    );
  });

  it("refreshes the pending queue after a booking write", () => {
    expect(refreshedBy("bookings").invalidated).toContainEqual(multiUnitBookingKeys.pending);
  });

  it("drops remembered prices after a pricing write", () => {
    const { invalidated, removed } = refreshedBy("pricing_config");
    expect(invalidated).toContainEqual(pricingConfigKeys.all);
    expect(removed).toContainEqual(pricingKeys.all);
  });

  it("refreshes audit views after any write", () => {
    expect(refreshedBy("expenses").invalidated).toContainEqual(auditKeys.all);
  });

  it("refreshes each key once however many written tables read it", () => {
    const { invalidated } = refreshedBy("payments", "bookings", "booking_units");
    const asText = invalidated.map((key) => JSON.stringify(key));
    expect(new Set(asText).size).toBe(asText.length);
  });

  it("reaches every key root from some table", () => {
    const reached = new Set(
      ALL_TABLES.flatMap((table) => {
        const { invalidated, removed } = refreshedBy(table);
        vi.restoreAllMocks();
        return [...invalidated, ...removed].map((key) => String(key?.[0]));
      })
    );
    const unreached = [...new Set(keyRoots(queryKeys))].filter(
      (root) => !reached.has(root) && !NOT_TABLE_DATA.has(root)
    );
    expect(unreached).toEqual([]);
  });
});
```

`ALL_TABLES` is checked by `satisfies TableName[]`; a table added to the schema without a `READERS` entry fails type-check in `after-write.ts` (it is a `Record<TableName, …>`), which is the reminder to add it here too.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/lib/__tests__/after-write.test.ts`
Expected: FAIL, cannot resolve `@/lib/after-write`.

- [ ] **Step 3: Write the module**

```ts
import type { QueryKey } from "@tanstack/react-query";

import { queryClient } from "@/lib/query-client";
import {
  accountKeys,
  auditKeys,
  availabilityKeys,
  bookingKeys,
  discountRuleKeys,
  expenseCategoryKeys,
  expenseKeys,
  guestKeys,
  multiUnitBookingKeys,
  paymentKeys,
  paymentMethodKeys,
  pendingUsersKeys,
  pricingConfigKeys,
  pricingKeys,
  roleKeys,
  seasonalRateKeys,
  transferKeys,
  unitKeys,
  userRoleKeys,
} from "@/lib/query-keys";
import type { Database } from "@/types/database.types";

export type TableName = keyof Database["public"]["Tables"];

const AVAILABILITY = [availabilityKeys.availableUnits.all, availabilityKeys.multiUnit.all];

// Cached reads whose fetch reads the table: directly, through an embed, an RPC or an API route
const READERS: Record<TableName, readonly QueryKey[]> = {
  bookings: [bookingKeys.all, guestKeys.all, paymentKeys.all, multiUnitBookingKeys.pending],
  booking_units: [bookingKeys.all, guestKeys.all],
  booking_unit_availability: AVAILABILITY,
  guests: [guestKeys.all, bookingKeys.all, paymentKeys.all],
  guest_booking_unit_requests: [bookingKeys.all, multiUnitBookingKeys.pending],
  units: [unitKeys.all, bookingKeys.all, guestKeys.all, ...AVAILABILITY],
  payments: [paymentKeys.all, accountKeys.all],
  expenses: [expenseKeys.all, accountKeys.all],
  accounts: [accountKeys.all, transferKeys.all],
  account_transfers: [transferKeys.all, accountKeys.all],
  app_roles: [roleKeys.all, pendingUsersKeys.all, userRoleKeys.all],
  audit_logs: [auditKeys.all, roleKeys.all],
  payment_methods: [paymentMethodKeys.all],
  expense_categories: [expenseCategoryKeys.all],
  pricing_config: [pricingConfigKeys.all],
  seasonal_rates: [seasonalRateKeys.all],
  discount_rules: [discountRuleKeys.all],
  // Read only by the public calendar or by nothing in the client
  availability_blackouts: [],
  maintenance_logs: [],
  audit_logs_archive: [],
  bookings_conflict_backup: [],
  guest_assignments: [],
  idempotency_keys: [],
};

// Remembered results with no fetch behind them: removed, since invalidating cannot refresh them
const MEMOS: Partial<Record<TableName, readonly QueryKey[]>> = {
  pricing_config: [pricingKeys.all],
  seasonal_rates: [pricingKeys.all],
  discount_rules: [pricingKeys.all],
};

// Other tables a write also changes, through a trigger or a foreign key
const CASCADES: Partial<Record<TableName, readonly TableName[]>> = {
  // refresh_booking_payment_status
  payments: ["bookings"],
  // trigger_update_booking_totals; trigger_cleanup_availability
  booking_units: ["bookings", "booking_unit_availability"],
  // trigger_update_guest_statistics; trigger_cascade_status and trigger_sync_booking_dates
  bookings: ["guests", "booking_unit_availability"],
  // bookings.guest_id ON DELETE SET NULL
  guests: ["bookings"],
  // ON DELETE CASCADE from units
  units: ["booking_unit_availability", "availability_blackouts", "maintenance_logs"],
};

const changedTables = (written: readonly TableName[]) => {
  const changed = new Set<TableName>(written);
  // A Set's iterator also visits tables added during the loop, so this follows whole chains
  for (const table of changed) {
    for (const next of CASCADES[table] ?? []) changed.add(next);
  }
  // Every table has the audit trigger
  changed.add("audit_logs");
  return changed;
};

const uniqueKeys = (keys: readonly QueryKey[]) => [
  ...new Map(keys.map((key) => [JSON.stringify(key), key])).values(),
];

/** Call in a mutation's onSettled with the tables it wrote directly. */
export function afterWrite(...tables: TableName[]) {
  const changed = [...changedTables(tables)];
  for (const queryKey of uniqueKeys(changed.flatMap((table) => READERS[table]))) {
    void queryClient.invalidateQueries({ queryKey });
  }
  for (const queryKey of uniqueKeys(changed.flatMap((table) => MEMOS[table] ?? []))) {
    queryClient.removeQueries({ queryKey });
  }
}
```

Note: `READERS.units` includes `guestKeys.all` because `guestKeys.bookings(id)` embeds `units`. `READERS.audit_logs` includes `roleKeys.all` because `roleKeys.history` reads `audit_logs`. Before committing, re-check each `READERS` row against the read map in the parent plan's round-2 facts; a row that differs from that map needs a one-line reason in the commit body.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/lib/__tests__/after-write.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Verify and commit**

Run: `npm run verify` (exit 0; knip may flag `afterWrite` as unused until Task 3. If it does, merge Task 2 and Task 3 into one commit instead of adding a knip ignore).

```bash
git commit -m "feat(query): add afterWrite, mapping written tables and their cascades to cached reads" -- src/lib/after-write.ts src/lib/__tests__/after-write.test.ts
```

---

### Task 3: Bookings, payments, assign-units, verify-payment

**Files:**

- Modify: `src/lib/bookings/request.ts`, `src/stores/useBookingStore.ts:27-33,401-490`, `src/stores/usePaymentStore.ts:13,188-231`, `src/hooks/useMultiUnitBookingQueries.ts:17,121`, `src/components/admin/UnitAssignmentInterface.tsx:37,134-170`, `src/components/admin/PaymentProofViewer.tsx:35,133-165`
- Modify (comments only): `functions/api/bookings/multi-unit.ts`, `functions/api/admin/assign-units.ts`, `functions/api/admin/verify-payment.ts`

**Interfaces:**

- Consumes: `afterWrite`, `TableName` from `@/lib/after-write`.
- Produces: `export const BOOKING_CREATE_WRITES = ["guests", "bookings", "booking_units", "booking_unit_availability"] as const satisfies readonly TableName[];` in `src/lib/bookings/request.ts`.

- [ ] **Step 1: Add the route constant** at the top of `src/lib/bookings/request.ts` (after the imports):

```ts
// Tables POST /api/bookings/multi-unit writes; update when the route writes another table
export const BOOKING_CREATE_WRITES = [
  "guests",
  "bookings",
  "booking_units",
  "booking_unit_availability",
] as const satisfies readonly TableName[];
```

with `import type { TableName } from "@/lib/after-write";`. In `functions/api/bookings/multi-unit.ts` add above the handler: `// Tables written here are listed in BOOKING_CREATE_WRITES (src/lib/bookings/request.ts) for the client cache`.

- [ ] **Step 2: Swap the calls.** Replace the `@/lib/query-invalidation` imports with `import { afterWrite } from "@/lib/after-write";` and each body as follows (all stay in `onSettled`):

| Site                                                                               | New `onSettled` body                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `useCreateBooking`                                                                 | `afterWrite(...BOOKING_CREATE_WRITES);`                                        |
| `useCreateMultiUnitBooking`                                                        | `afterWrite(...BOOKING_CREATE_WRITES);`                                        |
| `useUpdateBookingStatus`                                                           | `afterWrite("bookings");`                                                      |
| `useUploadPaymentProof`                                                            | `afterWrite("payments");`                                                      |
| `useCancelBooking`                                                                 | `afterWrite("bookings");`                                                      |
| `useUpdateBooking`                                                                 | `afterWrite("bookings", "guests");` (it inserts a guest when the email is new) |
| `useCreatePayment`, `useUpdatePayment`, `useSoftDeletePayment`, `useVerifyPayment` | `afterWrite("payments");`                                                      |

- [ ] **Step 3: Worker-route components.** In `UnitAssignmentInterface.tsx` add above the component:

```ts
// Tables POST /api/admin/assign-units writes (assign_units_to_booking)
const ASSIGN_UNITS_WRITES = [
  "booking_units",
  "booking_unit_availability",
  "bookings",
] as const satisfies readonly TableName[];
```

remove `afterBookingUpdate();` from `onSuccess` and add `onSettled: () => { afterWrite(...ASSIGN_UNITS_WRITES); },`. In `PaymentProofViewer.tsx` add `// Tables POST /api/admin/verify-payment writes` + `const VERIFY_PAYMENT_WRITES = ["payments"] as const satisfies readonly TableName[];`, remove `afterBookingPaymentChange();` from `onSuccess`, add `onSettled: () => { afterWrite(...VERIFY_PAYMENT_WRITES); },`. Add the matching pointer comment in `functions/api/admin/assign-units.ts` and `functions/api/admin/verify-payment.ts`.

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: exit 0. Existing store tests that mocked `@/lib/query-invalidation` must be pointed at `@/lib/after-write` (`grep -rn "query-invalidation" src`); none may remain outside `query-invalidation.ts` and its test except Task 4-5 sites.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(query): bookings and payments report written tables through afterWrite" -- <files above>
```

Gaps this closes: status/cancel/update now refresh payments (booking status and guest name are embedded there); payment writes now refresh guests (statistics trigger); every write refreshes the audit section.

---

### Task 4: Accounts, transfers, expenses

**Files:**

- Modify: `src/stores/useAccountStore.ts:208,251,277,280,302`, `src/stores/useTransferStore.ts:248-249,275-280`, `src/stores/useExpenseStore.ts:5,323,390,412-415`

**Interfaces:**

- Consumes: `afterWrite` from `@/lib/after-write`.

- [ ] **Step 1: Swap the calls**

| Site                                                       | Change                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useCreateAccount`, `useUpdateAccount`, `useDeleteAccount` | Replace `queryClient.invalidateQueries({ queryKey: accountKeys.all })` with `afterWrite("accounts")` in `onSettled` (merge duplicate success/error calls into one `onSettled`) |
| `useReactivateAccount` (`onSuccess` only today)            | Move to `onSettled: () => { afterWrite("accounts"); }`                                                                                                                         |
| `useCreateTransfer`, `useDeleteTransfer`                   | Replace both `transferKeys.all` and `accountKeys.balances()` calls with `afterWrite("account_transfers")` in `onSettled`                                                       |
| `useCreateExpense`, `useUpdateExpense`                     | `afterExpenseChange()` → `afterWrite("expenses")`                                                                                                                              |
| `useDeleteExpense`                                         | Replace the error-path `expenseKeys.all` call and the success-path `afterExpenseChange()` with one `onSettled: () => { afterWrite("expenses"); }`                              |

Remove imports that become unused (`accountKeys`, `transferKeys`, `expenseKeys`, `useQueryClient`) only where nothing else in the file uses them; optimistic code keeps its imports.

- [ ] **Step 2: Verify and commit**

Run: `npm run verify` (exit 0).

```bash
git commit -m "refactor(query): finance writes report tables through afterWrite" -- src/stores/useAccountStore.ts src/stores/useTransferStore.ts src/stores/useExpenseStore.ts
```

Gaps this closes: transfers now refresh the full `accounts` root (active list included); account renames refresh the transfers list.

---

### Task 5: Units, guests, `useEntityEdit`, settings and roles

**Files:**

- Modify: `src/stores/useUnitStore.ts:214,271,286,347` (and delete the commented realtime block at :298-316), `src/stores/useGuestStore.ts:6,250,285,288` (and delete the commented realtime block at :298-314)
- Modify: `src/hooks/entity/useEntityEdit.ts:6,127-137`, `src/hooks/entity/__tests__/useEntityEdit.test.tsx:306-340`
- Modify: `src/hooks/usePaymentMethods.ts` (6 sites), `src/hooks/useExpenseCategories.ts` (4 sites), `src/hooks/usePricingConfig.ts:175-177`, `src/hooks/useSeasonalRates.ts:49`, `src/hooks/useDiscountRules.ts:49`, `src/hooks/useRoleManagement.ts:159-160,225,275`
- Modify (comment only): `functions/api/pricing/update-config.ts`

**Interfaces:**

- Consumes: `afterWrite`, `TableName`.
- Produces in `useEntityEdit.ts`: `const ENTITY_TABLES: Record<EntityType, TableName> = { booking: "bookings", guest: "guests", expense: "expenses", payment: "payments", unit: "units" };`

- [ ] **Step 1: Update the `useEntityEdit` test first.** Replace the "Query invalidation" test body's assertions with:

```ts
expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: guestKeys.all });
expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: bookingKeys.all });
```

rename it `"refreshes the guest and the bookings that embed it on success"`, and import `bookingKeys, guestKeys` from `@/lib/query-keys`. `afterWrite` uses the app's singleton client, so the spy must be on it: `vi.spyOn(appQueryClient, "invalidateQueries")` with `import { queryClient as appQueryClient } from "@/lib/query-client";` (the test's wrapper client may be a different instance; the app provider uses the singleton, see `src/lib/query-client.ts`).

Run: `npx vitest run src/hooks/entity/__tests__/useEntityEdit.test.tsx`
Expected: FAIL (bookings not invalidated today).

- [ ] **Step 2: Swap `useEntityEdit`.** Replace the two `invalidateQueries` calls and the `if (entityType === "expense") invalidateAccounts();` line in `onSettled` with `afterWrite(ENTITY_TABLES[entityType]);`. Keep `onMutate`'s `cancelQueries`/`setQueryData` and `onError`'s rollback. Re-run the test: PASS.

- [ ] **Step 3: Swap the remaining sites** (each in `onSettled`; move `onSuccess`-only calls to `onSettled`):

| Site                                                                           | Call                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useCreateUnit`, `useUpdateUnit`, `useDeleteUnit`, `useBatchUpdateUnitsStatus` | `afterWrite("units")`                                                                                                                                   |
| `useUpdateGuest`, `useDeleteGuest`                                             | `afterWrite("guests")`                                                                                                                                  |
| `usePaymentMethods.ts` create/update/delete/reactivate/upload QR/delete QR     | `afterWrite("payment_methods")`                                                                                                                         |
| `useExpenseCategories.ts` create/update/archive/restore                        | `afterWrite("expense_categories")`                                                                                                                      |
| `useUpdatePricingConfig`                                                       | `afterWrite("pricing_config")`; add `// Tables PUT /api/pricing/update-config writes: pricing_config` above the hook and a pointer comment in the route |
| `useSaveSeasonalRates`                                                         | `afterWrite("seasonal_rates")`                                                                                                                          |
| `useSaveDiscountRules`                                                         | `afterWrite("discount_rules")`                                                                                                                          |
| `useGrantRole`, `useUpdateRole`, `useDeactivateRole`                           | `afterWrite("app_roles")` (grant's second call to `pendingUsersKeys.all` goes; the map covers it)                                                       |

Delete the two commented-out realtime blocks in `useUnitStore.ts` and `useGuestStore.ts`.

- [ ] **Step 4: Verify and commit**

Run: `npm run verify` (exit 0).

```bash
git commit -m "refactor(query): units, guests, settings and roles report tables through afterWrite" -- <files above>
```

Gaps this closes: guest and unit edits refresh bookings and payments; unit status changes refresh availability; pricing writes drop remembered prices; role changes refresh the current user's role.

---

### Task 6: Delete old helpers and realtime, Dashboard refetch, lint rule, docs

**Files:**

- Delete: `src/lib/query-invalidation.ts`, `src/lib/__tests__/query-invalidation.test.ts`, `src/hooks/useMultiUnitRealtime.ts`, `src/hooks/useAvailabilityRealtime.ts`
- Modify: `src/components/bookings/MultiUnitBookingForm.tsx:52,153`, `src/components/bookings/__tests__/MultiUnitBookingForm.test.tsx:38-40,668-679`
- Modify: `src/hooks/usePricingCalculation.ts:229-243`, `src/hooks/__tests__/usePricingCalculation.test.tsx:14,615-640`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `eslint.config.js`
- Modify: `src/hooks/README.md`, `src/stores/README.md` (rows for deleted hooks, invalidation notes), `docs/plans/2026-10-10-architecture-deepening.md` (tick Candidate 4 tasks, Resume state)

- [ ] **Step 1: Delete the old module and realtime.** `git rm` the four files. Remove the `useAvailabilityRealtime` import and call from `MultiUnitBookingForm.tsx`, its `vi.mock` and the "integrates with real-time availability monitoring" test. Delete `useClearPricingCache` and its two tests. Check: `grep -rn "query-invalidation\|useAvailabilityRealtime\|useMultiUnitRealtime\|useClearPricingCache" src` prints nothing (README rows aside, fixed in Step 4).

- [ ] **Step 2: Dashboard refresh**

```tsx
import { useBookings } from "@/stores/useBookingStore";

import { DesktopDashboard } from "./DesktopDashboard";
import { MobileDashboard } from "./MobileDashboard";

export function Dashboard() {
  const { data: bookings, isLoading, dataUpdatedAt, isFetching, refetch } = useBookings();
  const refresh = () => void refetch();
```

Drop the `useCallback`, `useQueryClient` and key imports; pass `onRefresh={refresh}` as before.

- [ ] **Step 3: Lint rule.** Add after `dangerousHtmlSelector`'s neighbours a new block before the "Components and routes" block:

```js
  // Mutations report written tables through afterWrite; it alone knows what each table refreshes
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/after-write.ts", "**/__tests__/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          property: "invalidateQueries",
          message: "Call afterWrite(...tables) from @/lib/after-write in onSettled instead.",
        },
        {
          property: "removeQueries",
          message: "Call afterWrite(...tables) from @/lib/after-write in onSettled instead.",
        },
      ],
    },
  },
```

Prove it bites: temporarily add `queryClient.invalidateQueries({ queryKey: ["x"] });` to `src/pages/Dashboard.tsx`, run `npx eslint src/pages/Dashboard.tsx`, expect the "Call afterWrite" error, then remove the line.

- [ ] **Step 4: Docs.** Remove the README rows for the deleted hooks; where `src/stores/README.md` or `src/hooks/README.md` describe invalidation helpers, replace with one line: "Mutations call `afterWrite(...tables)` from `@/lib/after-write` in `onSettled`." In the parent plan: tick the Candidate 4 line, update "Resume state" (Candidate 4 done, next Candidate 6; balances fix branch pending).

- [ ] **Step 5: Verify and commit**

Run: `npm run verify` (exit 0).

```bash
git commit -m "refactor(query): delete the operation helpers and dead realtime; lint direct invalidation" -- <files above>
```

---

### Task 7: Browser check, PR, deploy

- [ ] **Step 1: Browser check** with `supabase start` + `npm run build && npx wrangler pages dev` (see the `run` skill), manager login (`.env.test` creds). Do not run `npm run verify` while browsing (it wipes local bookings). Check, with a screenshot each that you open and describe:
  1. Rename a guest on the guest edit page → bookings list shows the new name without a reload.
  2. Record a payment on a booking → payments list shows it, the booking's payment status changes, Accounts balance changes, the booking's audit section shows the new row.
  3. Confirm a Pending booking → payments list shows the new booking status.
- [ ] **Step 2: Whole-branch review** (superpowers:requesting-code-review), fix findings, `npm run verify`.
- [ ] **Step 3: PR** (mattpocock-skills:pr for the body) into `main`; push with `timeout: 600000`; confirm with `git fetch origin && git rev-parse HEAD origin/refactor/invalidate-by-domain-fact`.
- [ ] **Step 4: After merge,** confirm the CI deploy job ran for the merge commit (`gh run list --branch main --limit 3`) and the live entry bundle hash matches the build. Remember PWA updates apply on next visible page load; no data migration depends on it.

## Decisions & Deferrals

See the parent plan's "Candidate 4 grilling, round 1-3" blocks. Plan-time additions (2026-10-14):

- **Dead keys are deleted in Task 1, before the module exists.** Why: the coverage test (Task 2) cannot pass while unread roots remain. Revisit: n/a.
- **The pricing memo is removed, not invalidated (`MEMOS`).** Why: `usePricingCalculation` reads it with `getQueryData`, which ignores staleness, so invalidating would keep serving old prices. Revisit: n/a.
- **Lint uses `no-restricted-properties`, not another `no-restricted-syntax` selector.** Why: `no-restricted-syntax` lists do not merge across config blocks, so the exemption for `after-write.ts` would have to repeat every other selector. Revisit: n/a.
- **`useMultiUnitBookingStore.clearAvailabilityCache` stays** (its realtime caller goes). Revisit: Candidate 6.
- **Optimistic `cancelQueries` on `bookingKeys.all` etc. stays.** Revisit: Candidate 6.
