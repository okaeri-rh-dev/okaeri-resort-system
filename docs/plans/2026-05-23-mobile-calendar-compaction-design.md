# Mobile Booking Calendar Compaction — Design

**Date:** 2026-05-23
**Surface:** `src/components/dashboard/DashboardCalendar.tsx` (mobile / `headerVariant="stacked"` path only)
**Goal:** Reduce vertical whitespace and increase per-cell content density on the mobile booking dashboard calendar without affecting the desktop or admin availability variants.

---

## Problem

The mobile calendar (`MobileDashboard` → `DashboardCalendar` with `headerVariant="stacked"`) wastes vertical space above the grid and truncates guest names inside date cells more aggressively than necessary:

- The `StackedHeader` renders **two rows**: chevron+title on top, `28 bookings this month` + `Today` button below. Combined with the `CardHeader` default `p-6` and the 44px chevron buttons, this consumes ~150–180px before the weekday row is reached.
- Each date cell uses `p-1` (4px) of inner padding plus `px-1` (4px) inside each unit chip. The total 8px of horizontal padding per chip eats character budget, producing truncations like `Miggy…`.

## Non-goals

- Do not modify the desktop `RowHeader` or any usage of `headerVariant="row"` (`DesktopDashboard`, `routes/admin/availability.tsx`).
- Do not redesign the chip component, change unit color encoding, or alter availability logic.
- Do not introduce swipe gestures, long-press handlers, or other new interactions.

## Decisions (from brainstorming)

1. **Compaction level:** tighten + single-row header. Remove the `Today` button and `X bookings this month` text.
2. **Cell height:** keep `h-20 sm:h-24 md:h-28`; reclaim padding instead of shrinking the cell.
3. **Chip density:** tighten chip horizontal padding (`px-1` → `px-0.5`); keep height and font clamp unchanged.

---

## Design

### 1. Mobile header

Collapse `StackedHeader` from two rows to one row, justified between:

```
[◀]              May 2026              [▶]
```

- Remove the `Today` `<Button>` and the `28 bookings this month` `<span>`.
- Drop the `space-y-2` modifier on the `CardHeader`.
- Change `CardHeader` padding from default (`px-6 py-6`) to `px-3 py-2`.
- Keep chevrons at `h-11 w-11` (44px) to preserve WCAG-recommended touch target sizing.
- Keep the month label at `text-base font-semibold tabular-nums`, centered between the chevrons.
- Keep the exported name `StackedHeader` to minimize rename churn even though the layout is no longer stacked.

Expected reclaim: ~80–100px of vertical space above the grid.

### 2. Date cell padding (mobile only)

In the `DayButton` component:

- Change the `<Button>` className from `p-1` to `p-0.5` **only when** the `compact` flag is true.
- Cell height remains `h-20 sm:h-24 md:h-28`.
- Date-number `<span>` remains `text-xs`.

### 3. Chip horizontal padding (mobile only)

In `BookingIndicators`:

- Accept a new optional `compact?: boolean` prop.
- When `compact`, change the chip wrapper from `px-1 py-0.5` to `px-0.5 py-0.5`.
- Keep `h-3 sm:h-4` and the `text-[clamp(7px,2cqi,10px)]` clamp unchanged.

Net per-cell horizontal gain: ~8px → 2–3 additional characters of guest name visible before the ellipsis.

### 4. Wiring the `compact` flag

The flag is derived from the existing `headerVariant` prop at the `DashboardCalendar` level:

```ts
const compact = headerVariant === "stacked";
```

It is forwarded into `DayButton` via the existing `dayButtonComponent` `useCallback`, and from `DayButton` into `BookingIndicators`.

Rationale (over responsive classes): the mobile/desktop split is already encoded by the `MobileDashboard` vs `DesktopDashboard` page fork. Piggybacking on `headerVariant` keeps the design intent in one place rather than smearing breakpoint logic across leaf components, and avoids unexpectedly compacting a narrow-resized desktop browser.

---

## Files affected

- `src/components/dashboard/DashboardCalendar.tsx` — `StackedHeader` markup change; `DashboardCalendar` derives and threads `compact`; `DayButton` consumes `compact` for its `Button` className and forwards it to `BookingIndicators`.
- `src/components/dashboard/BookingIndicators.tsx` — accept and apply `compact?: boolean`.
- `src/components/dashboard/__tests__/DashboardCalendarHeader.test.tsx` — update assertions: `Today` button and `bookings this month` text no longer rendered in the stacked variant.

No new files, no new dependencies, no API changes.

## Risks and mitigations

- **Losing the `Today` affordance.** Mitigated by the chevron navigation already in place; no new gesture introduced (YAGNI).
- **Losing the `X bookings this month` count.** The information is redundant with the visible chips; product accepted the trade.
- **Accidentally compacting desktop.** Mitigated by gating every density change behind the `compact` flag derived from `headerVariant === "stacked"`. Desktop path is byte-identical to current behavior.
- **Touch target shrinkage.** Chevrons stay at `h-11 w-11`; no tap target shrinks.

## Verification

- Visual: render `MobileDashboard` at a 390px-wide viewport, compare header height and chip text density against the baseline screenshot.
- Visual: render `DesktopDashboard` at ≥1024px and confirm pixel-identical rendering to current.
- Unit: existing `DashboardCalendarHeader.test.tsx` updated to assert single-row stacked layout and absence of removed elements.
- Type: `npm run type-check` clean.

## Out of scope (future work)

- Optional swipe-to-navigate months.
- Optional `Today` gesture (e.g., tap month label).
- Chip typography revisit (raising the font clamp floor).
