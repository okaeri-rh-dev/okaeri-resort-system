# Design: Admin Dashboard Mobile Overhaul

**Date:** 2026-05-18
**Status:** Approved (brainstorm complete, ready for implementation plan)
**Scope:** Mobile (`< md`) only. Desktop layout preserved unchanged.

## 1. Problem

The admin dashboard at mobile width (390px and below) suffers three concrete problems:

1. **Whitespace bloat.** Four stacked KPI cards consume ~80% of the first viewport before any other content is reached.
2. **Calendar is unattributable.** On mobile, day cells show only thin colored bars per unit. Guest names — the most important data — are hidden behind a tooltip-only interaction.
3. **Endless bottom section.** The full "All Bookings" table mirrors `/admin/bookings` and scrolls forever.

Two related findings surfaced during exploration:

- The **calendar header overflows its container by 76px** at a 390px viewport. The overflow is clipped invisibly because an ancestor has `overflow-hidden`, so the "Today" button and right chevron are present in the DOM but unreachable on screen.
- **136px of horizontal space (35% of a 390px viewport) is consumed by nested padding chrome** before the calendar grid begins: container `p-4` + Card `p-6` + CardContent `p-4` + `rdp-root` `p-3`. Every layer was tuned for desktop and is incorrectly applied to mobile.

## 2. Goal

The mobile dashboard answers one question: **"Who is in which cabin, when?"**

Everything else either supports that question or is removed.

## 3. Approach: page-level mobile/desktop branch

`Dashboard.tsx` becomes a thin orchestrator that fetches data once and renders one of two sibling branches via Tailwind responsive utilities (no JS media query, no hydration flicker):

```tsx
export function Dashboard() {
  const { data: bookings, isLoading } = useBookings();
  return (
    <>
      <div className="md:hidden">
        <MobileDashboard bookings={bookings} isLoading={isLoading} />
      </div>
      <div className="hidden md:block">
        <DesktopDashboard bookings={bookings} isLoading={isLoading} />
      </div>
    </>
  );
}
```

- `DesktopDashboard` is the current `Dashboard` body, extracted unchanged.
- `MobileDashboard` is a new compact page containing only Calendar + Tomorrow's Schedule.

The shared `DashboardCalendar` gains a `headerVariant: "row" | "stacked"` prop so both branches reuse one grid + one data path with different chrome.

## 4. Mobile page shape

```
┌─────────────────────────────────────┐
│ Dashboard                           │   compact h1 (text-xl), subtitle dropped
├─────────────────────────────────────┤
│ [Calendar Card — full-width]        │
│   🗓 Booking Calendar     [ Today ] │   stacked header row 1
│   [ ‹ ]    May 2026       [ › ]    │   stacked header row 2 (hero nav)
│   12 bookings this month            │   stacked header row 3 (subtle)
│  ┌──┬──┬──┬──┬──┬──┬──┐            │
│  │SU│MO│TU│WE│TH│FR│SA│            │
│  ├──┼──┼──┼──┼──┼──┼──┤            │
│  │  │  │John Sm│Maria…│ │           │   chips: color-coded, name only
│  └──┴──┴──┴──┴──┴──┴──┘            │
├─────────────────────────────────────┤
│ Tomorrow's Schedule                 │
│  [Check-ins (2)] [Check-outs (1)]   │   existing tabs
│  ──────────────                     │
│  John Smith · C1 · 2 guests · ₱5,400│   single-line list, divide-y
│  ──────────────                     │
│  Maria Vargas · C2 · 4 guests       │
└─────────────────────────────────────┘
```

**Sections cut from mobile:** KPI cards, Recent Bookings list, full Bookings table. All of this data still lives on its dedicated pages (`/admin/bookings`, `/admin/guests`, etc.). The dashboard stops mirroring them.

## 5. Calendar header — stacked variant

Three rows on mobile. Why each one earns its space:

| Row | Content                                                        | Why                                                                                                                                  |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `🗓 Booking Calendar` left, `[Today]` right                    | Identity + escape hatch. Today button is secondary (`h-8 px-2.5 text-xs`).                                                           |
| 2   | `[‹]` 44px — `May 2026` centered (`tabular-nums`) — `[›]` 44px | Hero month navigation. Full-width row, touch-target compliant, mimics native calendar apps. `aria-live="polite"` on the month label. |
| 3   | `12 bookings this month` (`text-xs text-slate-500`)            | Metadata, not headline. Hidden when count is zero.                                                                                   |

Touch targets bumped to `h-11 w-11` (44px) on chevrons — current `h-8 w-8` (32px) is below iOS HIG.

Desktop continues to render the existing single-row header.

## 6. Calendar density reclamation

Mobile-only overrides for the padding waterfall. All other viewports keep current values.

| Layer                         | Current | Mobile override                                   | Reclaimed  |
| ----------------------------- | ------- | ------------------------------------------------- | ---------- |
| Admin `container` wrapper     | `p-4`   | `px-2` on `< md`                                  | 16px       |
| `Card` outer                  | `p-6`   | `p-1` on `< md`                                   | 40px       |
| `CardContent`                 | `p-4`   | `p-0` on `< md`                                   | 32px       |
| `rdp-root` (react-day-picker) | `p-3`   | `p-0` on `< md` (passed via Calendar `className`) | 24px       |
| **Total reclaimed**           |         |                                                   | **~112px** |

