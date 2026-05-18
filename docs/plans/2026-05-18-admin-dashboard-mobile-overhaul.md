# Admin Dashboard Mobile Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the admin dashboard usable on mobile by simplifying to Calendar + Tomorrow's Schedule only, reclaiming 112px of padding chrome, and rendering guest names inside calendar day cells via a single chip render path.

**Architecture:** Page-level mobile/desktop branch (Approach B). `Dashboard.tsx` becomes a thin orchestrator that fetches data once and renders one of two siblings (`MobileDashboard` / `DesktopDashboard`) via Tailwind responsive utilities. The shared `DashboardCalendar` gains a `headerVariant` prop. The `BookingIndicators` chip is unified to a single render path with `clamp()`-based font sizing.

**Tech Stack:** React 19 · TanStack Router · Tailwind CSS v4 (container queries via `container-type: inline-size`) · shadcn/ui · React Hook Form (unaffected) · Vitest (unit) · Playwright (E2E) · TanStack Query (unaffected — data fetching stays in `useBookings()`).

**Design doc:** `docs/plans/2026-05-18-admin-dashboard-mobile-overhaul-design.md`

**Pre-existing working-tree state to resolve first:** the following files have uncommitted modifications that this plan also touches. Decide before starting: integrate them, stash them, or revert them.

- `src/components/dashboard/BookingIndicators.tsx`
- `src/components/dashboard/__tests__/BookingIndicators.test.tsx`
- `src/components/dashboard/unit-calendar-config.ts`
- `src/components/dashboard/__tests__/unit-calendar-config.test.ts`

**Mandatory invariant:** at no point during this plan should `document.documentElement.scrollWidth > clientWidth` on any mobile width (320/375/390/414px). Task 17 makes this a CI-enforced test.

---

## Sequencing rationale

1. **Group A (calendar header)** first because it's the highest-risk visual change AND it's behind a default-`"row"` prop, so we can land it without affecting current behavior.
2. **Group B (chip unification)** next because it's the second-highest-risk visual change but contained to one component.
3. **Group C (page split)** third — by this point both shared changes are stable, so the page split just composes them.
4. **Groups D–E (Tomorrow's Schedule density, page header)** as small follow-ups inside `MobileDashboard`.
5. **Group F (no-scroll invariant)** last — it's the regression gate that validates the whole stack.
6. **Group G (verification)** is the manual + automated final pass.

---

## Group A — Calendar header refactor

The current `DashboardCalendar` has its header inlined. We extract it into a default-row variant, then add a stacked variant for mobile. The default stays `"row"` so desktop is provably untouched until `MobileDashboard` opts in to `"stacked"`.

### Task 1: Add `headerVariant` prop to DashboardCalendar (non-breaking)

**Files:**

- Modify: `src/components/dashboard/DashboardCalendar.tsx:18-22` (props interface) and the render signature.

**Step 1: Update the props interface.**

Replace the `DashboardCalendarProps` interface to add `headerVariant`:

```tsx
interface DashboardCalendarProps {
  bookings: Booking[] | undefined;
  isLoading?: boolean;
  className?: string;
  headerVariant?: "row" | "stacked";
}
```

**Step 2: Add destructure with default in the component signature.**

```tsx
export const DashboardCalendar = React.memo(function DashboardCalendar({
  bookings,
  isLoading,
  className,
  headerVariant = "row",
}: DashboardCalendarProps) {
```

No header logic changes yet — `headerVariant` is unused. This is a non-breaking type addition.

**Step 3: Verify type-check passes.**

```bash
npm run type-check
```

Expected: PASS (no errors introduced).

**Step 4: Run existing tests.**

```bash
npx vitest run src/components/dashboard
```

Expected: PASS (no behavior changed).

**Step 5: Commit.**

```bash
git add src/components/dashboard/DashboardCalendar.tsx
git commit -m "feat(dashboard): add headerVariant prop to DashboardCalendar (no-op)"
```

---

### Task 2: Extract current header JSX into a `RowHeader` subcomponent

**Files:**

- Modify: `src/components/dashboard/DashboardCalendar.tsx` (CardHeader block lines 139-190).

**Step 1: Define a `RowHeader` component inside the same file.**

Above the `DashboardCalendar` export, define:

```tsx
interface CalendarHeaderProps {
  currentMonth: Date;
  monthlyBookingCount: number;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function RowHeader({
  currentMonth,
  monthlyBookingCount,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  return (
    <CardHeader className="rounded-t-lg bg-gradient-to-r from-slate-50 to-blue-50/30 pb-3">
      {/* Move the existing CardHeader children here verbatim,
          replacing handleToday/handlePreviousMonth/handleNextMonth with onToday/onPrev/onNext. */}
    </CardHeader>
  );
}
```

Move the entire existing `<CardHeader>...</CardHeader>` block from `DashboardCalendar` into `RowHeader`'s return, rewiring handler names.

**Step 2: Use `<RowHeader />` from `DashboardCalendar`.**

In the main component's return, replace the inlined header with:

```tsx
<RowHeader
  currentMonth={currentMonth}
  monthlyBookingCount={monthlyBookingCount}
  onPrev={handlePreviousMonth}
  onNext={handleNextMonth}
  onToday={handleToday}
/>
```

**Step 3: Verify visual identity.**

Run dev server: `npm run dev` (already running per session — verify with `curl -s http://localhost:5173`).

Open `/admin/dashboard` at desktop width (≥1024px) and confirm the calendar header looks identical to before this task.

**Step 4: Run existing tests.**

```bash
npx vitest run src/components/dashboard
```

Expected: PASS.

**Step 5: Commit.**

```bash
git add src/components/dashboard/DashboardCalendar.tsx
git commit -m "refactor(dashboard): extract calendar RowHeader into subcomponent"
```

---

### Task 3: Write failing test for `StackedHeader`

**Files:**

- Create: `src/components/dashboard/__tests__/DashboardCalendarHeader.test.tsx`

**Step 1: Write the failing test.**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StackedHeader } from "../DashboardCalendar";

