# Mobile Booking Card — Density 2 + Confirm Action Design

**Date:** 2026-05-24
**Surface:** `src/components/bookings/BookingsTable/components/BookingCard.tsx` (mobile bookings list, `isMobile` branch in `BookingsTable/index.tsx`)
**Goal:** Bring mobile booking actions to parity with desktop (add **Confirm** and **Delete**) while tightening the card layout to remove ~30% of vertical whitespace, without affecting the desktop table.

---

## Problem

The mobile booking card has two issues:

1. **Action parity gap.** Desktop `BookingActionsCell.tsx` exposes five actions in its `⋯` menu (Edit, Upload Payment, Confirm, Cancel, Delete). The mobile card surfaces only four (View, Edit, Payment, Cancel) and **silently omits Confirm and Delete** — both gated by role on desktop but accessible from a workstation, neither reachable from a phone. Pending bookings cannot be confirmed without leaving the list to a detail page.
2. **Whitespace and chrome.** The current card uses six vertical bands for ~six pieces of information: a header row, a nested `bg-neutral-50` box for dates, a labeled units row, an amount row, and two stacked rows of buttons. The nested date box (`bg-neutral-50 px-3 py-2` inside an already-padded `MobileCard`) creates the largest single visual weight without adding scannable information.

## Non-goals

- Do not modify the desktop table, `BookingActionsCell.tsx`, `BookingColumns.tsx`, or any column rendering.
- Do not change the `Booking` type, `BookingFilters`, `useBookingStore`, or any database/server-side code.
- Do not redesign the `MobileCard`, `StatusBadge`, `ActionMenu`, or `UNIT_SLOT_MAP` chip color encoding.
- Do not introduce swipe gestures, long-press handlers, or drag interactions.
- Do not change the routing/navigation contract for `/admin/bookings/$bookingId` or `/admin/bookings/$bookingId/edit`.
- Do not adjust role gating semantics (`canEdit`, `canDelete`, `canConfirmBookings`) — reuse `useUserRole` exactly as the desktop does.

## Decisions (from brainstorming)

1. **Action pattern: Option A — single primary button + `⋯` overflow menu.**
   The primary button is status-dependent; the `⋯` menu (reusing the existing `ActionMenu` component) carries everything else. Eliminates the "two rows of similar buttons" layout while making the headline action visually decisive.
2. **Layout density: Density 2 — facts strip.**
   Drop the nested date `bg-neutral-50` block; collapse `dates + nights + guests` into a single line of dot-separated metadata; collapse `units + amount + payment` into a second metadata row.
3. **Date format: smart same-month shortening.**
   Same month → `Jun 26 → 27`. Cross month → `Jun 30 → Jul 2`. Both shorter than the prior `Jun 26 — Jun 27` and unambiguous at the boundary.
4. **Payment indicator: colored dot + word.**
   Replace the labeled `Payment: [Pending]` badge with a 6px colored dot + single word at `text-xs text-neutral-600`. Frees horizontal space for the amount and avoids competing with the booking status badge in the header.
5. **Whole-card tap → info zone only.**
   The card is not a `<Link>`. The header (status + `⋯` menu) and the action zone (primary button) sit _outside_ the tappable area to keep HTML valid and avoid nested-clickable-element issues. The tappable zone is just the facts strip + units/amount/payment row.
6. **Nights count included.**
   Adds a piece of information staff currently compute mentally; earns the date-line compression.
7. **Mobile gets Delete parity.**
   Delete arrives on mobile via the `⋯` menu, gated by `canDelete` exactly as on desktop. Confirm dialog reused.
8. **Cancelled bookings.**
   Action zone (primary button) is hidden. `⋯` menu still surfaces Edit + Delete per role.

---

## Design

### Final layout

```
┌──────────────────────────────────────┐
│ Jonah Soriano-Tan   [Pending]    ⋯   │   ← header zone
│ BKG-2026-05-931                      │
│ Jun 26 → 27 · 2 nights · 1 guest     │   ← tappable info zone
│ [C1]    ₱10,000.00    ● Pending      │   ← tappable info zone
│ [     ✓  Confirm   (primary)     ]   │   ← action zone (status-dependent)
└──────────────────────────────────────┘
```

### 1. Header zone

