# Dashboard

One page for phone and desktop (issue #149): the month calendar with a day panel, under it below the `expanded` breakpoint and beside it at or above it. The rules (day movements, occupancy, outstanding balance, pending count) live in `src/lib/dashboard.ts`, with no React.

- `Dashboard.tsx`: the page. Holds the selected Manila day (today first) and the calendar month, and shows the queue line when bookings wait for verification.
- `DashboardCalendar.tsx`: the month grid with cabin lanes and Blocked chips. A tap or click selects a day. Day cells read their data from a context, so the grid never remounts on a change.
- `DayPanel.tsx`: check-ins, check-outs and stays of the selected day, its blocks, and previous/next day buttons.
- `BookingRow.tsx`: one booking, linked to its detail page, with its outstanding balance and payment status.
- `BookingTooltip.tsx`: the hover card on a day. A mouse preview only: focus (a tap) does not open it.
- `BookingIndicators.tsx`, `unit-calendar-config.ts`: the calendar chips and the lane colours.
