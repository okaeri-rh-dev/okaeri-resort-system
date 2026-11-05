# Dashboard

One page for phone and desktop (issue #149): the full-width month calendar, and a day pane that opens over it when you pick a day. It is a bottom sheet below the `expanded` breakpoint and a side sheet at or above it, and the open day is in the URL (`?day=`). The rules (day movements, occupancy, outstanding balance, pending count) live in `src/lib/dashboard.ts`, with no React.

- `Dashboard.tsx`: the page. Reads the open Manila day from `?day=` (none on load), holds the calendar month, and shows the queue line when bookings wait for verification.
- `DashboardCalendar.tsx`: the month grid with cabin lanes and Blocked chips. A tap or click selects a day. Day cells read their data from a context, so the grid never remounts on a change.
- `DayPane.tsx`: check-ins, check-outs and stays of the selected day, its blocks, and previous/next day buttons.
- `BookingRow.tsx`: one booking, linked to its detail page, with its outstanding balance and payment status.
- `BookingTooltip.tsx`: the hover card on a day. A mouse preview only: focus (a tap) does not open it.
- `BookingIndicators.tsx`, `unit-calendar-config.ts`: the calendar chips and the lane colours.