- **Left column** (identity): guest name (`text-base font-semibold`), inline `Walk-in` pill when `is_walk_in === true`, booking reference on the line below in mono `text-xs text-neutral-400`.
- **Right column** (state + actions): `StatusBadge` + `ActionMenu`.
- `ActionMenu` actions are constructed inline using `useUserRole()` from `@/hooks` — mirroring the action list in `BookingActionsCell.tsx` so role gating stays consistent across viewports. Delete arrives on mobile from this reuse.
- Role gating (identical to desktop):

  | Action         | Hook flag                              | Roles that see it          |
  | -------------- | -------------------------------------- | -------------------------- |
  | Edit           | `canEdit`                              | Manager, Owner, Admin      |
  | Upload Payment | (none)                                 | anyone, payment incomplete |
  | Confirm        | `canConfirmBookings` (= `isManager`)   | Manager, Owner, Admin      |
  | Cancel         | `canEdit`                              | Manager, Owner, Admin      |
  | Delete         | `canDelete` (= `isOwner \|\| isAdmin`) | Owner, Admin               |

- The header is **not** in the tappable info zone — it owns its own controls (`⋯`, status badge) and must not double-fire navigation when those are tapped.

### 2. Tappable info zone

- Wrapped in a `<div role="button" tabIndex={0}>` with `onClick` → `navigate({ to: "/admin/bookings/$bookingId" })`, `onKeyDown` handling Enter and Space.
- Visual affordance: `-mx-1 px-1 rounded cursor-pointer active:bg-neutral-100 focus-visible:bg-neutral-50`.
- `aria-label` reads `View booking ${booking_reference}`.

**Row A — facts strip:**

```
Jun 26 → 27 · 2 nights · 1 guest
```

- Dates: `formatStayRange(check_in, check_out)` — date-fns `format(date, "MMM d")` for both ends, same-month shortened to `MMM d → d`. Uses `utcToResortTime` for parsing (matches `formatTableDate`).
- Nights: `getNights(check_in, check_out)` — millisecond delta / 86,400,000, rounded, floor at 1.
- Guests: pluralized via `num_guests === 1 ? "guest" : "guests"`.
- Separators: `<span class="text-neutral-300" aria-hidden>·</span>` so screen readers don't announce the bullet.
- Wraps via `flex flex-wrap gap-x-2 gap-y-0.5` — separators degrade gracefully if a row wraps.

**Row B — units · amount · payment:**

- Left: `flex flex-wrap gap-1` of unit chips reusing `UNIT_SLOT_MAP` color encoding (unchanged from current behavior).
- Right: amount (`formatCurrency`, mono semibold) and `PaymentDot` separated by `gap-3`.
- Outer row: `flex flex-wrap items-center justify-between gap-x-3 gap-y-1` so multi-unit bookings push the amount to a new visual line cleanly.

### 3. `PaymentDot` helper

Co-located in `BookingCard.tsx` (single use, ~15 lines):

| Payment status    | Dot color        | Label       |
| ----------------- | ---------------- | ----------- |
| Completed         | `bg-emerald-500` | `Paid`      |
| Pending           | `bg-amber-500`   | `Pending`   |
| Failed            | `bg-red-500`     | `Failed`    |
| Refunded          | `bg-red-500`     | `Refunded`  |
| (other / unknown) | `bg-neutral-400` | passthrough |

Dot is 6px (`h-1.5 w-1.5 rounded-full`), label is `text-xs text-neutral-600`. Dot marked `aria-hidden` — the label carries the meaning.

### 4. Action zone — status matrix

| `booking_status` | `payment_status` | Primary button                                  | `⋯` menu contents                             |
| ---------------- | ---------------- | ----------------------------------------------- | --------------------------------------------- |
| Pending          | any              | **Confirm** (default solid variant, full width) | Edit, Upload Payment, Confirm, Cancel, Delete |
| Confirmed        | not Completed    | **Upload Payment** (outline variant)            | Edit, Upload Payment, Cancel, Delete          |
| Confirmed        | Completed        | _(action zone hidden)_                          | Edit, Cancel, Delete                          |
| Cancelled        | any              | _(action zone hidden)_                          | Edit, Delete                                  |

- Primary button uses `size="sm"` with a leading icon (`Check` for Confirm, `Upload` for Upload Payment).
- The `⋯` menu retains the menu items even when an action is also exposed as a primary button — matches desktop behavior where the `⋯` menu is the complete inventory.
- "Confirm" primary is only shown if `canConfirmBookings === true`. Without that permission, Pending bookings show no primary action and Confirm is also absent from the `⋯` menu (same gating as desktop).

### 5. Delete confirmation

