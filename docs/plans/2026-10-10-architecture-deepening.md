# Architecture deepening (2026-10-10)

Source: architecture review run 2026-10-10 (`/improve-codebase-architecture`), scoped by git hot spots. Eight candidates; vocabulary from the codebase-design skill (module, interface, seam, depth, locality, leverage).

## Candidates

1. **Entity persistence, one write path per entity** (Strong): edit page and dialog both save through one module that owns input shape → row columns, Manila dates and side effects. Start with Payment.
2. **Admin request pipeline** (Strong): authenticate once, resolve role once (today 3× each on verify-payment), role declared per route, one error envelope.
3. **One pricing module** (Strong): pure core over a resolved rate card + seasons; replaces 4 TS engines whose fallbacks disagree.
4. **Invalidate by domain fact** (Strong): one table → cached-data map; mutations report what changed.
5. **Payment verification module** (Worth exploring): owns Pending → Verified transitions; design inside deferred item 4 of the guardrails plan.
6. **Stores shrink to UI state** (Worth exploring): follows 1.
7. **One unit-occupancy definition** (Speculative): wait for guardrails deferred item 4.
8. **Server-only modules out of `src/lib`** (Worth exploring): follows 2.

## Tasks

### Phase 0: bugs found in passing (one `fix:` commit each)

- [x] (`8d7a838`) Offline multi-unit booking creates are queued then dropped on reconnect: delete offline queuing, fail loudly when offline
- [x] `BookingEdit` sends `payment_amount` (not a bookings column) and `toISOString()` dates. Fixed via `toBookingUpdate` (row-type checked, dates via `formDateToUTC` at check-in/out times like `BookingForm`); the payment amount field is removed (payments have their own page)
- [ ] New: `MultiUnitBookingForm.tsx:282,296` also sends `toISOString()` of the picked local midnight; SQL compares `check_in::date` in UTC, so Manila picks land a day early unless the server normalizes. Verify, then align with `formDateToUTC`
- [ ] Payment and expense mutations do not invalidate account balances
- [ ] RLS lets staff write `bookings.payment_status`; restrict to manager+ with a DB test (prod `db push` by the user)
- [ ] `bookings/multi-unit` accepts the client total when the server total ≤ 0: return 422
- [ ] `invalidateDashboard()` targets `["dashboard-stats"]`, which nothing reads

### Phase 1: Candidate 1 (Payment first)

- [ ] Grill the design (constraints, seam, what tests survive)
- [ ] Payment persistence module + local-DB save tests
- [ ] Then 4 → 6 on the client; 3 → 2 → 8 on the server

## Decisions & Deferrals

Accepted 2026-10-10 (recommended defaults):

- **Fix the six passing bugs first, as standalone `fix:` commits.** Why: live data loss and authorization gaps outrank refactors. Revisit: n/a.
- **Delete offline queuing instead of finishing it.** Why: a small family resort does not need offline booking creation; a half-built queue silently loses bookings. Revisit: if staff report needing to book without signal.
- **RLS: only manager+ may change `bookings.payment_status`.** Why: verify-payment requires manager+, but RLS let staff bypass it. Revisit: if staff need to record payments directly.
- **`bookings/multi-unit` returns 422 when the server total ≤ 0.** Why: the server must not trust a client-supplied price. Revisit: n/a.
- **Edit page and dialog saves converge on one path per entity, keeping store side effects (guest upsert, payment-status recompute).** Why: two save paths with separate mappings caused 4 column-name bugs. Revisit: n/a.
- **Order: client 1 → 4 → 6; server 3 → 2 → 8; candidates 5 and 7 inside guardrails deferred item 4.** Why: 1 is the hottest code with live bugs; 5 and 7 touch SQL that item 4 rewrites. Revisit: if item 4 is scheduled first.
