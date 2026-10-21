# Bookings page overhaul

Goal: overhaul the admin bookings page (`/admin/bookings`) for phone and laptop. Frontend only. Direction is picked by prototyping three variants against fixed tasks and fixed data, then written up with `/to-spec` → `/to-tickets`.

## Page job

- Dashboard owns "what happens today". The bookings page owns "needs action + in-house + upcoming + find any booking".
- Pending guest bookings move in from the Booking Queue page (`/admin/bookings/queue`), which goes away.
- One "New booking" flow (add one or more cabins) replaces the Single / Multi-Cabin dropdown. Both current forms already end in `createBooking` → `create_multi_unit_booking` with `units[]` (`src/lib/bookings/create.ts:39`).
- Each booking shows one main action from its status; the rest go in an overflow menu:
  - Pending guest booking → Verify payment
  - Pending walk-in → Confirm
  - Confirmed, check-in day reached → Check in
  - CheckedIn → Check out
  - Balance due → Record payment (second chip)
- Check in / Check out do not exist in the UI today. `STATUS_TRANSITIONS` in `src/lib/bookings/operations.ts:78` allows them and `useUpdateBookingStatus` (`src/stores/useBookingStore.ts:410`) can set them; the only caller sets `Confirmed`.

## Problems to fix

- Phone: too many badges per card, no date grouping, search and filters take the screen, cards too tall.
- Laptop: filters hidden in popovers, opening a booking loses list state (filters live in zustand, not the URL), 10-row pages.

## Variants

- **V1 Agenda**: one list grouped "Needs action" / "In-house" / "Arriving this week" / "Later"; compact cards at all widths; one status action per row.
- **V2 Views + side pane**: dense table with view tabs (Upcoming · In-house · Needs action · Past · Cancelled) and visible filter chips; list-detail from `expanded`, full-screen sheet on phone.
- **V3 Cabin timeline**: cabins × days with stay bars; tap opens the booking; list of stays in range below.

Shared rules for all variants:

- No 10-row pages. Date groups show all current and upcoming stays; Past and Cancelled use "Show more". Long lists must be virtualized.
- Phone: one search field + view chips; other filters in one "Filters" sheet with an active count.
- Filter and view state in the URL.
- Built from `@/components/patterns` per `DESIGN.md`. V2 may break the "admin lists are single-pane" rule; if it wins, update `DESIGN.md` in the spec.
- Create: prototype the entry point and cabin step only.

## Evaluation

Run each variant at phone and laptop width against:

1. Find a booking by guest name.
2. See who arrives this week.
3. Check in a guest.
4. Verify a pending guest booking.
5. Start a 2-cabin booking.

Fewest taps and least confusion wins; parts may be mixed.

## Tasks

- [x] Create a worktree on branch `proto/bookings-overhaul` from `main` (`../okaeri-proto-bookings`, base 55fdba34)
- [x] Fixture of ~40 bookings, dates relative to today: every status, multi-cabin, walk-in, long names, unpaid balance, empty In-house case
- [x] Staff-only route `/admin/prototype/bookings?v=1|2|3` (dev server: `npx vite --port 5174` in this worktree; 5173 is left for other sessions)
- [x] V1 Agenda
- [ ] V2 Views + side pane
- [ ] V3 Cabin timeline
- [ ] Run the 5 tasks on each variant at both widths; record results here
- [ ] Pick the winner (user decision)
- [ ] `/to-spec`, then `/to-tickets`
- [ ] Delete the prototype branch and worktree

## Decisions & Deferrals

- Frontend only; schema needs are noted, not built. Revisit in the spec.
- Prototype on `proto/bookings-overhaul`, never merged; only the decision moves forward via the spec. Revisit: never.
- Fixture data in code, not the DB, because the local DB has no real data. Revisit: never.
- Deferred to separate tickets (bugs, not design): Status filter offers `NoShow` but `src/types/booking-status.ts` has no NoShow; CSV export ignores active filters (`useBookingsTable.ts:80-82`); route search params `status/search/page` are declared but unused (`src/routes/admin/bookings.tsx:27-31`). Revisit: file with `/to-tickets` or before the spec.
- Prototype does not virtualize: 40 fixture rows render fast, and Past/Cancelled use "Show more" (10 at a time). The spec picks the library (`@tanstack/react-virtual` is the default candidate). Revisit: in the spec.
- Prototype extras to judge, not decided: V1-V3 share a Verify step that verifies AND assigns cabins in one screen (today these are two routes); a "Data: nobody in-house" toggle in the switcher shows the empty In-house case. Revisit: during evaluation.
- Virtualization: no virtualization library in `package.json` yet. Choosing one (e.g. `@tanstack/react-virtual`, same family as TanStack Table) is a prototype-session decision. Revisit: during V1/V2 build.

## Resume state

Grilling done 2026-10-21. 2026-10-21: worktree `../okaeri-proto-bookings`, fixture, route and V1 built; V2 next. This doc is untracked; it was written while the main checkout was on another session's branch (`fix/booking-edit-mobile-double-scroll`).