- Uses the existing `AlertDialog` shadcn component with identical copy to `BookingActionsCell.tsx`.
- Local `showDeleteDialog` state, dialog rendered as a sibling of `MobileCard` (not nested) to avoid stacking-context bugs.

### 6. Vertical rhythm

- `MobileCard` inner spacing: `space-y-2` (was `space-y-3` in the prior implementation).
- Info zone internal: `space-y-1.5`.
- Action zone has `pt-1` to give a small visual break from the info zone without restoring the old wide gap.
- Net effect: card height shrinks by ~30% for a typical Pending booking (~6 bands → 4 bands).

### 7. Prop contract

`BookingCardProps` (in `BookingsTable/types.ts`) gains two TanStack-Query-style mutation references so the card can fire Confirm and Delete locally without dispatching through the parent:

```ts
interface MutationLike<TVariables> {
  mutate: (variables: TVariables) => void;
}

export interface BookingCardProps {
  booking: Booking;
  onUploadPayment: () => void;
  onCancel: () => void;
  updateBookingStatus: MutationLike<{ bookingId: string; status: BookingStatus }>;
  deleteBooking: MutationLike<string>;
}
```

`BookingsTable/index.tsx` exposes `updateBookingStatus` and `deleteBooking` from `useBookingsTable` (both already created inside the hook) and forwards them to `<BookingCard />`.

---

## Testing plan

Existing `walk-in-badge.test.tsx` is updated to:

- Pass the new required props (`updateBookingStatus`, `deleteBooking`) as `vi.fn()` mocks.
- Switch the `@tanstack/react-router` mock from `Link` to `useNavigate` since the card no longer wraps anchors.

New tests in a sibling `booking-card.test.tsx`:

- **Primary button by status**
  - Pending + `canConfirmBookings` → renders `Confirm` button; clicking it calls `updateBookingStatus.mutate` with `Confirmed`.
  - Confirmed + payment Pending → renders `Upload Payment` button; clicking calls `onUploadPayment`.
  - Confirmed + payment Completed → no primary button rendered.
  - Cancelled → no primary button rendered.
- **`⋯` menu contents**
  - Owner role (`canDelete: true`) sees `Delete` menu item.
  - Manager (`canConfirmBookings: true`) on Pending sees `Confirm` in the menu.
- **Info-zone navigation**
  - Click on the facts strip calls `navigate({ to: "/admin/bookings/$bookingId", params: { bookingId } })`.
  - Click on the `⋯` button does **not** also navigate (no propagation conflict).
- **Date formatting**
  - Same month (e.g., `2026-06-26` → `2026-06-27`) renders `Jun 26 → 27`.
  - Cross month (e.g., `2026-06-30` → `2026-07-02`) renders `Jun 30 → Jul 2`.
- **Pluralization**
  - `num_guests === 1` renders "1 guest"; `2` renders "2 guests".
  - `nights === 1` renders "1 night"; `2` renders "2 nights".

`useUserRole` is mocked per-test to drive role-gated assertions.

---

## Edge cases

| Scenario                                                                        | Handling                                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Multi-unit booking (3+ chips)                                                   | Row B wraps via `flex-wrap`; chips occupy their natural width on line 1, amount + payment dot drop to line 2. |
| Long guest name                                                                 | Header `min-w-0` on the identity column allows truncation; `⋯` button stays anchored right.                   |
| Walk-in badge                                                                   | Stays inline with guest name; not part of the tappable info zone.                                             |
| Booking with no units                                                           | Row B's units chip container is empty (`flex-wrap` with 0 children) — amount + payment shift left naturally.  |
| `payment_status === null`                                                       | `PaymentDot` defaults to "Pending" with amber.                                                                |
| User without `canEdit` and without `canDelete` and without `canConfirmBookings` | `menuActions.length === 0` → `⋯` button is not rendered. Card is still navigable via the info zone.           |
| Pending booking but user lacks `canConfirmBookings`                             | Primary action falls through to "Upload Payment" if payment incomplete, otherwise action zone hides.          |
| Confirmed paid Cancelled booking (`booking_status === "Cancelled"`)             | Action zone hidden; `⋯` menu shows Edit + Delete only.                                                        |

---

## Out of scope (deferred)

- Animations on primary-button swap when status changes (re-render, not a transition).
- Pull-to-refresh.
- Bulk-select on mobile.
- Tappable amount → revenue detail.
- Localized number/date formatting beyond `en-PH` currency (already in place).
