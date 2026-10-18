# Material 3 window size classes mapped to Tailwind v4

Research for #28 (map #27). Answers: what M3's window size classes, canonical layouts and per-class navigation are; how they map onto Tailwind v4 breakpoints and container queries; and which canonical layout fits each of this app's screens and the `/admin` PWA. Sources were read on 2026-10-18. m3.material.io is a client-rendered SPA, so its pages were rendered in a headless browser and the text was read from the DOM.

## 1. Window size classes (now called "breakpoints")

M3 has renamed them: "A breakpoint (previously window size class) is the window size at which a layout needs to change … These apply to Android and web." [M3 Breakpoints overview]

| M3 breakpoint | Width (dp) | Common devices (M3)                         | Panes                | Navigation                                                                                                               | Margins / spacer          |
| ------------- | ---------- | ------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| Compact       | < 600      | Phone portrait                              | 1                    | Navigation bar, or modal expanded nav rail                                                                               | 16dp margins              |
| Medium        | 600–839    | Tablet portrait, unfolded foldable portrait | 1 (recommended) or 2 | Navigation bar or modal expanded rail (overview table); the Medium page says single pane → nav rail, two panes → nav bar | 24dp margins, 24dp spacer |
| Expanded      | 840–1199   | Phone/tablet landscape, desktop             | 1 or 2 (recommended) | Nav rail, collapsed or expanded (modal or standard)                                                                      | 24dp / 24dp               |
| Large         | 1200–1599  | Desktop                                     | 1 or 2 (recommended) | Nav rail, collapsed or expanded                                                                                          | 24dp / 24dp               |
| Extra-large   | ≥ 1600     | Desktop, ultra-wide                         | 1 to 3 (recommended) | Nav rail; expanded rail "best suited" here                                                                               | 24dp / 24dp               |

Sources: [M3 Breakpoints overview], [M3 Compact], [M3 Medium], [M3 Expanded], [M3 Large & XL]. Android's docs give the same numbers and add coverage stats (compact covers 99.96% of portrait phones, expanded covers 97.22% of landscape tablets) [Android WSC].

Other rules that matter here:

- **Width is what counts.** "Most apps can build an adaptive UI by considering only the width window size class" [Android WSC]. Height classes (compact < 480, medium 480–899, expanded ≥ 900) are Android-only in M3, and "it's rare that layouts need to adjust to available height" [M3 Breakpoints overview].
- **Large and XL are optional.** They are "most useful for creating web experiences tailored to laptop and desktop… Some products may not need large and extra-large breakpoints" [M3 Large & XL].
- **Pane sizing.** In a fixed-and-flexible layout the fixed pane is **360dp** at expanded [M3 Expanded] and **412dp** at large and extra-large [M3 Large & XL]. A split-pane layout keeps the spacer visually centred, so navigation shrinks the leading pane. At medium, two panes split 50/50 with no custom widths [M3 Medium]. Extra-large may add a standard side sheet as a third pane (max 400dp); "Don't use more than three panes" [M3 Large & XL].
- **Density caveat.** "Don't use two panes in medium layouts with high information density" [M3 Breakpoints overview]. At expanded and above, "a single-pane layout can work when displaying visually- or information-dense content" [M3 Expanded], [M3 Large & XL].
- **Line length.** "Across all breakpoints, adjust margins and type styles to keep text between 40–60 characters per line" [M3 Breakpoints overview].
- **Five adaptation questions:** reveal, divide, resize, reposition, swap. Swap only components that do the same job (bar ↔ rail, collapsed ↔ expanded rail, bottom sheet ↔ menu, full-screen dialog ↔ basic dialog) [M3 Breakpoints overview].

## 2. Navigation per class (M3 Expressive, May 2025)

- **The navigation drawer is no longer recommended.** "Use the expanded navigation rail instead", which "has mostly the same functionality … and adapts better across breakpoints" [M3 Nav drawer]. The baseline rail is also deprecated in favour of the **collapsed** rail [M3 Nav rail specs].
- **Navigation bar:** compact and medium only. It holds 3–5 destinations, and "For products with more than five navigation items, don't use a navigation bar" [M3 Nav bar guidelines].
- **Collapsed rail:** 3–7 items on the leading edge, "should not be hidden", medium to extra-large. "Compact windows should always use a navigation bar" (or a modal rail) [M3 Nav rail guidelines].
- **Expanded rail:** standard (pushes content) or modal (overlays it), "should always open from a menu icon", and can reveal secondary destinations that the collapsed rail hides. At compact or medium "If there are more than five destinations, consider using a modal expanded nav rail instead" [M3 Nav rail guidelines].
- Rail destinations stay fixed while content scrolls. Badges sit on the icon when the rail is collapsed and next to the label when it is expanded [M3 Nav rail guidelines].

