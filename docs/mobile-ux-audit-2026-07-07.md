# Mobile UI/UX Audit — 2026-07-07

Scope: full app (public guest portal + admin) at 375×667, combining a live Playwright walkthrough (landing, guest booking wizard, check-status, login, dashboard, nav drawer, bookings, units) with a 10-area code audit (76 agents; every high/medium finding adversarially verified against source — 92 confirmed, 1 rejected).

**Not verified:** physical-device behavior (notch/safe-area findings are static analysis), tablet viewport, tables under real data volume (test DB nearly empty), E2E suite.

## Root-cause clusters

Nearly all 92 findings trace back to seven causes. Fixing at the root fixes dozens of call sites at once.

### 1. The shared primitives set the mobile floor too low

`ui/input.tsx` renders 14px text (iOS auto-zooms on every field focus, app-wide); `button.variants.ts` floors at h-8/h-9 (32–36px vs the 44px guideline and the repo's own 40px login standard); `checkbox.tsx` is 16px; the dialog/sheet close X is a 16px target; dropdown/select items ~32px; tabs ~32px; `DialogContent` has no max-height so tall dialogs clip off-screen both ends. Root cause of the root cause: `src/styles/mobile-enterprise.css` **already defines the correct 44px/16px standards but is wired to nothing** — the design system was written, never applied. ~8 small edits in `src/components/ui/` fix the majority of the touch-target and zoom findings everywhere.

### 2. The installed-PWA experience is broken at the manifest/viewport level

Every icon referenced by `manifest.json` and `index.html` is missing from `public/` — Chrome/Android will never fire the install prompt, so the InstallBanner (the admin-PWA scoping work) is dead on Android. `black-translucent` status bar + no `viewport-fit=cover` + zero `env(safe-area-inset-top)` usage puts the sticky admin header under the iPhone notch in standalone mode; `safe-area-bottom` is used in DocumentGenerator but defined nowhere; toasts sit under the home indicator.

### 3. Calendar information is hover-only — unreachable on touch

Booking details on the dashboard/availability calendars live in a Radix HoverCard (never opens on touch); chips render guest names at ~7px with the unit code hidden below `sm`. Staff on phones can see _that_ a day has bookings but not _what_ they are. The availability page also uses the desktop row header, which overflows 375px.

### 4. Mobile feature-parity gaps in admin tables

Payments mobile view has **no Verify / View Details / Delete actions, no filters, no pagination** (verification is a core owner task); Guests mobile can't delete or inline-edit; Units has no mobile card view at all (desktop table + h-scroll + 16px checkboxes); bookings mobile renders ALL rows unpaginated (desktop pages at 10); audit-log table needs 2–3 screens of horizontal scroll.

### 5. Guest-flow correctness bugs (live-confirmed)

Terms/Privacy links on the review step 404 **and wipe all 5 steps of entered data**; confirmation page tap-to-call dials a fake US number and the landing WhatsApp number is masked/non-tappable (guest's only follow-up channel at a no-front-desk resort); payment-proof requires a separate manual Upload tap after picking the file (validation error despite visible attachment); the swipe-gesture hook listens on `document` with no vertical guard, so page scrolls can flip calendar months. Also live-observed: setState-during-render error in `MultiUnitGuestBookingForm`, and the landing availability-failure state is a blank page with no retry button.

### 6. Centered dialogs used for phone-primary forms

New Booking (multi-step), Record Payment, and Add Expense run in centered 90vh dialogs: the iOS keyboard covers the lower half, nested scroll fights page scroll, and 90vh miscomputes vs the URL bar. Bottom sheet/drawer (or full-screen route, as `new-multi` already does) is the right mobile presentation.

### 7. Dead code that misleads mobile work

The mobile-optimized modular `BookingForm/` directory is shadowed by the legacy `BookingForm.tsx` monolith (edits there change nothing); `ResponsiveTableWrapper` is used by zero features; `mobile-enterprise.css` ships 500+ unused lines. Also live-observed: the mobile header Search and bell buttons have no onClick — visible dead controls; the nav Sheet triggers a Radix "DialogContent requires DialogTitle" a11y error; the drawer renders two overlapping close buttons.

## Recommended sequence

1. **Primitive floor pass** (one PR, ~8 files in `src/components/ui/`): `text-base md:text-sm` on Input/Textarea; mobile-first button heights (`h-11 md:h-9` etc.); 44px dialog/sheet close; `max-h-[calc(100dvh-2rem)] overflow-y-auto` on DialogContent; taller dropdown/select/tab items; checkbox hit-area; `inputMode={allowDecimals ? "decimal" : "numeric"}` in NumberInput; sonner mobile offset. Then delete/fold `mobile-enterprise.css`.
2. **PWA install + safe-area pass**: real icons in `public/`, `viewport-fit=cover`, `pt-safe`/`pb-safe` utilities applied to header/bottom bars, fix phantom `safe-area-bottom`.
3. **Guest-flow bug pass**: terms links (open in sheet/new tab), real contact numbers, auto-upload payment proof, scope + axis-guard the swipe hook, fix setState-in-render, landing error state with Retry.
4. **Calendar touch pass**: tap-to-open bottom sheet for day details (keep HoverCard on desktop), legible chips, stacked header on availability, Today button on mobile header.
5. **Admin parity pass**: payments mobile actions/filters/pagination, guests delete/edit on mobile, units mobile cards (GuestsTable pattern exists), bookings mobile pagination via `table.getRowModel().rows`.
6. **Dialog→drawer pass** for New Booking / Record Payment / Add Expense.
7. **Dead-code resolution**: pick canonical BookingForm, delete or adopt ResponsiveTableWrapper, wire or remove header Search/bell.

## Decisions & Deferrals

- **Implemented 2026-07-07 (decisions 1/2/3/7):** primitive floor pass — mobile floors done via `max-md:min-h-*` rather than the `h-11 md:h-9` originally sketched, because `md:` overrides inside cva variants silently defeat call-site `h-*` overrides at md+ (twMerge doesn't cancel across modifiers; verified against compiled CSS). PWA icons generated from the brand logo (incl. maskable + real favicon.ico — the old .ico was a 62-byte text placeholder); `viewport-fit=cover` added; status bar → `default`; `mobile-enterprise.css` deleted (`.safe-area-bottom` + `prefers-reduced-motion` moved to index.css); MainLayout: Search removed, bell → booking queue, single 44px drawer close, SheetTitle a11y fix.
- **Known trade-off:** DialogContent is now scrollable (`max-h` + `overflow-y-auto`); its absolute close button scrolls with content in over-tall dialogs. Pre-existing behavior for the 9+ dialogs that already passed their own `max-h/overflow`; restructuring the primitive would break those call sites. Revisit when dialogs move to bottom sheets (step 6).
- **Still open:** decisions 4/5/6 below; steps 3–7 of the recommended sequence.

## Decisions Needed

1. **Primitive-level fixes vs per-page fixes** — Recommended: primitive-level (steps 1 above); per-page would be hundreds of edits.
2. **PWA icon artwork** — real assets needed for `public/` (192/512 android-chrome, 180 apple-touch, maskable variant). Recommended default: generate the set from the existing favicon/brand mark now; replace with designed icons later.
3. **Status-bar style** — keep `black-translucent` + safe-area padding (app-like, more work) or downgrade to `default` (one-line fix, slightly less immersive). Recommended: downgrade to `default` now, revisit with the safe-area pass.
4. **Real contact details** — need the actual resort phone/WhatsApp/email to replace placeholders (`+1 234 567 890`, masked WhatsApp). Blocked on you; recommended to centralize in one config module.
5. **Canonical BookingForm** — keep legacy monolith (port mobile classes into it) or switch to the modular directory (delete monolith, run full test suite). Recommended: port mobile classes into the monolith now (lower risk), schedule the swap separately.
6. **Mobile dashboard composition** — calendar-first (current) vs adding a KPI strip + today's check-ins above it. Recommended: add a compact KPI/today strip above the calendar.
7. **Dead header controls** — wire Search (global search sheet) and bell (pending-bookings badge) or remove until built. Recommended: remove Search, wire the bell to the booking queue.

---

## Full verified findings (92)

### High — broken or unusable on a phone

**H1. All PWA icons referenced by manifest.json and index.html are missing from public/ — Android install prompt can never fire**  
`public/manifest.json:26` · effort: small

- Impact: Chrome on Android requires a resolvable 192x192+ manifest icon before it fires beforeinstallprompt — so the staff's InstallBanner 'Install' path is dead on Android and the admin PWA cannot be installed with a proper icon. On iOS, the 404ing apple-touch-icon means 'Add to Home Screen' falls back to a page-screenshot thumbnail. The manifest shortcut icons (32x32, also 404) are below Android's 96x96 minimum so long-press app shortcuts render without icons.
- Fix: Add real icon assets to public/: android-chrome-192x192.png, android-chrome-512x512.png (with a true maskable variant rather than 'any maskable' on the same file), apple-touch-icon.png (180x180), favicon-16/32.png, and a 96x96+ icon for the three manifest shortcuts. Remove the dead /vite.svg favicon link. Verify post-deploy with Chrome DevTools > Application > Manifest (no icon errors, installability check passes).

**H2. black-translucent status bar with zero top safe-area handling — sticky admin header renders under the iPhone status bar/notch in the installed PWA**  
`index.html:45` · effort: small

- Impact: When staff open the installed admin PWA on any notched iPhone (the primary usage mode per the PWA scoping decision), the web content extends under the status bar: the hamburger button, 'Okaeri' title, and Search/Bell buttons sit beneath the clock/notch and are partially untappable; the drawer header has the same problem. Every screen is affected because MainLayout wraps all /admin routes.
- Fix: Add `viewport-fit=cover` to the viewport meta, then give the mobile header `pt-[env(safe-area-inset-top)]` (and the Sheet drawer content top padding). Alternatively downgrade to `content="default"` status bar style if the blended look isn't required. Also add `pb-[env(safe-area-inset-bottom)]` to the drawer footer holding Sign Out so it clears the home indicator.

**H3. All guest form inputs use 14px font, triggering iOS Safari auto-zoom on focus**  
`src/components/ui/input.tsx:8` · effort: small

- Impact: On iOS Safari (the primary guest browser), focusing any text field with font-size < 16px zooms the viewport in; the guest must pinch-zoom back out after every field on the Contact step and the check-status form. Makes the whole booking flow feel broken and janky.
- Fix: Change the base input/textarea typography to `text-base sm:text-sm` (16px on mobile, 14px desktop) — the same pattern ResponsiveDatePicker's trigger button already uses (`text-base ... sm:text-sm`). One-line change in input.tsx cva base and textarea.tsx.

**H4. Terms/Privacy links on the final review step point to non-existent routes and wipe the entire 5-step form**  
`src/components/guest-booking/BookingReviewStep.tsx:197` · effort: small

- Impact: A guest on step 5 (Review) who taps the terms link before checking the required 'I accept' box gets a 404 page AND loses all five steps of entered data (dates, cabins, contact info, uploaded payment proof) — they must restart the entire booking on their phone.
- Fix: Fix the hrefs to /terms-and-conditions and /privacy-policy, and add target="\_blank" rel="noopener" (or render them in an in-app Sheet/Dialog) so the in-progress form state is never destroyed.

**H5. Calendar booking details are hover-only (Radix HoverCard) — inaccessible on touch**  
`src/components/dashboard/BookingTooltip.tsx:50` · effort: medium

- Impact: Radix HoverCard does not open on touch devices by design. On a phone, tapping a calendar day is a no-op: the guest name, unit, status, amount, and date-range details shown in the hover card are completely unreachable. Since MobileDashboard's calendar is the primary dashboard surface, staff on phones can see only tiny colored chips with no way to inspect a day's bookings.
- Fix: On mobile (useIsMobile / pointer:coarse), replace the HoverCard with a tap-driven surface: give DayButton an onClick that opens a bottom-sheet Drawer (or Radix Popover/Dialog) rendering the same BookingTooltipItem list. Keep HoverCard for desktop.

**H6. Verify Payment, View Details, and Delete/Remove actions missing from mobile payments view**  
`src/components/payments/PaymentsTable.tsx:463` · effort: small

- Impact: Staff running the admin PWA from a phone (viewport < 1024px per useResponsiveView) cannot verify a payment, open the payment detail page, or delete/remove a payment from the payments list at all — the actions simply do not exist on mobile. Verification is a core owner task on this list.
- Fix: Add the same permission-gated actions to the mobile card, e.g. an ActionMenu (kebab) in the card header or full-width buttons in the footer, reusing the `actions` array already built for the desktop column.

**H7. Delete Unit fires immediately with no confirmation, from a 32px kebab menu**  
`src/components/units/UnitsTable/hooks/useUnitsTable.ts:96` · effort: small

- Impact: On a phone, one fat-finger mis-tap in a cramped dropdown permanently deletes a cabin with zero confirmation. GuestsTable already wraps delete in an AlertDialog; units has nothing.
- Fix: Add the same AlertDialog confirmation pattern used in GuestsTable.tsx (lines 771-787) before calling deleteUnitMutation, e.g. a unitToDelete state + AlertDialog in UnitsTable/index.tsx.

**H8. Booking chips render guest names at ~7px and hide the unit code at 375px**  
`src/components/dashboard/BookingIndicators.tsx:79` · effort: medium

- Impact: On a phone, each day cell's booking chips show guest names at 7px — effectively illegible — and the cabin code is hidden entirely, so which cabin a chip represents is conveyed by background color alone. Combined with the hover-only detail card (previous finding), staff on phones can see THAT a day has bookings but not reliably who or which cabin.
- Fix: Below sm, stop rendering 7px text: show per-unit colored dots or a count badge (BookingCountBadge already exists in this file) and move names/units into the tap-to-open day detail sheet. Alternatively raise the floor to a legible minimum (~10-11px) and show unit code instead of guest name on mobile.

**H9. Admin availability page uses the desktop 'row' calendar header — overflows 375px with 32px nav buttons, despite a mobile header existing**  
`src/components/dashboard/DashboardCalendar.tsx:118` · effort: small

- Impact: At 375px the header's rigid controls (~300px) plus the title cannot fit inside the card (~340px content width), so the header overflows/clips — month navigation buttons can sit partially off-screen and the page gets horizontal scroll. The prev/next/Today targets that do remain visible are 32px, below the 44px minimum, on the screen staff use most from their phones.
- Fix: In AvailabilityPage (or inside DashboardCalendar), switch to headerVariant="stacked" below the sm breakpoint via useIsMobile, or make RowHeader responsive: flex-wrap, drop min-w-[140px] to min-w-0 on mobile, and upgrade nav buttons to h-11 w-11.

**H10. Default Input and Textarea render 14px text, triggering iOS Safari auto-zoom on every field focus**  
`src/components/ui/input.tsx:8` · effort: small

- Impact: On iOS Safari (guest booking portal and admin app alike), tapping ANY default text field zooms the whole page in because font-size is 14px (< 16px threshold). The user must pinch-zoom back out after every field — on a multi-field booking form this happens repeatedly. This is the floor for every form in the app.
- Fix: Change the base/default variant to 16px on mobile: "text-base md:text-sm" (the pattern current shadcn/ui ships) on both inputVariants and Textarea. Keeps desktop density while eliminating zoom on phones.

**H11. DialogContent has no max-height or internal scroll; tall dialogs overflow the 375px viewport with unreachable content**  
`src/components/ui/dialog.tsx:40` · effort: small

- Impact: Because the dialog is position:fixed and vertically centered, content taller than the phone screen extends off BOTH top and bottom and cannot be scrolled to — buttons in DialogFooter become physically unreachable on a 375x667 phone, especially with the keyboard open. Roughly half the app's dialogs rely on the primitive default.
- Fix: Fix at the primitive: add "max-h-[calc(100dvh-2rem)] overflow-y-auto" (dvh handles the iOS URL-bar) to DialogContent's base classes so every existing dialog inherits safe behavior; call sites can still tighten with their own max-h.

**H12. Installed PWA has no safe-area handling: black-translucent status bar + missing viewport-fit=cover + zero safe-area-inset-top usage**  
`index.html:45` · effort: medium

- Impact: Owners run the admin app as an installed PWA. With black-translucent + standalone, page content slides UNDER the iPhone status bar/notch (top ~47-59px overlaps the app header), and the fixed bottom action bar in DocumentGenerator sits under the home indicator because its safe-area class doesn't exist. Without viewport-fit=cover, env(safe-area-inset-\*) values used by pb-safe are also unreliable.
- Fix: Add viewport-fit=cover to the viewport meta; define shared utilities (pt-safe/pb-safe/px-safe using env(safe-area-inset-\*)) in index.css; apply pt-safe to the sticky app header and pb-safe to all fixed bottom bars; delete or implement the phantom safe-area-bottom class.

### Medium — significant friction

**M1. safe-area-bottom class is used but defined nowhere — fixed bottom action bar sits under the home indicator**  
`src/components/documents/DocumentGenerator.tsx:154` · effort: small

- Impact: The mobile-only fixed bottom bar (md:hidden) in the document generator renders flush with the viewport bottom; in the installed PWA on gesture-nav phones its buttons overlap the iOS home indicator / Android gesture bar, making the primary actions easy to mis-tap or trigger an accidental app-switch swipe.
- Fix: Replace the phantom class with `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]` (or define `.safe-area-bottom { padding-bottom: env(safe-area-inset-bottom); }` in index.css). Delete or start actually using the orphaned `.mobile-safe-area` rule. Requires the viewport-fit=cover fix from the header finding for env() to return non-zero values.

**M2. No scroll restoration/reset: admin scroll container persists across route changes, so navigating lands mid-page**  
`src/layouts/MainLayout.tsx:423` · effort: small

- Impact: A staff member scrolled deep into the bookings list who taps 'Guests' or 'Dashboard' in the nav drawer arrives on the new page still scrolled to the old offset — on a phone this looks like a broken/blank page until they scroll up. Affects every admin route transition.
- Fix: Reset the container on navigation: give the scroll div a ref and `useEffect(() => { ref.current?.scrollTo(0,0) }, [location.pathname])` in MainLayout, or move scrolling to the window and enable TanStack Router's `scrollRestoration: true` for proper back/forward position restore.

**M3. Mobile header Search and Notifications buttons are dead — no onClick handlers**  
`src/layouts/MainLayout.tsx:401` · effort: medium

- Impact: Staff tap Search or the bell on their phone and nothing happens at all — two of the three always-visible header affordances in the mobile-primary admin app are non-functional decoys, eroding trust and wasting the most reachable header real estate.
- Fix: Either wire them (Search -> a global search sheet; Bell -> pending-bookings queue with a count badge, which fits the family-resort workflow) or remove them until implemented. Don't ship visible dead controls in the primary nav.

**M4. Mobile nav drawer renders two overlapping close buttons; the built-in Sheet close is a ~16px touch target**  
`src/components/ui/sheet.tsx:62` · effort: small

- Impact: The nav drawer shows two X buttons stacked/adjacent in the top-right; the topmost absolute-positioned one is a 16px target (well under 44px) that intercepts taps aimed at the 36px custom button. Every other Sheet in the app inherits the same sub-44px close. Users can still swipe/tap-outside to dismiss, so it's friction rather than a blocker.
- Fix: In sheet.tsx, make the built-in close a proper target (e.g. `p-3 -m-1` or size-11 flex items-center justify-center) and add a `hideClose` prop; in MainLayout pass hideClose and keep only the 44px custom button (bump h-9 w-9 to h-11 w-11).

**M5. Booking reference on confirmation page overflows a 375px screen**  
`src/components/booking-confirmation/BookingReferenceDisplay.tsx:38` · effort: small

- Impact: The single most important piece of information after booking — the reference number the guest must quote for payment — is clipped or spills out of the card on a 375px phone.
- Fix: Use a mobile-first size: `text-2xl sm:text-4xl md:text-5xl` (or add `break-all`/`text-[clamp(...)]`). Keep the Copy button as the primary affordance.

**M6. Confirmation page tap-to-call/email use placeholder contact details (fake US number)**  
`src/routes/booking/confirmation/$bookingReference.tsx:192` · effort: small

- Impact: Guests on their phone tapping 'call us' dial a fake US number (+1 234 567 890) and email a placeholder address. For a Philippines family resort with no front desk, this dead-ends the guest's only follow-up channel right after they've paid a downpayment.
- Fix: Replace with the resort's real phone (tel:+63...), a wa.me/63... WhatsApp link, and the real email. Consider centralizing contact info in config so it can't drift.

**M7. Landing page tells guests to contact via WhatsApp but shows a masked, non-tappable number**  
`src/routes/index.tsx:140` · effort: small

- Impact: The homepage flow (documented in the file header: 'Guest contacts manager via WhatsApp or phone') is broken — a phone user checking availability has no tappable way to actually contact the resort, and the number shown is a placeholder they cannot use at all.
- Fix: Insert the real number and wrap it in <a href="https://wa.me/63917......."> so a single tap opens WhatsApp. Bump the notice from text-xs to text-sm on mobile since it's the primary CTA on this page.

**M8. Guest selects payment-proof photo but must tap a separate 'Upload' button; skipping it fails validation confusingly**  
`src/components/guest-booking/PaymentProofUpload.tsx:330` · effort: medium

- Impact: On a phone the guest picks their GCash screenshot, sees the filename with a green border, and reasonably taps Next — validation then blocks with 'Payment proof is required' even though a file is visibly attached. Extra tap + confusing error on the most drop-off-prone step.
- Fix: Auto-start the upload immediately after successful validation/compression (keep the progress bar), or at minimum disable Next while a selected-but-not-uploaded file exists with inline copy 'Tap Upload to attach your receipt'.

**M9. Remove-cabin button is 32x32px, below the 44px touch target**  
`src/components/guest-booking/UnitRequestCard.tsx:118` · effort: small

- Impact: Guests adjusting their cabin list on a phone struggle to hit the 32px X; mis-taps land on the card header instead, and there is no other way to remove a cabin.
- Fix: Drop the h-8 w-8 override (or use h-11 w-11 on mobile: `h-11 w-11 sm:h-8 sm:w-8`), keeping the X icon size as-is.

**M10. Landing calendar month navigation and Today buttons are 28-32px tall**  
`src/components/calendar/PublicAvailabilityCalendar.tsx:262` · effort: small

- Impact: Month navigation is the primary interaction on the guest-facing homepage calendar; 28-32px targets cause mis-taps (e.g. hitting the month title or legend). Swipe partially mitigates prev/next but not Today.
- Fix: Use default/lg sizes with min-h-11 on mobile for the chevrons and Today button (e.g. `h-11 sm:h-8`); width of Today is already full-width so only height needs fixing.

**M11. Wizard Back/Next/Submit buttons are 36px tall (below the project's own 40px bar)**  
`src/components/guest-booking/MultiUnitGuestBookingForm.tsx:569` · effort: small

- Impact: Every step advance and the final Submit in the guest's primary flow uses a 36px-tall target; combined with px-4 width the tap area is small for thumbs, especially the critical Submit Booking button.
- Fix: Use size="lg" plus a mobile bump (e.g. className="h-12 sm:h-10") on Back/Next/Submit, matching the fix already applied to the login button.

**M12. 4-step booking wizard rendered in a centered Dialog on mobile instead of full-screen page/drawer**  
`src/routes/admin/bookings.tsx:120` · effort: medium

- Impact: On a 375px phone the primary booking-creation flow runs inside a vertically-centered 90vh scrollable dialog. When the iOS keyboard opens on the Guest Information step, the centered dialog does not reposition — inputs in the lower half sit behind the keyboard, and users fight nested scrolling (dialog scroll + page). The Radix close X (top-right, small hit area) is also easy to fat-finger, discarding a partially completed 4-step form.
- Fix: On mobile, present the wizard as a dedicated route/full-screen view (like /admin/bookings/new-multi does for MultiUnitBookingForm) or a full-height Drawer/Sheet; keep the Dialog for >=sm only via a useIsMobile branch.

**M13. Card action menu (kebab) is a 32x32px target — sole gateway to Edit/Cancel/Delete on mobile**  
`src/components/tables/utils.tsx:400` · effort: small

- Impact: On the phone card view this 32px kebab is the ONLY way to reach Edit Booking, Cancel, and Delete. It sits 4px from the status badge and inside the card's tappable info zone area, so staff frequently fat-finger into the booking detail navigation instead of opening the menu.
- Fix: Bump the ActionMenu trigger to at least 44px on touch (e.g. `h-10 w-10` plus a negative margin to preserve visual density, or add `before:absolute before:-inset-2` hit-area expansion). Since ActionMenu is shared by all admin tables, one change fixes every card/table action menu.

**M14. Mobile card view renders ALL filtered bookings — pagination only exists in the desktop branch**  
`src/components/bookings/BookingsTable/index.tsx:62` · effort: medium

- Impact: As booking history grows (an operating resort accumulates hundreds of rows), a phone renders every booking as a full card in one list: multi-second render and janky scroll on low-end Android, large DOM, and no way to jump pages. Desktop caps at 10 rows/page; mobile gets everything. (The module CLAUDE.md claims 'Mobile cards use pagination (10 per page)' — that is not what the code does.)
- Fix: In the mobile branch, map over `table.getRowModel().rows` (already paginated at pageSize 10) instead of the raw `bookings` array, and render `TablePagination` (or a simpler 'Load more' button / infinite scroll) below the cards.

**M15. Search input uses 14px font — iOS Safari auto-zooms on focus**  
`src/components/tables/utils.tsx:153` · effort: small

- Impact: Every time staff tap the bookings search box on an iPhone, Safari zooms the whole page in (inputs under 16px trigger auto-zoom), and they must pinch back out to see results. This happens on the most-used control of the bookings list, on every search.
- Fix: Change the Input base to `text-base md:text-sm` (the pattern current shadcn/ui ships) so mobile gets 16px and desktop keeps the dense 14px look. Fixing it in ui/input.tsx cures all admin search/filter inputs at once.

**M16. Filter popovers close on every selection — filter sub-components are redefined inside render**  
`src/components/bookings/BookingsTable/components/BookingFilters.tsx:69` · effort: small

- Impact: On the phone, tapping Filters > Status > choosing 'Pending' snaps the popover shut instantly (setFilters re-renders the parent, remounting the popover closed). Setting status + payment + walk-in means re-opening a popover three separate times; typing in search while a popover is open also slams it closed. Feels broken on touch where re-opening costs several taps.
- Fix: Hoist StatusFilter/PaymentFilter/WalkInFilter/DateFilter out of the component (pass filters/setFilters as props), or inline the JSX directly instead of declaring nested component functions. Stable identity keeps the popover open across filter changes.

**M17. New Booking multi-step form opens in a centered 90vh dialog on phones instead of a full-screen page/sheet**  
`src/routes/admin/bookings.tsx:120` · effort: medium

- Impact: Creating a booking is a core phone workflow for staff. At 375px the multi-step form lives inside a centered modal with a nested scroll region: the on-screen keyboard covers the lower half of a vertically-centered 90vh box, focused fields sit under the keyboard, and scrolling fights between the dialog body and the page. The multi-cabin flow already gets a dedicated route (/admin/bookings/new-multi); single-cabin does not.
- Fix: On mobile, render BookingForm as a full-screen route (mirror new-multi with an /admin/bookings/new route) or use a full-height Drawer/Sheet; keep the dialog for >= md widths only (e.g. via useResponsiveView already used elsewhere in this module).

**M18. Calendar chip text renders at ~7px on 375px and unit code is hidden on mobile**  
`src/components/dashboard/BookingIndicators.tsx:79` · effort: small

- Impact: Guest names in the day chips render at roughly 7px — effectively unreadable — and the unit code (C1/C2/C3) is stripped below sm, leaving color as the only unit identifier. Combined with the hover-only detail card (see high finding), the mobile calendar conveys almost no readable information per day.
- Fix: Raise the clamp floor (e.g. text-[clamp(9px,2.5cqi,11px)]) and show a short unit code on mobile instead of hiding it; treat chips as tap targets that open the day detail sheet rather than trying to be fully readable inline.

**M19. Mobile calendar header drops the 'Today' button — no quick way back to current month**  
`src/components/dashboard/DashboardCalendar.tsx:172` · effort: small

- Impact: After browsing ahead/back a few months on the phone (the common 'check next month's bookings' flow), the only way back to the current month is repeated chevron taps. The monthly booking count badge shown on desktop is also absent.
- Fix: Make the month label a tap target that jumps to today (it already sits between the chevrons), or add a compact 'Today' text button in StackedHeader; wire it to the already-passed onToday prop.

**M20. KPI stat cards and recent-bookings list are omitted entirely from the mobile dashboard**  
`src/pages/MobileDashboard.tsx:50` · effort: small

- Impact: Owners running the admin PWA from phones never see Available Cabins (x/y), Active Bookings, or totals — the only aggregated occupancy snapshot in the app. There is no path on mobile to reveal these numbers from the dashboard.
- Fix: Add a compact 2-column KPI strip (reuse DashboardStats, it already collapses to 1-2 columns) above or below the calendar in MobileDashboard, or a horizontally-scrollable stat row.

**M21. Payment status/method filters, CSV export, and pagination absent on mobile payments view**  
`src/components/payments/PaymentsTable.tsx:421` · effort: medium

- Impact: On a phone, staff cannot filter payments by status (e.g. show only Pending) or method, and the list renders every payment in one unbounded scroll — finding an unverified GCash payment among months of records means manual scrolling.
- Fix: Mirror the ExpenseFilters pattern (collapsible mobile filter section, already implemented in src/components/expenses/ExpensesTable/components/ExpenseFilters.tsx) for the payments mobile branch, and cap/paginate or lazy-load the card list.

**M22. Payment amount input lacks inputMode="decimal" — no numeric keypad guarantee on iOS**  
`src/components/payments/PaymentForm.tsx:215` · effort: small

- Impact: On iOS Safari, `type="number"` shows the full keyboard's number-and-punctuation layer rather than the large decimal keypad; entering ₱ amounts (the single most-typed field when recording a payment) is slower and error-prone. Clearing the field also produces a NaN validation state.
- Fix: Add `inputMode="decimal"` (or switch to the shared NumberInput with the decimal fix below), and guard the onChange: `const v = e.target.value; field.onChange(v === "" ? undefined : parseFloat(v))`.

**M23. NumberInput hardcodes inputMode="numeric" — iOS keypad has no decimal point for expense amounts**  
`src/components/ui/input.tsx:339` · effort: small

- Impact: iOS's `inputMode="numeric"` keypad is digits-only with no "." key, so staff logging an expense on the go cannot type centavos (e.g. 1250.50) — they'd have to fight the keyboard or lose the decimal portion.
- Fix: In NumberInput, set `inputMode={allowDecimals ? "decimal" : "numeric"}` — one-line fix that benefits every amount field using the component.

**M24. All form inputs/textareas render at 14px (text-sm) — iOS auto-zooms on focus in payment/expense forms**  
`src/components/ui/input.tsx:8` · effort: small

- Impact: iOS Safari auto-zooms the page whenever a <16px input is focused. Inside the centered Record Payment / Add Expense dialogs this zoom shifts the modal off-center and forces users to pinch back out after every field — repeated friction on the most frequent phone workflow (expense entry).
- Fix: Change the base to 16px on touch: `text-base sm:text-sm` (standard shadcn fix) in both input.tsx and textarea.tsx; the xl size variant already shows the text-base pattern.

**M25. Remove-receipt button in ExpenseForm is a 24px touch target**  
`src/components/expenses/ExpenseForm.tsx:324` · effort: small

- Impact: After photographing a receipt (a one-handed on-the-go task), replacing a wrong photo requires hitting a 24px X floating at the image corner — easy to miss or to accidentally tap the underlying preview.
- Fix: Make the remove control at least 44px (`h-11 w-11` or `size-11`) or replace with a full-width "Remove photo" text button below the preview; align both forms on the same pattern.

**M26. Payment-proof PDF renders at fixed 800px width — 2x the phone viewport**  
`src/components/admin/PaymentProofViewer.tsx:327` · effort: medium

- Impact: When verifying a guest's PDF payment proof on a 375px phone (the verify-payment route is a primary owner task), the receipt renders more than twice the screen width; the amount and reference number require two-axis panning to read, and there is no fit-to-width option.
- Fix: Measure the container with a ref/ResizeObserver and pass `width={Math.min(containerWidth, 800)}`, or use react-zoom-pan-pinch around the Page like the image branch does.

**M27. Record Payment / Add Expense forms live in a centered 90vh dialog — poor fit for phone keyboards**  
`src/routes/admin/expenses.tsx:91` · effort: medium

- Impact: On iOS Safari/standalone PWA, 90vh is computed against the large viewport, so with the URL bar or keyboard visible the dialog's bottom (where Create Expense/Record Payment lives) can sit beneath the browser chrome; the centered position plus the 14px-input auto-zoom makes the most frequent phone task (logging an expense) fiddly.
- Fix: Use a bottom drawer (vaul Drawer, standard shadcn responsive-dialog pattern) below the md breakpoint, or at minimum switch to `max-h-[90dvh]` and make the action row sticky (`sticky bottom-0 bg-background`).

**M28. ExpenseCard mobile action buttons are 28-32px tall**  
`src/components/expenses/ExpensesTable/components/ExpenseCard.tsx:66` · effort: small

- Impact: Every expense interaction on mobile goes through these sub-44px targets; the 32px icon-only Delete sits directly next to Edit, inviting mis-taps on a destructive action (mitigated by the confirm dialog, but still friction).
- Fix: Use default/lg size (h-10/h-11) for the card footer buttons — cards have room — and give Delete a text label or move it behind a kebab menu.

**M29. UnitsTable has no mobile card view — desktop table with horizontal scroll only at 375px**  
`src/components/units/UnitsTable/index.tsx:62` · effort: medium

- Impact: Staff managing cabins from a phone must scroll sideways to see status and reach the actions kebab; selection checkboxes, sort headers and inline-edit cells are all desktop-sized. GuestsTable in the same app has a full MobileCard branch, so this page is conspicuously worse — the primary admin device gets the worst experience.
- Fix: Mirror the GuestsTable pattern: use const { isMobile } = useResponsiveView() and render a MobileCard list (name, code, capacity, StatusBadge, View/Edit actions) with TablePagination when isMobile is true. The MobileCard/StatusBadge primitives already exist in src/components/tables/utils.tsx.

**M30. Delete Guest (and inline edit dialog) unreachable on mobile — rendered only in the desktop branch**  
`src/components/guests/GuestsTable.tsx:506` · effort: small

- Impact: Owners/staff who run the admin exclusively from phones can never delete a guest (or fix a duplicate) — they'd have to find a desktop computer, which this family resort may not routinely use.
- Fix: Add a Delete action to GuestCard (e.g. an overflow menu or a destructive button inside the expanded section) and move GuestEditDialog + the delete AlertDialog above the isMobile early-return so they render in both branches.

**M31. Row action kebab (ActionMenu) trigger is 32px — below 44px touch target**  
`src/components/tables/utils.tsx:400` · effort: small

- Impact: The only way to reach View/Edit/Delete on a unit row is a 32x32px target at the end of a horizontally-scrolled row — frequent missed taps and accidental row-link taps instead.
- Fix: Bump the trigger to h-11 w-11 (44px), or at minimum add a larger invisible hit area (e.g. before:absolute before:-inset-2).

**M32. Unit row-selection checkboxes are 16px with no expanded hit area**  
`src/components/units/UnitsTable/components/UnitColumns.tsx:45` · effort: small

- Impact: Batch status updates (Mark Available/Maintenance/Reserved) depend on tapping 16x16px checkboxes next to a tappable name link — nearly unusable on a phone; users will mis-tap into the unit detail page instead.
- Fix: Wrap the checkbox in a padded label/cell that extends the tap area to >=44px (e.g. a flex cell with p-3 whose onClick toggles selection), or make the whole row long-pressable/selectable in a future mobile card view.

**M33. All form/search inputs are 14px (text-sm) — iOS Safari auto-zooms on focus**  
`src/components/ui/input.tsx:8` · effort: small

- Impact: On iPhone, focusing any field (guest name, email, phone, unit search) zooms the whole page in, then leaves it zoomed after blur — constant pinch-out friction on every form in the area.
- Fix: Change the shared Input/Textarea/select base to text-base md:text-sm (16px on mobile, 14px on desktop). One-line fix in ui/input.tsx and ui/textarea.tsx that fixes the whole app.

**M34. GuestCard crams four 32px-tall action buttons into one row at 375px**  
`src/components/guests/GuestsTable.tsx:179` · effort: small

- Impact: The primary per-guest actions on the mobile guests list are 32px tall and ~70px wide with icon + text squeezed together — hard to hit accurately and visually cramped; Email/Call (the actions a no-front-desk resort uses most) are the easiest to mis-tap.
- Fix: Use a 2x2 grid (grid grid-cols-2 gap-2) with default-height (h-9+) buttons, or better: make the displayed email/phone lines tel:/mailto: anchors (as GuestDetail already does) and keep only View/Edit as buttons.

**M35. TablePagination row doesn't wrap and uses 32px page buttons**  
`src/components/tables/utils.tsx:295` · effort: small

- Impact: At 375px the results text plus up to 7 buttons compete for one row: text truncates/squeezes and page-number targets are 32px, making paging through guests on a phone fiddly.
- Fix: Add flex-wrap gap-2 (or hide the "Showing X to Y" text below sm:), and raise buttons to h-10 w-10 minimum on mobile.

**M36. Admin calendar booking details are hover-only (Radix HoverCard) — inaccessible on touch**  
`src/components/dashboard/BookingTooltip.tsx:50` · effort: medium

- Impact: On /admin/availability from a phone, tapping a day with bookings shows nothing. The per-day detail card (guest name, unit chips, status, check-in/out dates, amount) is the ONLY place this info surfaces on the calendar, and it can never be opened on iOS/Android. Owners running the resort from their phones cannot inspect a day's bookings from the calendar at all.
- Fix: On touch/mobile (useIsMobile or pointer: coarse), replace HoverCard with a tap-driven UI: make the day button onClick open a bottom sheet/Drawer (or Popover) rendering the same BookingTooltipItem list, or set a selectedDate and render the day's bookings in a panel below the grid. Keep HoverCard for desktop.

**M37. Public guest calendar month navigation buttons are 32px/28px tall**  
`src/components/calendar/PublicAvailabilityCalendar.tsx:226` · effort: small

- Impact: Guests use this portal exclusively from phones; the visible month-navigation chevrons are 32px and the Today button 28px tall — below the 44px touch minimum, causing missed taps. Partially mitigated by useSwipeGesture (line 135) for prev/next, but swipe is undiscoverable and Today has no gesture equivalent.
- Fix: Use size="icon" with h-11 w-11 for the chevrons and h-10/h-11 for the full-width Today button; there is ample vertical room in the header.

**M38. Swipe gesture listens on the entire document with no vertical-axis guard — page scrolls can flip months**  
`src/components/calendar/useSwipeGesture.ts:106` · effort: small

- Impact: Any touch drag anywhere on the guest homepage — including a normal diagonal page scroll whose horizontal component exceeds 50px — triggers a month change, even when the finger never touched the calendar. Guests scrolling down the page see the calendar jump to another month, and the resulting refetch shows stale/placeholder data mid-read.
- Fix: Attach the listeners to the calendar container via a ref instead of document, track clientY, and ignore the gesture when |deltaY| > |deltaX| (or when deltaY exceeds ~40px).

**M39. All text inputs render at 14px, triggering iOS Safari auto-zoom on focus (login, sign-up, every admin form)**  
`src/components/ui/input.tsx:8` · effort: small

- Impact: On iOS Safari, focusing any field (login email/password, sign-up, forgot/reset password, all settings/account/transfer dialog forms) zooms the page in; the user must pinch back out after every field. Mobile is the primary form factor for both staff and guests.
- Fix: Change the base to `text-base md:text-sm` (current shadcn convention) so inputs are 16px below the md breakpoint; same for select/textarea primitives.

**M40. Login inputs have no autocomplete attributes and anti-autofill name values — password managers can't fill on mobile**  
`src/components/auth/LoginForm.tsx:120` · effort: small

- Impact: iOS Keychain / Google Password Manager often fail to recognize or offer credentials for the login form (the non-standard names "email-login"/"password-login" defeat heuristics), forcing owners/staff to type their password manually on a phone keyboard at every session expiry.
- Fix: Add autoComplete="username" (or "email") to the email input and autoComplete="current-password" to the password input; use standard name="email"/name="password".

**M41. Sign-up, forgot-password and reset-password submit buttons still 36px tall (login was fixed, these were not)**  
`src/components/auth/SignUpForm.tsx:228` · effort: small

- Impact: Primary submit buttons on sign-up / password-reset flows are below the 40px minimum the project itself asserts (and the 44px Apple guideline); mis-taps on the disabled-until-Turnstile button are common on phones.
- Fix: Add size="lg" (h-10) — or better a h-11 class — to the submit buttons in SignUpForm, ForgotPasswordForm, ResetPasswordForm and the two PendingApprovalPage buttons, matching the login fix in commit f766e6a.

**M42. 32px row-action icon buttons in every misc admin table (settings, accounts, transfers, roles, audit)**  
`src/components/settings/PaymentMethodsTable.tsx:189` · effort: small

- Impact: The only way to edit/deactivate a payment method, account, transfer or user role is a 32x32px target inside a dense table row — owners on phones frequently miss it or tap the adjacent row.
- Fix: Standardize row-action triggers to size-9 minimum with an expanded hit area (e.g. className="h-10 w-10 -m-1" or wrap with p-2), or move row actions into a tap-anywhere row sheet on mobile.

**M43. Dialog close (X) button has a ~16px touch target on every dialog in the app**  
`src/components/ui/dialog.tsx:46` · effort: small

- Impact: Dismissing the Add/Edit Payment Method, Account, Transfer, Grant Role, etc. dialogs requires hitting a 16x16px X in the top-right corner; on phones users resort to tapping the overlay, which risks discarding half-filled forms.
- Fix: Give the close button a real hit area, e.g. add "flex size-11 items-center justify-center" (keeping top-2 right-2), in the shared dialog primitive so all dialogs inherit it.

**M44. Misc admin data tables are horizontal-scroll-only on mobile; audit log table has 9 columns with actions at the far right**  
`src/components/audit/AuditLogViewer.tsx:131` · effort: large

- Impact: At 375px the audit table needs ~2-3 screens of horizontal scrolling to reach the expand/diff actions; accounts/transfers/roles tables similarly hide the Actions column off-screen. AuditFilters got a proper isMobile treatment but the table it filters did not. Its pagination row (line 157, flex justify-between with two buttons + two text spans) also crams at 375px.
- Fix: Add a mobile card/list rendering (as the bookings area does) or at minimum pin the first column + actions and hide low-value columns (Record ID, Source) behind the existing expand row on <md. Stack the pagination row (flex-col gap-2 sm:flex-row).

**M45. Documents page fixed bottom action bar uses undefined `safe-area-bottom` class — home-indicator overlap in the installed PWA**  
`src/components/documents/DocumentGenerator.tsx:154` · effort: small

- Impact: In the /admin PWA on notched iPhones the home indicator sits directly over the bottom half of the Preview / Download PDF buttons — taps trigger the system home gesture instead of the button. Additionally the scroll container above (line 149) has no bottom padding, so the last form field hides behind the fixed bar.
- Fix: Replace with the existing `.mobile-safe-area` class or Tailwind v4 `pb-[env(safe-area-inset-bottom)]` on the bar, and add `pb-24` to the mobile form container (line 149).

**M46. Role change history dialog can exceed a small phone's viewport (fixed 500px scroll area in a centered dialog with no outer max-height)**  
`src/components/admin/RoleChangeHistory.tsx:65` · effort: small

- Impact: On shorter phones (iPhone SE/8: ~550px visible height in Safari) 500px of list + header + p-6 padding exceeds the viewport; because the dialog is centered with no outer scrolling, the top and bottom of the history — including the close control — get clipped off-screen.
- Fix: Use a viewport-relative cap: DialogContent className="max-h-[85vh] overflow-y-auto" (as settings/accounts/transfers dialogs already do) or ScrollArea max-h-[min(500px,60vh)].

**M47. Button size floor is 32-36px — every default/sm/icon button in the app is below the 44px touch target**  
`src/components/ui/button.variants.ts:17` · effort: small

- Impact: Staff tapping row actions, filter buttons, and icon buttons on phones get 32-36px targets — frequent mis-taps, especially icon buttons adjacent to each other in table rows and headers. Even the lg size (used for the login fix) is only 40px.
- Fix: Make the primitive mobile-first: default "h-11 md:h-9", sm "h-10 md:h-8", icon "size-11 md:size-9" (or add an ::after pseudo-element hit-area expansion: "relative after:absolute after:-inset-2") so all 200 call sites inherit compliant targets without per-site edits.

**M48. Dialog and Sheet close button is a bare 16px X icon with no padding**  
`src/components/ui/dialog.tsx:46` · effort: small

- Impact: Dismissing any modal or sheet on a phone requires hitting a 16px target in the top-right corner (also partially under the notch/status bar in the installed PWA per the safe-area finding). Users mis-tap and hit content behind it or nothing.
- Fix: Add padding to the Close button (e.g. "p-2.5 -m-2.5" or explicit "flex size-11 items-center justify-center") in both dialog.tsx and sheet.tsx so the icon stays 16px visually but the tap target reaches 44px.

**M49. DropdownMenu and Select item rows are ~32px tall — cramped touch targets in row-action menus and pickers**  
`src/components/ui/dropdown-menu.tsx:84` · effort: small

- Impact: Table row "..." action menus and every Select option list present stacked ~32px rows; on a phone it's easy to tap Delete instead of Edit or select the wrong unit/status. These menus are the primary mutation path for staff working from phones.
- Fix: Bump item padding responsively at the primitive: "py-2.5 md:py-1.5" (≈44px on mobile, unchanged desktop) on DropdownMenuItem, DropdownMenuCheckboxItem/RadioItem, and SelectItem.

**M50. TabsTrigger tap height is ~32px inside a 40px TabsList**  
`src/components/ui/tabs.tsx:37` · effort: small

- Impact: Switching tabs (used across detail views and dashboards) requires hitting a 32px-tall strip; mis-taps land on adjacent tabs. Also TabsList is inline-flex with whitespace-nowrap triggers and no overflow handling, so 4+ tabs can exceed 375px with no scroll affordance.
- Fix: Make TabsList "h-12 md:h-10" (triggers grow via items-stretch) and add "max-w-full overflow-x-auto" to TabsList so long tab sets scroll horizontally instead of overflowing.

### Low — polish

**L1. Sonner toaster uses default bottom position with no safe-area/mobile offset, covering fixed bottom action bars**  
`src/components/ui/sonner.tsx:10` · effort: small

- Impact: Success/error toasts (fired after the very actions those bars trigger) pop up directly on top of the bottom action bar in the thumb zone, forcing the user to wait for or swipe away the toast to reach Generate/Save; near the home indicator they are also awkward to swipe-dismiss in standalone mode.
- Fix: Set `position="top-center"` on the Toaster for mobile (or `mobileOffset={{ bottom: 80 }}` plus a safe-area-aware offset) so toasts never occlude bottom action bars.

**L2. Check-status result card renders below the fold with no scroll-into-view**  
`src/routes/booking/check-status.tsx:220` · effort: small

- Impact: On a 375px phone the search form plus header fills the viewport; after tapping Search the guest sees only a toast and must guess to scroll down to find their booking details.
- Fix: scrollIntoView({ behavior: "smooth" }) on a ref to the results card when booking is set (same pattern as the wizard's window.scrollTo on step change).

**L3. Payment-proof drop zone: only the inner label is tappable, not the whole padded zone**  
`src/components/guest-booking/PaymentProofUpload.tsx:356` · effort: small

- Impact: Taps on the outer edges of the visually-clickable upload box do nothing, making the picker feel unresponsive on a phone (guests often tap the border area). Copy also says 'Drop payment proof here' — drag-and-drop language meaningless on touch.
- Fix: Make the <label> the outer element carrying the dashed-border styles (or add onClick={() => inputRef.current?.click()} to the div), and change copy to 'Tap to add your payment screenshot' on mobile.

**L4. Required terms checkbox is 16x16px; tap target relies on the adjacent label**  
`src/components/guest-booking/BookingReviewStep.tsx:182` · effort: small

- Impact: The checkbox gating the Submit button is a 16px square; guests aiming at the box itself (rather than the label text) frequently miss on first tap. Mitigated but not solved by the clickable label.
- Fix: Wrap checkbox + label in a single tappable row with p-3 and min-h-11 (make the whole card row toggle), or bump the checkbox to h-5 w-5 with padding.

**L5. Mobile-optimized modular BookingForm/ is dead code — shadowed by legacy BookingForm.tsx monolith**  
`src/components/bookings/BookingForm/index.tsx:166` · effort: medium

- Impact: Staff on phones get the legacy form: 36-40px inputs with text-sm (iOS auto-zoom on focus), a cramped 2-column review grid at 375px, and none of the 48px touch-target work. Any mobile fix made to the BookingForm/ directory silently changes nothing in the app.
- Fix: Pick one canonical implementation. Either delete BookingForm.tsx and let imports resolve to the modular directory (then run the full test suite — src/tests/mobile-responsive.test.tsx imports the same shadowed path), or port the directory's mobile classes into the monolith and delete the directory. Do not leave both; the CLAUDE.md in the directory even documents filenames that don't exist (UnitSelectionStep.tsx etc.).

**L6. Walk-in checkbox is a 16px control**  
`src/components/bookings/BookingForm/steps/GuestInformation.tsx:23` · effort: small

- Impact: Staff logging a walk-in guest on a phone must hit a 16px square (or the short label text); taps on the descriptive text or padding do nothing.
- Fix: Make the entire bordered FormItem row toggle the field (onClick on the wrapper or wrap in a <label>), and/or bump the checkbox to size-5/size-6 on mobile.

**L7. Date-picker calendar day cells are 40px on mobile — smaller than on desktop**  
`src/components/ui/calendar.tsx:27` · effort: small

- Impact: Day cells in the most precision-critical picker (wrong tap = wrong booking date) are smallest exactly on touch devices; adjacent-day mis-taps at 40px are plausible for staff working quickly.
- Fix: Invert the scale: `[--cell-size:2.75rem]` (44px) as the base and reduce at sm+ if desired.

**L8. Review step value rows can overflow at 375px for long emails/names**  
`src/components/bookings/BookingForm/steps/BookingReview.tsx:87` · effort: small

- Impact: A long unbroken email (common: firstname.lastname##@gmail.com) can't wrap, pushing the row wider than the card and causing horizontal jitter on the final confirmation screen.
- Fix: Add `min-w-0 break-all text-right` (or `truncate` with full value on tap) to the value spans in the review rows.

**L9. Loading skeleton always renders the desktop 9-column table on phones, then swaps to cards**  
`src/components/bookings/BookingsTable/index.tsx:35` · effort: small

- Impact: On a 375px phone over a slow network, the loading state shows a horizontally overflowing desktop table skeleton, then the layout completely reflows into the card list when data arrives — visible jank and a misleading loading preview on every visit to the bookings page.
- Fix: Pass the flag that is already in scope: `return <BookingsTableSkeleton isMobile={isMobile} />;` — the mobile skeleton variant is already implemented.

**L10. Mobile filter bar and card primary buttons are 32px tall (size="sm" = h-8)**  
`src/components/bookings/BookingsTable/components/BookingFilters.tsx:250` · effort: small

- Impact: Every interactive control in the phone filter bar, plus the full-width Confirm/Upload Payment buttons on each booking card, is 32-36px tall — below the 44px iOS guideline and below the 40px minimum this repo already adopted for the login button (commit f766e6a). Full-width buttons are forgiving horizontally but the short height still causes missed taps while walking around the resort.
- Fix: On mobile use default size (h-9/36px) at minimum, ideally h-10+ for the card primary actions and the Filters/Export buttons; or add a mobile-only min-height, matching the 40px standard set for the login button.

**L11. No sort control in the mobile card view**  
`src/components/bookings/BookingsTable/index.tsx:62` · effort: medium

- Impact: Staff on phones cannot reorder bookings (e.g. by check-in date vs amount vs newest); they get whatever order the query returns, and long unpaginated lists make finding a specific stay slower.
- Fix: Add a compact sort Select next to the mobile Filters button (Check-in date / Newest / Amount) that drives the same `sorting` state, and render cards from `table.getRowModel().rows` so sorting and pagination both apply.

**L12. Detail page Edit button is 32px tall**  
`src/components/entity-detail/DetailPageLayout.tsx:105` · effort: small

- Impact: The single path from a booking's detail view to editing it is a 32px-tall button in the header — small friction, but it is the primary action of the page on the primary form factor.
- Fix: Use default or lg size on this shared layout's Edit button (affects all entity detail pages: bookings, guests, units).

**L13. Check-ins/Check-outs tab triggers are ~32px tall on mobile**  
`src/components/ui/tabs.tsx:22` · effort: small

- Impact: The Tomorrow's Schedule check-in/check-out toggle — a frequent daily action — has a 32px-tall hit area, below the 44px iOS guideline. Triggers are full-half-width so horizontal accuracy is fine, but vertical mis-taps hit the card content.
- Fix: On the mobile dashboard pass className="h-11" (or h-12) to TabsList so triggers reach ~40-44px, or bump the base ui/tabs.tsx height for coarse pointers.

**L14. Mobile dashboard refresh button is 40px (h-10 w-10), just under the 44px target**  
`src/components/dashboard/DashboardHeader.tsx:56` · effort: small

- Impact: The only data-refresh affordance on the phone dashboard (no pull-to-refresh exists) is a 40px ghost icon button in the top-right corner — slightly under the 44px guideline and adjacent to the tiny 11px timestamp text.
- Fix: Bump to h-11 w-11 to match the 44px month-nav chevrons already used in StackedHeader (DashboardCalendar.tsx line 181), or add negative-margin padding to extend the hit area.

**L15. PaymentsTable mobile card Receipt/Edit buttons are 32px tall**  
`src/components/payments/PaymentsTable.tsx:465` · effort: small

- Impact: The only two actions available on a payment card on mobile are below the 44px touch-target guideline.
- Fix: Bump to default size (h-9) minimum, ideally h-10+, when rendered in the mobile branch.

**L16. Payment-proof image viewer fixed at 600px height pushes Verify/Reject below the fold**  
`src/components/admin/PaymentProofViewer.tsx:263` · effort: small

- Impact: On a ~660px-tall phone viewport the viewer plus zoom toolbar consumes the whole screen; after inspecting the proof the user must scroll past dead space to reach Verify Payment / Reject Payment. Pinch-zoom inside the TransformWrapper also competes with page scroll.
- Fix: Use a viewport-relative height (`h-[50dvh]` on mobile) or make the Verify/Reject bar sticky at the bottom of the card.

**L17. Mobile expense list renders all filtered expenses with no pagination**  
`src/components/expenses/ExpensesTable/index.tsx:74` · effort: small

- Impact: As expense history grows (daily entries for a resort), the phone view mounts hundreds of Cards at once — slow initial render on mid-range Android over slow networks, and endless scrolling with no jump-to-page.
- Fix: Apply the table's pagination row model to the mobile list too (use table.getRowModel().rows) or add an incremental "Load more" every 20 cards.

**L18. Inline-edit affordance is hover-only (invisible pencil on touch)**  
`src/components/units/UnitsTable/components/InlineEdit.tsx:101` · effort: small

- Impact: In units Edit mode on a phone, nothing indicates which cells are editable — the pencil only appears on hover, which doesn't exist on touch. The cell is tappable, but the affordance is invisible; save/check targets are 32px.
- Fix: Show the pencil at reduced opacity by default (opacity-40 group-hover:opacity-100) or always-on when isEditMode, and enlarge save/cancel to 44px on touch.

**L19. Pricing page tab labels clip at 375px (nowrap in forced 3-column grid)**  
`src/routes/admin/units/pricing.tsx:81` · effort: small

- Impact: Each tab gets ~117px at 375px; "Seasonal Rates" and "Discount Rules" with px-3 padding and whitespace-nowrap overflow their cells, so labels visually clip/overlap on phones.
- Fix: Use shorter labels on mobile (Base / Seasonal / Discounts), or drop grid-cols-3 in favor of a horizontally scrollable TabsList (flex overflow-x-auto).

**L20. Email/Call use window.open(tel:/mailto:, "\_blank") — unreliable in mobile browsers/PWA standalone**  
`src/components/guests/GuestsTable.tsx:256` · effort: small

- Impact: In iOS standalone PWA and some Android browsers, window.open with \_blank for tel:/mailto: can open a blank tab or be blocked, so tap-to-call from the guests list may silently do nothing. GuestDetail's plain <a href="tel:..."> anchors (GuestDetail/index.tsx lines 78, 93) are the reliable pattern.
- Fix: Render the buttons as <a href={`tel:${...}`}> / <a href={`mailto:${...}`}> (Button asChild), or use window.location.href = `tel:${...}` instead of window.open.

**L21. Mobile 'stacked' calendar header drops the Today button and monthly booking count**  
`src/components/dashboard/DashboardCalendar.tsx:172` · effort: small

- Impact: On the mobile dashboard (and on the availability page once it adopts the stacked header per the earlier finding), after browsing several months ahead there is no one-tap way back to the current month — the user must tap the chevron repeatedly. The monthly booking count summary is also lost on mobile.
- Fix: Add a compact Today button to StackedHeader (e.g. a small text button next to the month label, min 44px hit area via padding) wired to the already-passed onToday prop.

**L22. Reset/forgot password inputs also missing autocomplete hints**  
`src/components/auth/ResetPasswordForm.tsx:151` · effort: small

- Impact: Password managers don't offer to generate/save the new password during reset, so users invent a weak one on the phone keyboard; email field doesn't autofill on forgot-password.
- Fix: Add autoComplete="new-password" to both reset fields and autoComplete="email" to the forgot-password email input.

**L23. Audit logs 'Show/Hide Filters' is a bare text button (~20px tall)**  
`src/routes/admin/audit-logs.tsx:100` · effort: small

- Impact: The only way to reveal audit filters on a phone is a small low-contrast text link in the header; hard to hit and easy to miss.
- Fix: Replace with <Button variant="outline" size="sm"> with a Filter icon (matching AuditFilters' own mobile trigger pattern) and min-h-10.

**L24. 404 page content has no horizontal padding at 375px**  
`src/routes/_404.tsx:12` · effort: small

- Impact: The 'Go to Dashboard' / 'Go Back' buttons and body text run edge-to-edge on a 375px screen — looks broken and edge taps conflict with the iOS back-swipe gesture zone.
- Fix: Add px-4 (or p-4 to match sibling pages) to the outer flex container.

**L25. Login page renders the app title twice, pushing Turnstile and the submit button toward/below the fold on small phones**  
`src/components/auth/LoginScreen.tsx:26` · effort: small

- Impact: Roughly 120px of duplicated heading on a 667px-tall phone; combined with the 65px Turnstile widget, the Sign In button can end up below the fold, and keyboard-open scrolling gets longer.
- Fix: Drop the outer h2/subtitle in LoginScreen (or the CardHeader duplicate in LoginForm) so the title appears once.

**L26. Checkbox is 16x16px with no expanded hit area**  
`src/components/ui/checkbox.tsx:14` · effort: small

- Impact: Any checkbox (table row selection, form consents like the guest privacy consent) is a 16px tap target on a phone — well below 44px, hard to hit with a thumb, causing repeated taps and accidental taps on adjacent labels/rows.
- Fix: Increase to size-5 and add hit-area expansion on the primitive ("relative after:absolute after:-inset-3"), or ensure it is always wrapped in a padded <label>; fixing the primitive covers all call sites.

**L27. 44px/16px mobile design system (mobile-enterprise.css) is dead code — none of its classes are wired to the actual primitives**  
`src/styles/mobile-enterprise.css:17` · effort: medium

- Impact: No direct user harm, but it's the root cause of the touch-target/zoom findings above: the correct mobile standards were written, then never applied, while 500+ lines of unused CSS still ship to every phone on a slow connection.
- Fix: Fold the 44px/16px standards into the shadcn primitives (button.variants.ts, input.tsx) as recommended above, then delete the unused rules from mobile-enterprise.css.

**L28. ResponsiveTableWrapper (CSS-only mobile card/table switcher) is exported but used by zero features**  
`src/components/tables/ResponsiveTableWrapper.tsx:28` · effort: medium

- Impact: Tables DO have mobile branches (no broken layout), but via JS conditional rendering: a brief wrong-layout flash on rotation/resize due to the 300ms debounce, and the advertised zero-JS primitive is dead code that misleads future work.
- Fix: Either migrate feature tables to the CSS-only wrapper (renders both views, no flash) or delete ResponsiveTableWrapper/TableDemo and document useResponsiveView as the standard.

**L29. No global mobile base CSS: missing -webkit-tap-highlight-color, text-size-adjust, and overscroll-behavior**  
`src/index.css:84` · effort: small

- Impact: Android Chrome shows the gray tap-highlight flash on every button/row tap (only elements that opted into .touch-manipulation avoid double-tap delay quirks); iOS may inflate text on orientation change (-webkit-text-size-adjust unset); pull-past-edge bounces the whole PWA shell instead of the scroll container.
- Fix: Add to @layer base: html { -webkit-text-size-adjust: 100%; } body { -webkit-tap-highlight-color: transparent; overscroll-behavior-y: none; } and a global button/a { touch-action: manipulation; }.

**L30. Toaster has no mobile position/offset config — bottom toasts can sit under the home indicator in the installed PWA and cover bottom action bars**  
`src/components/ui/sonner.tsx:10` · effort: small

- Impact: On phones sonner renders toasts full-width at the bottom with a fixed 16px offset; in the standalone PWA (no browser chrome) this overlaps the home-indicator zone and covers fixed bottom action bars (e.g. DocumentGenerator's fixed bottom bar), hiding Save/Confirm right after the action that triggered the toast.
- Fix: Pass mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 72px)" }} (or position="top-center" on mobile) to the Sonner component so toasts clear fixed bottom bars and the home indicator.
