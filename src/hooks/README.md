# Hooks

React hooks shared across components. Entity CRUD (bookings, guests, payments, expenses, accounts, transfers, documents) lives in `src/stores/`; the hooks here cover settings, roles, multi-unit booking, pricing, realtime and UI helpers.

## Conventions

- Queries are `queryOptions` factories (`@tanstack/query/prefer-query-options` is a lint error). Keys come from `src/lib/query-keys.ts`.
- Components do not import the `supabase` client (lint warning, CI fails on warnings): query through a hook, a store or the `db` helpers in `src/lib/supabase.ts`. Session and sign-in calls use `supabaseAuth`.
- Table writes need no audit call; the audit trigger records them (see `src/components/audit/CLAUDE.md`).

## Files

| File                            | Exports                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------- |
| `entity/useEntityEdit.ts`       | `useEntityEdit`: optimistic edit flow for the entity detail pages                             |
| `useAuthToken.ts`               | `getAccessToken`: bearer token for `/api` calls                               |
| `useUserRole.ts`                | `useUserRole`: current user's role and permission flags for UI gating                         |
| `useRoleManagement.ts`          | `useAllRoles`, `useRoleStats`, `useRoleHistory`, grant/update/deactivate mutations            |
| `usePendingUsers.ts`            | `usePendingUsers`: users with no role assigned (admin API)                                         |
| `usePricingConfig.ts`           | `usePricingConfig`, `useUpdatePricingConfig`                                                  |
| `usePricingCalculation.ts`      | `usePricingCalculation`, `useCachedPricing`                                                  |
| `useDiscountRules.ts`           | `useDiscountRules`, `useSaveDiscountRules`                                                    |
| `useSeasonalRates.ts`           | `useSeasonalRates`, `useSaveSeasonalRates`                                                    |
| `useExpenseCategories.ts`       | category list, active list, create/update/archive/restore                                     |
| `usePaymentMethods.ts`          | method list, active list, create/update/delete/reactivate, QR code upload/delete              |
| `useMultiUnitBookingQueries.ts` | `useMultiUnitAvailability`, `useCreateMultiUnitBooking`                                       |
| `useMultiUnitRealtime.ts`       | `useMultiUnitAvailabilitySubscription`: `afterWrite("availability_blackouts")` and `onChange` on block events |
| `useAvailabilityRealtime.ts`    | `useAvailabilityRealtime`: availability changes that affect multi-unit bookings               |
| `useAvailabilityTimeline.ts`    | `useAvailabilityTimeline`, `blocksInNightsQuery`: stays and blocks for the availability timeline |
| `useContactChannels.ts`         | `useContactChannels`, `useActiveContactChannels`, create/update/set-active/reorder mutations |
| `useUnits.ts`                   | `useUnits`, `useAllUnits`, `useCabinStatesTonight`, `unitDetailQuery`, `allUnitsQuery`, create/update/delete unit mutations |
| `useBlocks.ts`                  | `useBlocks` (current and upcoming, past on request), create/update/delete block mutations    |
| `useDebouncedValue.ts`          | `useDebouncedValue`, `SEARCH_DEBOUNCE_MS`: delay list search queries until typing pauses     |
| `useCalendarBookings.ts`        | `useCalendarBookings` plus `getBookingStatusPriority`, `formatCurrency` for the calendar view |

Width hooks are retired: window queries live in `AppShell`, and panes adapt with `@container` or `DataTable` (DESIGN.md, Layout).

Tests live in `__tests__/` beside the hooks; run them with `npm run test:unit`.