## 3. Canonical layouts

M3 now calls these "canonical layout examples": feed, list-detail and supporting pane, each with compact, medium and expanded configurations [M3 Canonical overview].

- **List-detail** is for parent-child data. It is one pane at compact (list _or_ detail), 1 (recommended) or 2 at medium, and 2 from expanded up. The back button appears only in a single-pane layout and the selected state only in a two-pane one. With nothing selected, the two-pane detail pane shows a placeholder. Going from two panes to one normally shows the detail with an app bar. Detail views keep their scroll position [M3 List-detail].
- **Supporting pane** is for secondary content that only means something next to the primary content. It sits _below_ the main pane at compact and medium (a bottom sheet is fine at compact) and _beside_ it at expanded, with a fixed 360dp width. Use list-detail instead when the relationship is parent-child [M3 Supporting pane].
- **Feed** is a card grid. It stacks one card wide at compact, and "the number of columns should usually increase at expanded breakpoints" [M3 Feed].
- **Layering ("levitate")** puts panes above content for focused tasks; "creating a calendar event" is one of M3's examples [M3 Canonical overview].

## 4. Tailwind v4 facts (v4.3.3 in this repo)

- **Default breakpoints** are mobile-first `min-width` queries: `sm` 40rem (640), `md` 48rem (768), `lg` 64rem (1024), `xl` 80rem (1280), `2xl` 96rem (1536). `max-*` variants and ranges such as `md:max-lg:` exist [TW Responsive].
- **Custom breakpoints** are set with `--breakpoint-*` in `@theme`. `--breakpoint-*: initial` removes all the defaults. "Always use the same unit … use rem to avoid unexpected sorting" [TW Responsive], [TW Theme].
- **Container queries** are in core with no plugin: `@container`, named `@container/main` with `@md/main:`, `@max-md:`, and arbitrary `@min-[475px]:`. `cqw`/`cqi` units work, and `@container-size` enables block-axis units. Default container sizes run from `@3xs` 16rem to `@7xl` 80rem (`@sm` 24rem, `@md` 28rem, `@lg` 32rem, `@xl` 36rem, `@2xl` 42rem, `@3xl` 48rem, `@4xl` 56rem, `@5xl` 64rem). Custom sizes go in `--container-*` [TW Responsive].
- **Gotcha:** `--container-*` also drives `max-w-*` (`max-w-md` = `var(--container-md)`) [TW Max-width]. A custom `--container-pane: 22.5rem` therefore creates both an `@pane:` variant and a `max-w-pane` utility.

### dp → CSS px

M3 dp and CSS px are both density-independent units. On Android Chrome `devicePixelRatio` = density / 160, so 1dp = 1 CSS px in practice. _Inference, not stated on m3.material.io._ M3's claim that its breakpoints "apply to Android and web" supports reading them as CSS px. Assuming a 16px root: 600 = 37.5rem, 840 = 52.5rem, 1200 = 75rem, 1600 = 100rem.

### Mapping

| M3          | CSS px    | Nearest Tailwind default      | Gap                                                    |
| ----------- | --------- | ----------------------------- | ------------------------------------------------------ |
| Compact     | < 600     | unprefixed / `max-sm` (< 640) | 40px off                                               |
| Medium      | 600–839   | `sm` 640                      | close                                                  |
| (none)      | —         | `md` 768                      | **no M3 equivalent**                                   |
| Expanded    | 840–1199  | `lg` 1024                     | **184px late**: 840–1023 windows get the medium layout |
| Large       | 1200–1599 | `xl` 1280                     | 80px off                                               |
| Extra-large | ≥ 1600    | `2xl` 1536                    | 64px off                                               |

Candidate `@theme` (for the grilling, not decided):

```css
@theme {
  --breakpoint-*: initial; /* optional: drop sm/md/lg/xl/2xl */
  --breakpoint-medium: 37.5rem; /* 600 */
  --breakpoint-expanded: 52.5rem; /* 840 */
  --breakpoint-large: 75rem; /* 1200 */
  --breakpoint-xlarge: 100rem; /* 1600 */
  --container-pane: 22.5rem; /* 360dp fixed pane, expanded */
  --container-pane-lg: 25.75rem; /* 412dp fixed pane, large+ */
}
```

That gives `medium:`, `expanded:`, `large:`, `xlarge:` and `max-expanded:` variants. Compact is the unprefixed base, which matches Tailwind's mobile-first model.