Result: calendar grid expands from 250px → ~362px on a 390px viewport. Per-cell width: 35.7px → ~51.7px.

Day cell height stays `h-20` (80px) on mobile. Measure during implementation; bump to `h-24` only if the chips feel cramped.

## 7. BookingIndicators chip — the actual name display

Single render path for all viewports. The current `hidden sm:flex` / `sm:hidden` split is removed, deleting the mobile color-bar branch entirely.

```tsx
<div
  className={cn(
    "flex w-full min-w-0 items-center rounded-sm border px-1 py-0.5",
    "truncate leading-tight font-medium",
    slot.bg,
    chipText,
    chipBorder,
    chipHint
  )}
  style={{ fontSize: "clamp(7px, 2cqi, 10px)" }}
  aria-label={`${slot.unitCode}: ${booking.guest_name}`}
>
  <span className="mr-1 hidden font-mono sm:inline">{slot.unitCode}</span>
  <span className="truncate font-sans">{booking.guest_name}</span>
</div>
```

Key choices:

- **Unit code hidden on mobile** (`hidden sm:inline`). Chip color (blue/emerald/amber) encodes unit identity at narrow widths; desktop continues to show both.
- **`clamp(7px, 2cqi, 10px)`** for the font size. Inline-size container query unit responds to the actual grid width, not the viewport — future-proof if the calendar is ever embedded elsewhere. The calendar grid parent gets `container-type: inline-size`.
- **`font-medium`** (500), not `font-light`. Small text needs more pixel mass to be perceived crisply. Visual delicacy comes from color/background lightness, not stroke weight.
- **`aria-label`** preserves unit + guest identity for screen readers since the unit code text is hidden.

## 8. Tomorrow's Schedule on mobile

Keep the existing `Card` + `Tabs` shape. Reduce internal density:

- Single-line list items: `John Smith · C1 · 2 guests · ₱5,400`
- Drop per-item `border` and `p-3`; use a `divide-y divide-slate-100` list instead
- Tab labels unchanged: `Check-ins (2)` / `Check-outs (1)`
- Empty state: one combined line ("No check-ins or check-outs tomorrow") when both tabs are empty

## 9. Page header on mobile

Keep `<h1>Dashboard</h1>` but `text-xl` on mobile (`md:text-3xl` preserved on desktop). Drop the "Welcome to Okaeri Resort Management System" subtitle on mobile — it is marketing copy, not operational info, and the global app chrome already says "Okaeri".

## 10. No-horizontal-scroll guarantee

Two-pronged.

**CSS invariants (mandatory):**

- `overflow-x-hidden` on `MobileDashboard` root
- `min-w-0` on every flex/grid child containing text
- `truncate` on every text container that could grow
- Calendar header stacks vertically on `< md` (fixes the existing 76px clipped overflow)

**Verifiable invariant (Playwright test):**

- New test in `src/__tests__/e2e/dashboard-mobile-overflow.spec.ts`
- Runs at 320, 375, 390, 414px widths
- Asserts `document.documentElement.scrollWidth === clientWidth`
- Also asserts every visible `Card`'s `scrollWidth === clientWidth` (catches the _clipped_ overflow class of bugs that the current header hides)

## 11. Files changed

| File                                                            | Change                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/pages/Dashboard.tsx`                                       | Becomes thin orchestrator that branches Mobile/Desktop                                                                                                 |
| `src/pages/DesktopDashboard.tsx`                                | New — extracted from current `Dashboard` body                                                                                                          |
| `src/pages/MobileDashboard.tsx`                                 | New — compact Calendar + Tomorrow layout                                                                                                               |
| `src/components/dashboard/DashboardCalendar.tsx`                | Add `headerVariant` prop + stacked-header subcomponent. Add `@container` / `container-type` on grid. Mobile padding overrides on Card/CardContent/rdp. |
| `src/components/dashboard/BookingIndicators.tsx`                | Single render path. Unit code hidden on mobile. `clamp()` font sizing. Delete mobile color-bar branch.                                                 |
| `src/components/dashboard/__tests__/BookingIndicators.test.tsx` | Update tests to match new single-path render.                                                                                                          |
| `src/__tests__/e2e/dashboard-mobile-overflow.spec.ts`           | New — no-scroll invariant at 320/375/390/414px.                                                                                                        |
| Admin route container (`src/routes/admin.tsx` or layout file)   | Mobile padding override (`px-2 md:p-4`). Verify exact file during implementation.                                                                      |

## 12. Out of scope

- Any desktop layout change (explicit constraint).
- Touch gestures (swipe-between-months, pull-to-refresh).
- Mobile-specific KPI integration (cut, not deferred).
- Push-notification UI surfacing on the dashboard.

## 13. Key trade-offs accepted

- **Two render trees on mobile + desktop.** Approach B doubles the page-level surface for two views. Acceptable because the diff is bounded to the page-level `Dashboard.tsx` orchestrator + one new file per branch; shared components do the heavy lifting.
- **Unit code dropped on mobile.** Relies on color to encode unit identity. Accepted as a deliberate density trade.
- **CSS `clamp()` over fixed breakpoint tiers.** Adds one inline style. Worth the ~1–2 characters of extra visible name on smaller phones.