describe("StackedHeader", () => {
  const baseProps = {
    currentMonth: new Date(2026, 4, 18), // May 2026
    monthlyBookingCount: 12,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
  };

  it("renders the calendar title", () => {
    render(<StackedHeader {...baseProps} />);
    expect(screen.getByText("Booking Calendar")).toBeInTheDocument();
  });

  it("renders the Today button", () => {
    render(<StackedHeader {...baseProps} />);
    expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
  });

  it("renders the month label as polite live region", () => {
    render(<StackedHeader {...baseProps} />);
    const monthLabel = screen.getByText("May 2026");
    expect(monthLabel).toHaveAttribute("aria-live", "polite");
  });

  it("renders prev and next month buttons with 44px touch targets", () => {
    render(<StackedHeader {...baseProps} />);
    const prev = screen.getByRole("button", { name: /previous month/i });
    const next = screen.getByRole("button", { name: /next month/i });
    expect(prev.className).toMatch(/h-11/);
    expect(prev.className).toMatch(/w-11/);
    expect(next.className).toMatch(/h-11/);
    expect(next.className).toMatch(/w-11/);
  });

  it("renders booking count metadata when count > 0", () => {
    render(<StackedHeader {...baseProps} />);
    expect(screen.getByText(/12 bookings this month/)).toBeInTheDocument();
  });

  it("hides booking count metadata when count is zero", () => {
    render(<StackedHeader {...baseProps} monthlyBookingCount={0} />);
    expect(screen.queryByText(/bookings this month/)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run it to verify failure.**

```bash
npx vitest run src/components/dashboard/__tests__/DashboardCalendarHeader.test.tsx
```

Expected: FAIL with `StackedHeader is not exported` (or similar import error).

**Step 3: Commit the failing test.**

```bash
git add src/components/dashboard/__tests__/DashboardCalendarHeader.test.tsx
git commit -m "test(dashboard): failing tests for StackedHeader calendar variant"
```

---

### Task 4: Implement `StackedHeader`

**Files:**

- Modify: `src/components/dashboard/DashboardCalendar.tsx` (add and export `StackedHeader`).

**Step 1: Implement and export the component.**

Inside `DashboardCalendar.tsx`, alongside `RowHeader`, add:

```tsx
export function StackedHeader({
  currentMonth,
  monthlyBookingCount,
  onPrev,
  onNext,
  onToday,
}: CalendarHeaderProps) {
  return (
    <CardHeader className="space-y-2 rounded-t-lg bg-gradient-to-r from-slate-50 to-blue-50/30 pb-3">
      {/* Row 1: identity + reset */}
      <div className="flex items-center justify-between gap-2">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base font-semibold">
          <CalendarDays className="size-5 shrink-0 text-blue-600" />
          <span className="truncate text-slate-800">Booking Calendar</span>
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={onToday}
          className="h-8 shrink-0 px-2.5 text-xs font-medium"
        >
          Today
        </Button>
      </div>

      {/* Row 2: hero month navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          aria-label="Previous month"
          className="h-11 w-11"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <span
          aria-live="polite"
          className="px-3 text-base font-semibold text-slate-800 tabular-nums"
        >
          {format(currentMonth, "MMMM yyyy")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          aria-label="Next month"
          className="h-11 w-11"
        >
          <ChevronRight className="size-5" />
        </Button>
      </div>

      {/* Row 3: subtle metadata */}
      {monthlyBookingCount > 0 && (
        <div className="text-xs text-slate-500">
          {monthlyBookingCount} booking{monthlyBookingCount !== 1 ? "s" : ""} this month
        </div>
      )}
    </CardHeader>
  );
}
```

`RowHeader` is unchanged; we now have two header variants in the same file. Only `StackedHeader` is exported (because the test imports it); `RowHeader` stays module-private.

**Step 2: Wire the variant switch in `DashboardCalendar`.**

In the main component's return, replace the unconditional `<RowHeader ... />` with:

```tsx
{
  headerVariant === "stacked" ? (
    <StackedHeader
      currentMonth={currentMonth}
      monthlyBookingCount={monthlyBookingCount}
      onPrev={handlePreviousMonth}
      onNext={handleNextMonth}
      onToday={handleToday}
    />
  ) : (
    <RowHeader
      currentMonth={currentMonth}
      monthlyBookingCount={monthlyBookingCount}
      onPrev={handlePreviousMonth}
      onNext={handleNextMonth}
      onToday={handleToday}
    />
  );
}
```

**Step 3: Run the failing test.**

```bash
npx vitest run src/components/dashboard/__tests__/DashboardCalendarHeader.test.tsx
```

Expected: PASS (all 6 tests).

**Step 4: Run the full dashboard test suite to confirm no regressions.**

```bash
npx vitest run src/components/dashboard
```

Expected: PASS.

**Step 5: Visual smoke-check (desktop).**

Open `/admin/dashboard` at desktop width. Header should look identical to before (still uses `"row"` default). No mobile branch yet — that comes in Group C.

**Step 6: Commit.**

```bash
git add src/components/dashboard/DashboardCalendar.tsx
git commit -m "feat(dashboard): add StackedHeader calendar variant"
```

---

## Group B — BookingIndicators chip unification

Today the chip has two render paths (`hidden sm:flex` chip + `sm:hidden` color bar). We delete the color-bar path entirely and make the chip the only path, with `clamp()` font sizing and unit-code-hidden on mobile.

### Task 5: Write failing tests for the unified chip

**Files:**

- Modify: `src/components/dashboard/__tests__/BookingIndicators.test.tsx`

**Step 1: Add new assertions for the single-path render.**

(Existing tests may reference the color-bar branch; remove or rewrite those.)

Add tests asserting:

```tsx
it("renders a single chip per occupied unit slot at any viewport", () => {
  // Render with one booking on unit C1
  const { container } = render(<BookingIndicators bookings={[bookingOnC1]} />);
  // No element with sm:hidden mobile-bar pattern should exist
  expect(container.querySelectorAll("[class*='sm:hidden']").length).toBe(0);
  // The chip itself should not have the sm:flex hide pattern either
  expect(container.querySelectorAll("[class*='hidden sm:flex']").length).toBe(0);
  // One visible chip
  expect(screen.getByText(/john smith/i)).toBeInTheDocument();
});

it("hides the unit code text on mobile but keeps it in aria-label", () => {
  const { container } = render(<BookingIndicators bookings={[bookingOnC1]} />);
  const unitCodeSpan = container.querySelector(".font-mono");
  expect(unitCodeSpan).toHaveClass("hidden");
  expect(unitCodeSpan).toHaveClass("sm:inline");
  // The chip's aria-label still includes the unit code
  const chip = container.querySelector("[aria-label]");
  expect(chip?.getAttribute("aria-label")).toMatch(/C1:/);
});

it("applies the clamp() font-size inline style on each chip", () => {
  const { container } = render(<BookingIndicators bookings={[bookingOnC1]} />);
  const chip = container.querySelector("[aria-label]") as HTMLElement;
  expect(chip.style.fontSize).toBe("clamp(7px, 2cqi, 10px)");
});
```

(Use a `bookingOnC1` fixture similar to existing test data. Adjust selectors if the existing test file already has helpers.)

**Step 2: Run the tests to verify failure.**

```bash
npx vitest run src/components/dashboard/__tests__/BookingIndicators.test.tsx
```

Expected: FAIL on each new assertion.

**Step 3: Commit the failing tests.**

```bash
git add src/components/dashboard/__tests__/BookingIndicators.test.tsx
git commit -m "test(dashboard): failing tests for unified BookingIndicators chip"
```

---

### Task 6: Implement the unified chip render path

**Files:**

- Modify: `src/components/dashboard/BookingIndicators.tsx` (the `.map` body returning `<div>` per slot, lines 56-95).

**Step 1: Replace the dual-path block with a single chip.**

Inside the `UNIT_SLOTS.map(...)` body, replace the existing dual render (mobile bar + desktop chip) with:

```tsx
return (
  <div key={slot.unitCode} className="h-3 w-full sm:h-4">
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
  </div>
);
```

The placeholder branch (`!booking → invisible div`) above stays unchanged.

**Step 2: Run the failing tests.**

```bash
npx vitest run src/components/dashboard/__tests__/BookingIndicators.test.tsx
```

Expected: PASS.

**Step 3: Run the full dashboard test suite.**

```bash
npx vitest run src/components/dashboard
```

Expected: PASS.

**Step 4: Commit.**

```bash
git add src/components/dashboard/BookingIndicators.tsx
git commit -m "refactor(dashboard): unify BookingIndicators chip render path"
```

---

### Task 7: Add container-type to the calendar grid for `cqi` units

The `clamp(7px, 2cqi, 10px)` font size needs a containing element with `container-type: inline-size` to resolve `cqi`. Without it, the unit falls back to the initial containing block.

**Files:**

- Modify: `src/components/dashboard/DashboardCalendar.tsx` (the Calendar `classNames.month_grid` or the wrapping element).

**Step 1: Add `[container-type:inline-size]` to the grid wrapper.**

In the `Calendar` component's `classNames` prop, modify `month_grid`:

```tsx
month_grid: "w-full border-collapse space-y-1 [container-type:inline-size]",
```

Tailwind v4 accepts arbitrary CSS properties via the `[property:value]` syntax.

**Step 2: Visual smoke-check at desktop width.**

Open `/admin/dashboard` at desktop. Chips should look identical (font size = 10px, the clamp max). Container query unit has no visible effect at large widths because clamp's max kicks in.

**Step 3: Visual smoke-check at mobile width.**

Resize to 390px viewport. Chip text should scale smaller — proving `cqi` is resolving correctly.

(At this point the unit code is hidden on mobile and chip backgrounds encode units. Day cells are still wide-ish because we haven't reclaimed padding yet — that's Task 12.)

**Step 4: Commit.**

```bash
git add src/components/dashboard/DashboardCalendar.tsx
git commit -m "feat(dashboard): add inline-size container to calendar grid for cqi units"
```

---

## Group C — Page split into Mobile/Desktop dashboards

Now both shared components (`DashboardCalendar` with `headerVariant`, unified chip) are landed. The page split composes them.

### Task 8: Extract current Dashboard body into `DesktopDashboard.tsx`

**Files:**

- Create: `src/pages/DesktopDashboard.tsx`
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Create the new file with the current Dashboard body.**

Copy the entire contents of `src/pages/Dashboard.tsx` into `src/pages/DesktopDashboard.tsx`. Then:

- Rename the exported function from `Dashboard` to `DesktopDashboard`.
- Change its signature to accept `bookings` and `isLoading` as props (instead of calling `useBookings()` internally). Replace the `useBookings()` call with destructured props.
- Update the upcoming-checkins/checkouts memos to depend on `bookings` from props.

```tsx
interface DesktopDashboardProps {
  bookings: Booking[] | undefined;
  isLoading: boolean;
}

export function DesktopDashboard({ bookings, isLoading }: DesktopDashboardProps) {
  // ...existing logic, replacing useBookings() with props.bookings/props.isLoading
}
```

**Step 2: Verify it type-checks.**

```bash
npm run type-check
```

Expected: PASS (the new file imports cleanly; `Dashboard.tsx` still works because we haven't touched it yet — but it now has a duplicate-name conflict if you exported both, so rename happened in step 1).

**Step 3: Commit.**

```bash
git add src/pages/DesktopDashboard.tsx
git commit -m "refactor(dashboard): extract current Dashboard body into DesktopDashboard"
```

---

### Task 9: Convert `Dashboard.tsx` into a thin orchestrator

**Files:**

- Modify: `src/pages/Dashboard.tsx`

**Step 1: Replace contents with the branching orchestrator.**

```tsx
import { useBookings } from "@/stores/useBookingStore";

import { DesktopDashboard } from "./DesktopDashboard";
import { MobileDashboard } from "./MobileDashboard";

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

`MobileDashboard` doesn't exist yet — type-check will fail. That's expected; Task 10 creates it.

**Step 2: Verify the type-check fails on missing import.**

```bash
npm run type-check
```

Expected: FAIL with `Cannot find module './MobileDashboard'`.

(This step proves the failure mode is the one we expect.)

**Step 3: Do NOT commit yet** — wait for Task 10 to make this compile.

---

### Task 10: Create `MobileDashboard.tsx` with calendar + Tomorrow's Schedule

**Files:**

- Create: `src/pages/MobileDashboard.tsx`

**Step 1: Write the new file.**

```tsx
import { useMemo } from "react";

import { addDays, format } from "date-fns";

import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Booking } from "@/types";

interface MobileDashboardProps {
  bookings: Booking[] | undefined;
  isLoading: boolean;
}

export function MobileDashboard({ bookings, isLoading }: MobileDashboardProps) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const tomorrowKey = format(tomorrow, "yyyy-MM-dd");

  const upcomingCheckIns = useMemo(
    () =>
      bookings?.filter(
        (b) =>
          format(new Date(b.check_in), "yyyy-MM-dd") === tomorrowKey &&
          b.booking_status === "Confirmed"
      ) ?? [],
    [bookings, tomorrowKey]
  );

  const upcomingCheckOuts = useMemo(
    () =>
      bookings?.filter(
        (b) =>
          format(new Date(b.check_out), "yyyy-MM-dd") === tomorrowKey &&
          b.booking_status === "CheckedIn"
      ) ?? [],
    [bookings, tomorrowKey]
  );

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Compact page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* Calendar (stacked header variant) */}
      <DashboardCalendar
        bookings={bookings}
        isLoading={isLoading}
        headerVariant="stacked"
        className="[&_[data-slot=card-content]]:p-0 [&>[data-slot=card]]:p-1"
      />

      {/* Tomorrow's Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tomorrow's Schedule</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Tabs defaultValue="checkins" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="checkins">Check-ins ({upcomingCheckIns.length})</TabsTrigger>
              <TabsTrigger value="checkouts">Check-outs ({upcomingCheckOuts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="checkins" className="mt-2">
              {upcomingCheckIns.length === 0 ? (
                <p className="text-muted-foreground py-3 text-sm">No check-ins tomorrow</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingCheckIns.map((b) => (
                    <li
                      key={b.booking_id}
                      className="flex min-w-0 items-baseline gap-2 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{b.guest_name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        · {b.booking_units?.[0]?.unit?.unit_code ?? "—"} · {b.num_guests} guests · ₱
                        {b.total_amount.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="checkouts" className="mt-2">
              {upcomingCheckOuts.length === 0 ? (
                <p className="text-muted-foreground py-3 text-sm">No check-outs tomorrow</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingCheckOuts.map((b) => (
                    <li
                      key={b.booking_id}
                      className="flex min-w-0 items-baseline gap-2 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{b.guest_name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        · {b.booking_units?.[0]?.unit?.unit_code ?? "—"} · {b.num_guests} guests
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
```

The `className` passed to `DashboardCalendar` uses Tailwind's arbitrary-variant syntax to override CardContent and the Card's own padding via data-slot attributes. If the shadcn Card component doesn't expose `data-slot`, fall back to passing a more direct className override or wrapping in another div with negative margin.

**Step 2: Type-check.**

```bash
npm run type-check
```

Expected: PASS. The orchestrator from Task 9 now compiles because both branches exist.

**Step 3: Run all dashboard-related tests.**

```bash
npx vitest run src/components/dashboard src/pages
```

Expected: PASS.

**Step 4: Visual smoke-check.**

Open `/admin/dashboard`:

- At desktop width: renders `DesktopDashboard` (5 sections, unchanged from before plan).
- At mobile width (390px): renders `MobileDashboard` (calendar with stacked header + Tomorrow's Schedule only). No KPI cards, no Recent Bookings, no full table.

Calendar should show guest-name chips on mobile (verify with seeded bookings).

**Step 5: Commit.**

```bash
git add src/pages/Dashboard.tsx src/pages/MobileDashboard.tsx
git commit -m "feat(dashboard): mobile/desktop branch with MobileDashboard"
```

---

### Task 11: Apply mobile padding reclamation overrides

The 112px padding waterfall fix. Verify Task 10's chained `className` succeeded; if data-slot selectors didn't catch, fall back to direct overrides.

**Files:**

- Modify: `src/components/dashboard/DashboardCalendar.tsx` (apply `headerVariant`-aware Card classes)
- Modify: `src/routes/admin.tsx` or the admin layout file (admin container padding override)

**Step 1: Inspect the admin layout to find the container padding.**

```bash
grep -rn "container mx-auto" src/routes/admin* src/components/admin* 2>/dev/null | head -10
```

Identify the file owning the `<div class="container mx-auto max-w-none p-4 pb-20 md:pb-6 lg:p-6">`. Most likely `src/routes/admin.tsx` or a layout component imported by it.

**Step 2: Modify the admin container padding for mobile.**

Change `p-4 pb-20 md:pb-6 lg:p-6` → `px-2 pt-2 pb-20 md:p-4 md:pb-6 lg:p-6`. This reduces left/right and top padding on mobile only; medium and large unchanged.

**Step 3: Inside `DashboardCalendar`, apply mobile-only Card padding overrides when `headerVariant === "stacked"`.**

Replace:

```tsx
<Card className={cn("w-full", className)}>
```

with:

```tsx
<Card
  className={cn(
    "w-full",
    headerVariant === "stacked" && "p-1 [&_[data-slot=card-content]]:p-0",
    className
  )}
>
```

And reduce the `CardContent` padding when stacked:

```tsx
<CardContent className={cn("pt-0", headerVariant === "stacked" ? "p-0" : "p-4")}>
```

**Step 4: Override the react-day-picker root padding.**

The Calendar component renders an internal `<div class="rdp-root ... p-3">`. Pass a `className` override to the `Calendar` component:

```tsx
<Calendar
  // existing props...
  className={cn("w-full rounded-md border", headerVariant === "stacked" && "p-0")}
  // ...
/>
```

**Step 5: Measure the result.**

Visit `/admin/dashboard` at 390px. Use DevTools or Playwright `browser_evaluate` to confirm:

```js
document.querySelector('[role="grid"]').getBoundingClientRect().width;
```

Expected: ≥ 340px (up from 250px). Cell width ≥ 48px (up from 35.7px).

**Step 6: Visual check.**

Chips should now have more room. Guest-name truncation should be less aggressive.

**Step 7: Run tests.**

```bash
npx vitest run src/components/dashboard src/pages
```

Expected: PASS.

**Step 8: Commit.**

```bash
git add src/components/dashboard/DashboardCalendar.tsx src/routes/admin.tsx
git commit -m "feat(dashboard): reclaim 112px of mobile calendar padding"
```

(Adjust the file in `git add` if the admin container is in a different file.)

---

## Group D — Tomorrow's Schedule density

Already implemented in Task 10. No separate task needed — verify it renders as a single-line `divide-y` list when bookings exist. If you'd prefer to keep Task 10 minimal and add density in a separate commit, split the list rendering into Task 12 here.

---

## Group E — Page header on mobile

Already implemented in Task 10 (`text-xl` h1, no subtitle). No separate task needed.

---

## Group F — No-horizontal-scroll Playwright invariant

### Task 12: Write the failing Playwright invariant test

**Files:**

- Create: `src/__tests__/e2e/dashboard-mobile-overflow.spec.ts`

**Step 1: Write the test.**

```ts
import { expect, test } from "@playwright/test";

const WIDTHS = [320, 375, 390, 414];

test.describe("Admin dashboard — no horizontal scroll on mobile", () => {
  for (const width of WIDTHS) {
    test(`no horizontal scroll at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });

      // Sign in as admin (use existing test login helper if available;
      // otherwise inline the form-fill flow against /login).
      await page.goto("/login");
      await page.getByLabel(/email/i).fill(process.env.TEST_ADMIN_EMAIL!);
      await page.getByLabel(/password/i).fill(process.env.TEST_ADMIN_PASSWORD!);
      await page.getByRole("button", { name: /sign in/i }).click();

      await page.goto("/admin/dashboard");
      await page.waitForLoadState("networkidle");

      // Document-level: no horizontal scroll
      const docMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(docMetrics.scrollWidth).toBe(docMetrics.clientWidth);

      // Card-level: each Card's content must not exceed its container
      const cardOverflows = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="rounded-xl"][class*="border"]'))
          .map((el, i) => ({
            i,
            scrollWidth: (el as HTMLElement).scrollWidth,
            clientWidth: (el as HTMLElement).clientWidth,
            overflows: (el as HTMLElement).scrollWidth > (el as HTMLElement).clientWidth,
          }))
          .filter((m) => m.overflows)
      );
      expect(cardOverflows, "no card should have clipped overflow").toEqual([]);
    });
  }
});
```

**Step 2: Run it to confirm failure.**

```bash
npm run test:e2e -- dashboard-mobile-overflow
```

Expected: PASS or FAIL depending on whether prior tasks already eliminated overflow. If it fails, the failures are useful — they tell us which Card still has clipped overflow.

**Step 3: If it fails:** the failing widths and Card indices are the targets. Iterate the relevant component's classNames until the test passes. The most likely culprits:

- A flex parent missing `min-w-0` on a text child
- A `min-w-[140px]` or fixed-width style that ignores small viewports
- A Tabs/TabsList that overflows at very narrow widths

**Step 4: Once green, commit.**

```bash
git add src/__tests__/e2e/dashboard-mobile-overflow.spec.ts
git commit -m "test(dashboard): no-horizontal-scroll invariant at 320-414px"
```

---

## Group G — Verification

### Task 13: Manual UI verification with the browse skill

**Step 1:** Open `/admin/dashboard` at 320, 390, and 768px widths using Playwright MCP.

**Step 2:** Confirm visually:

- 320px: page renders, no horizontal scroll, chips readable
- 390px: matches the design's mocked layout (calendar + Tomorrow only, stacked header, chip names visible)
- 768px (md breakpoint boundary): smoothly transitions to desktop layout
- 1024px+: desktop layout identical to pre-plan state

**Step 3:** Confirm interactions:

- Today button resets to current month
- Prev/Next chevrons advance and announce via screen reader (Voiceover or Chrome's "Inspect → Accessibility" tab)
- Calendar day cells respond to tap with the booking tooltip

**Step 4:** No commit needed — this is verification only. If issues found, file follow-up tasks.

---

### Task 14: Run full verify suite

**Step 1:** Run the umbrella check.

```bash
npm run verify
```

Expected: PASS (type-check, lint, all tests).

**Step 2:** Run E2E specifically.

```bash
npm run test:e2e
```

Expected: PASS, including the new overflow invariant.

**Step 3:** If everything passes, the plan is complete. Open PR via:

```bash
gh pr create --title "feat(dashboard): mobile overhaul" \
  --body "$(cat <<'EOF'
## Summary
- Mobile dashboard simplified to Calendar + Tomorrow's Schedule
- Calendar header stacks vertically on mobile (fixes existing 76px clipped overflow)
- 112px of padding chrome reclaimed on mobile via Card/CardContent/rdp-root overrides
- BookingIndicators chip unified into one render path; unit code hidden on mobile (color encodes unit)
- New Playwright invariant guards against horizontal scroll at 320/375/390/414px
- Desktop layout unchanged

Design doc: docs/plans/2026-05-18-admin-dashboard-mobile-overhaul-design.md

## Test plan
- [ ] /admin/dashboard at 320, 375, 390, 414px — no horizontal scroll, chips visible
- [ ] Calendar prev/next/today navigation works on mobile
- [ ] Desktop dashboard at 1280px+ visually identical to before
- [ ] npm run verify passes
- [ ] New E2E invariant test passes in CI
EOF
)"
```

**Step 4:** Commit any final touch-ups; merge after review.

---

## Out-of-scope (intentional)

- Desktop layout changes
- Touch gestures (swipe-between-months, pull-to-refresh)
- Mobile-specific KPI integration
- Push-notification surfacing on the dashboard
- Colorblind/shape-encoding mitigations for the unit-code drop

## Risks and mitigations

| Risk                                                                                                            | Mitigation                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clamp(7px, 2cqi, 10px)` doesn't resolve because Tailwind v4's container-type setup is wrong                    | Task 7 isolates the change; Task 11 verifies grid width empirically. If `cqi` doesn't work, fall back to `clamp(7px, 1.8vw, 10px)` (one-line change). |
| `[&_[data-slot=card-content]]:p-0` arbitrary-variant doesn't apply because shadcn Card doesn't expose data-slot | Task 11 has a fallback note: use direct `className` overrides on the Card/CardContent props instead of arbitrary variants.                            |
| Existing uncommitted changes to `BookingIndicators.tsx` / `unit-calendar-config.ts` conflict with the plan      | Resolve before starting (integrate, stash, or revert). Plan assumes these files are at HEAD's committed state.                                        |
| Calendar feels too dense at h-20 with 3 chips                                                                   | Task 11 includes a visual check; bump to h-24 if cramped. Single-line change.                                                                         |
| Playwright invariant test fails on widths we hadn't anticipated                                                 | Task 12's failure output tells us which Card index overflows; iterate ClassNames until green.                                                         |