- **Media queries vs container queries:** M3 breakpoints are _window_ sizes, so they belong to media-query variants and should only drive _shell_ decisions: navigation type, pane count, margins. Content _inside_ a pane (table ↔ card list, form columns, feed columns) should respond to the pane's width with `@container`. In a two-pane layout at 1200px, the list pane is roughly 1200 − rail − 412 − 48px wide, so a viewport query would choose the wrong presentation.
- **Height:** there are no height breakpoints by default. If they are ever needed, use `@custom-variant short (@media (max-height: 30rem))` or an arbitrary `[@media(max-height:480px)]:` [TW Directives]. M3 says this is rarely needed.

## 5. Current state in this repo

- `src/index.css` defines no `--breakpoint-*` or `--container-*` and uses no `@container` anywhere in `src`, so the Tailwind defaults apply. Breakpoint usage in `.tsx`: `sm:` 183, `md:` 85, `lg:` 50, `max-md:` 14, `xl:` 3.
- **Admin shell** (`src/layouts/MainLayout.tsx`): at `lg` (≥ 1024) there is a persistent 256/288px sidebar (`w-64 lg:w-72`), which is effectively a standard expanded rail or drawer. Below 1024 a top header with a hamburger opens a left `Sheet` (modal). There is no navigation bar and no collapsed rail. Content padding is `px-2` (8px) on compact, `md:p-4` (16px) and `lg:p-6` (24px). M3 wants 16px on compact and 24px from medium up.
- The admin nav has 11 top-level destinations (Dashboard, Bookings, Booking Queue, Guests, Payments, Cabins, Expenses, Accounts, Transfers, Documents, Settings) plus Audit Trail and User Roles, some role-gated. That is more than a navigation bar's 5 and more than a collapsed rail's 7.
- **JS breakpoints bypass Tailwind:** `useResponsiveView` defaults to `(min-width: 1024px)` and is used by 6 components, including the BookingsTable ↔ BookingCard switch. `useMediaQuery("(max-width: 768px)")` is used in `responsive-date-picker` and `DetailAuditSection`. These hard-coded pixel values would not follow a `@theme` change.
- **Detail views are separate routes** (`admin/bookings/$bookingId`, `guests/$guestId`, `payments/$paymentId`, `units/$unitId`, `expenses/$expenseId`, each with `/edit`). That is single-pane list-detail at every width.
- **PWA** (`public/manifest.json`): `scope` and `start_url` are `/admin`, `display: standalone`, and **`orientation: "portrait-primary"`**. Where the browser honours the lock, phones stay compact and tablets in portrait land in medium (600–839) or, on large tablets, low expanded. _Not verified: which platforms honour `orientation` for an installed PWA (iOS is believed to ignore it)._

## 6. Canonical layout fit per screen (proposal for the grilling)

