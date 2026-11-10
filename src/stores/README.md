# Stores

Most files cover one entity and hold two layers:

- A Zustand store (`useBookingStore`, `useGuestStore`, `useExpenseStore`, …) for client state: filters, search text, sort, selection, table state. Lists and details do not live here.
- TanStack Query hooks beside it (`useAllBookings`, `useGuests`, …) for server data. Queries are `queryOptions` factories (`bookingDetailQuery`, …) with keys from `src/lib/query-keys.ts`.

## Rules

- After a write, a mutation calls `afterWrite(...tables)` from `src/lib/after-write.ts` with the tables the write touched, instead of invalidating keys by hand. It also refreshes queries on tables that database triggers write.
- Stores that persist pick their fields with `partialize`. Entity stores keep that list to UI preferences such as sort and table state.
- Writes need no app-side audit call: the audit trigger records them (`src/components/audit/CLAUDE.md`).
- Components read data through these hooks or the `db` helpers in `src/lib/supabase.ts`, not through the `supabase` client.

## Files outside the entity pattern

- `useUIStore.ts`: theme, toasts, modals and confirm dialogs.
- `useMultiUnitBookingStore.ts`: the staff multi-unit booking form draft (selected units, guest assignments, pricing). It persists the `draftBooking`.
- `useAuditStore.ts`: audit log filters, quick filter presets and table state. It has no query hooks.
- `useDocumentStore.ts`: document drafts, letterhead and numbering. It persists `letterhead` and `documentCounter`.
- `useInstallPromptStore.ts`: the PWA install prompt (`useCanShowInstallBanner`).
- `useExpenseStore.ts`, `usePaymentStore.ts`: expense and payment list filters, search and sort only. Their query and mutation hooks live in `src/hooks/useExpenses.ts` and `src/hooks/usePayments.ts`; accounts and transfers have no store (`src/hooks/useAccounts.ts`, `src/hooks/useTransfers.ts`).

Shared hooks that are not entity CRUD live in `src/hooks/` (see its README). Terms follow `GLOSSARY.md`.
