# Dashboard overhaul: direction

Outcome of a grilling session on 2026-10-21. Input for a prototype session, then `/to-spec` → `/to-tickets` → `/implement`.

## Job of the page

A daily look on the phone: who checks in, who checks out, which cabin, and what money is still due. Plus two numbers for the month shown in the calendar.

## Decisions & Deferrals

- Calendar grid and cabin lanes may change only if the phone view stays as good as now (whole month visible, bookings and cabins easy to read).
- Check-ins and check-outs are found by check-in / check-out day only (Manila day), not by `booking_status`. Cancelled bookings are hidden. Why: the family does not reliably mark bookings as Checked-in.
- Time window: Today and Tomorrow first, then "Later this week" collapsed. Superseded by the variant C layout line below (no sheet, no separate list); the hover-card and links parts still hold.
- One content model for phone and desktop. Desktop is a side-by-side layout. The "All Bookings" table, "Recent Bookings", and the four stat cards are removed.
- Numbers: occupancy and confirmed-booking count (by check-in day) for the month the calendar shows. Both exclude pending bookings. The open question on the count is decided by the confirmed-booking count line below.
- Each check-in / check-out row shows the booking payment status and the outstanding balance, not the total price.
- No cabin strip for tonight. Why: the calendar already highlights it.
- Day detail: on touch, a tap opens a bottom sheet (the hover card must not open from focus on touch). On desktop, the hover card stays as a preview, and a click shows the day in the right column (today by default). Every booking in the day detail links to its booking detail page (missing on desktop now). Superseded by the variant C layout line below (no sheet, no separate list); the hover-card and links parts still hold.
- A line "N bookings waiting for verification →" links to `/admin/bookings/queue`. Hidden when N = 0.
- No quick actions on the dashboard.
- Layout: variant C on phone and desktop (2026-10-21, after the prototype). Calendar with the day panel under it on the phone, beside it on desktop; today open by default; a tap or click changes the day; previous/next day buttons on the panel. No bottom sheet and no separate Today/Tomorrow list. Why: shortest phone page, and it uses the desktop width best.
- Confirmed-booking count stays only as a small line under the month name next to occupancy ("20% occupancy · 8 confirmed"), not as its own tile. Why: it does not help a daily task; occupancy already shows how busy the month is.
- Booking-status pill in dashboard rows: shown only for pending bookings, labelled "Waiting for verification"; the payment-status pill stays as it is (2026-10-21). Why: both pills said "Pending" in one row (not verified vs. unpaid). Screen copy only; GLOSSARY terms do not change.
- Fix during implementation: dates use the device-local day (`format(new Date(...))`), must use the Manila day (ADR 0002). Check-in/check-out logic is duplicated in `MobileDashboard` and `DesktopDashboard`: one shared component.

## Prototype

- [x] Throwaway route `/admin/dashboard-proto`, deleted after a variant is picked.
- [x] In-memory fixture bookings with dates relative to today (unpaid, partial, one pending, one cancelled, a full weekend, multi-cabin booking). No database writes. (`supabase/seed.sql` has no bookings.)
- [x] Variant A, calendar first: numbers row → calendar → Today / Tomorrow / Later this week.
- [x] Variant B, agenda first: Today / Tomorrow → calendar → numbers.
- [x] Variant C, agenda inside the calendar: calendar with the day panel under it, today open by default; a tap changes the day.
- [x] Variant switcher; check each at phone width and desktop width.
- [x] Pick a variant and decide on the booking count.

Spec: issue #149 (`ready-for-agent`), published 2026-10-21. Next: `/to-tickets` from #149.

Prototype location: branch `proto/dashboard-overhaul`, commit `6865b436` (local only, not pushed; worktree removed). To run it again: `git worktree add ../okaeri-proto-dashboard proto/dashboard-overhaul`, copy `.env.local`, `.dev.vars` and `node_modules`, then `npx vite --port 5180` plus `npm run dev:wrangler` (for login), and open `/admin/dashboard-proto?variant=A|B|C`. Screenshots checked on 2026-10-21 at 390px and 1280px. Variant B on desktop puts the day column on the left (agenda first), not on the right.