| Screen                                                                          | Fit                                                                                        | Compact / medium                                                            | Expanded                                                            | Large / XL                                                                                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Admin tables: Bookings, Guests, Payments, Cabins, Expenses, Accounts, Transfers | List-detail                                                                                | Single pane: card list → detail route (today's behaviour)                   | Single pane with full table. M3 allows this for dense content       | Optional two-pane: condensed list + detail (412px fixed list, or 50/50). List selection state, empty-detail placeholder |
| Booking Queue → verify payment                                                  | List-detail                                                                                | Single pane                                                                 | Two-pane (queue + verify) is a strong fit: few columns, act-on-item | Two-pane                                                                                                                |
| Detail views (booking, guest, payment)                                          | Supporting pane                                                                            | Audit trail, payments and history _below_ the main detail (or bottom sheet) | Supporting pane beside, 360px                                       | Beside, 412px                                                                                                           |
| Dashboard                                                                       | Feed                                                                                       | One column of cards                                                         | More columns                                                        | More columns; consider max line length                                                                                  |
| Booking form (admin `new-multi`, guest `guest-booking`)                         | Supporting pane                                                                            | Pricing summary below, or a sticky bottom summary or sheet                  | Form + summary beside (360px)                                       | Same, 412px; cap the form width for 40–60 chars per line                                                                |
| Public availability calendar                                                    | Single pane, optionally supporting pane                                                    | Full-width month grid (already has swipe)                                   | Calendar + legend/selected-date panel beside                        | Same                                                                                                                    |
| Edit forms, Settings                                                            | Single pane; Settings may use list-detail (M3 cites settings as a fine two-pane at medium) | Single                                                                      | Single, width-capped                                                | Settings could be two-pane                                                                                              |
| Create booking / event over a list                                              | Layering (levitate)                                                                        | Full-screen dialog                                                          | Basic dialog or side sheet                                          | Side sheet                                                                                                              |

**Admin navigation per class** (M3-compliant options):

- Compact: keep the modal expanded rail (today's hamburger + Sheet). M3 explicitly allows this for more than 5 destinations. A 4–5 item navigation bar (Dashboard, Bookings, Queue, + More) is the alternative and needs a "More" overflow.
- Medium: collapsed rail with up to 7 destinations, plus a menu icon that opens the modal expanded rail for the rest. Or keep the modal rail.
- Expanded: collapsed rail (or modal expanded). This closes today's 840–1023 gap where a landscape tablet only gets a hamburger.
- Large / XL: standard expanded rail, which is today's sidebar restyled and moved from 1024 to 1200, or kept at 840.

## Not verified

- The exact dp measurements of the navigation rail (collapsed and expanded widths). The M3 specs page shows them only in images.
- How iOS and Android treat the manifest `orientation` lock for this PWA.
- The dp = CSS px equivalence on iOS. It is consistent in practice but no primary source was read.
- Live screenshots of the current admin at 600 / 840 / 1200px. Section 5 comes from code inspection only.

## Decisions Needed (for the "Adaptive layout rules per window size" grilling)

1. **Breakpoint names:** replace the Tailwind defaults with M3 names (`medium`/`expanded`/`large`/`xlarge` at 600/840/1200/1600) and lint out `sm:`/`md:`/`lg:`/`xl:`/`2xl:` at migration. **Recommended default: yes, add the M3 names now and keep the defaults until migration finishes, then set `--breakpoint-*: initial`.** Redefining `sm`/`md`/`lg` in place shifts 321 usages silently.
2. **Support large and XL?** **Recommended: yes for admin (desktop use), compact to expanded only for public and guest pages.**
3. **Shell vs content rule:** media-query breakpoints only in shells (nav, pane count, margins); `@container` everywhere inside panes; replace the `useResponsiveView` and `useMediaQuery` pixel hooks. **Recommended: adopt.** Enforcement could flag breakpoint variants outside layout files.
4. **Admin nav:** modal rail on compact (keep), collapsed rail on medium and expanded, standard expanded rail on large and up. **Recommended: adopt; no bottom nav bar** because there are 11 or more destinations.
5. **Two-pane admin tables:** **Recommended: single pane plus detail route by default. Two-pane only for Booking Queue at expanded and up**; revisit other tables at large and up later.
6. **Margins:** align to M3, 16px on compact and 24px from medium up (today 8/16/24). **Recommended: adopt.**
7. **PWA orientation lock:** **Recommended: drop `portrait-primary`** so tablets can use expanded layouts. This needs a platform check.

## Sources

- [M3 Breakpoints overview]: https://m3.material.io/foundations/layout/breakpoints/overview
- [M3 Compact]: https://m3.material.io/foundations/layout/breakpoints/compact
- [M3 Medium]: https://m3.material.io/foundations/layout/breakpoints/medium
- [M3 Expanded]: https://m3.material.io/foundations/layout/breakpoints/expanded
- [M3 Large & XL]: https://m3.material.io/foundations/layout/breakpoints/large-extra-large
- [M3 Canonical overview]: https://m3.material.io/foundations/layout/canonical-examples/overview
- [M3 List-detail]: https://m3.material.io/foundations/layout/canonical-examples/list-detail
- [M3 Supporting pane]: https://m3.material.io/foundations/layout/canonical-examples/supporting-pane
- [M3 Feed]: https://m3.material.io/foundations/layout/canonical-examples/feed
- [M3 Nav drawer]: https://m3.material.io/components/navigation-drawer/overview
- [M3 Nav rail specs]: https://m3.material.io/components/navigation-rail/specs
- [M3 Nav rail guidelines]: https://m3.material.io/components/navigation-rail/guidelines
- [M3 Nav bar guidelines]: https://m3.material.io/components/navigation-bar/guidelines
- [Android WSC]: https://developer.android.com/develop/ui/compose/layouts/adaptive/window-size-classes
- [TW Responsive]: https://tailwindcss.com/docs/responsive-design
- [TW Theme]: https://tailwindcss.com/docs/theme
- [TW Max-width]: https://tailwindcss.com/docs/max-width
- [TW Directives]: https://tailwindcss.com/docs/functions-and-directives
- Repo: `src/index.css`, `src/layouts/MainLayout.tsx`, `src/hooks/useResponsiveView.ts`, `src/hooks/useMediaQuery.ts`, `public/manifest.json`, `src/routes/admin/**`
