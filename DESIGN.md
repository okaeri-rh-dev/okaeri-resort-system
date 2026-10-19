# DESIGN.md

The design system for the Okaeri Resort app: how UI is built and reviewed. It holds only what code, lint and tests can't tell you. Values live in `src/index.css`, mechanical rules live in the [Enforcement map](#enforcement-map), and the reasons live in the linked ADRs and tickets.

## Purpose and users

The app serves a small family-run resort: a public availability calendar, the guest booking flow, and the admin app (installable as the `/admin` PWA). Admin users are family members running day-to-day operations, mostly on phones. Guests book from phones first. There is no front desk, so copy uses plain family-business wording rather than hotel terms.

The visual identity is **Hearth**: timber and sand on warm stone, chosen in [Visual identity direction](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/31). The accessibility floor is WCAG 2.2 AA.

## Vocabulary

- **Token**: a semantic CSS variable in `src/index.css` (`--primary`, `--success`), used through its Tailwind utility (`bg-primary`). Tokens are the only source of colour, shadow and font.
- **Primitive**: a shadcn component in `src/components/ui`. It has no product knowledge and is styled only by tokens.
- **Pattern**: a domain-free composition in `src/components/patterns` (`DataTable`, `StatusBadge`, `FormField`).
- **Kit**: primitives plus patterns, published through the `@/components/patterns` barrel.
- **Feature component**: a domain-aware component (`BookingCard`) in `src/components/<domain>/`. Feature components and route files together are the **product layer**.
- **Tone**: the domain-free status vocabulary a pattern accepts: `success`, `warning`, `danger`, `info`, `neutral`.
- **Window size class**: a Material 3 width band: compact (<600px), `medium`, `expanded`, `large`, `xlarge`.
- **Shell**: the page-level frame (`AppShell` and its configs) that owns navigation, pane count and window margins.
- **Pane**: a content region inside a shell. Panes respond to their own width, not the window's.
- **Coarse pointer**: touch input, detected by `@media (pointer: coarse)` and exposed as the `coarse:` variant. Unlike a window size class, it describes the input device, not the width.

## Components

Product code imports UI from `@/components/patterns` only. That barrel re-exports the plain primitives as they are and wraps the rest in patterns: `Table` → `DataTable`, `Badge` → `StatusBadge`, `Alert` → `Callout`, `Form` → `FormField`, `Calendar` → `DatePicker`. `@/components/ui/*` is private to `src/components/patterns/`.

The barrel is the catalogue: each pattern documents its own usage in TSDoc. The rules for writing a pattern are in `src/components/patterns/CLAUDE.md`, and changes from upstream shadcn are logged in `src/components/ui/README.md`.

- A pattern takes tones, not domain types. Status → tone mapping lives in the product layer.
- A pattern's `className` is for placement only (margin, width, grid or flex position). Colour, type and radius come through variants.
- A pattern normally needs two or more call sites. These patterns qualify with one: `AppShell`, `PageHeader`, `DataTable`, `StatusBadge`, `Callout`, `FormField`, `DatePicker`.

Rationale: [Component layer boundaries](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/33).

## Layout

Breakpoints use the window size class names (`medium:`, `expanded:`, `large:`, `xlarge:`), with compact as the unprefixed base ([ADR 0004](docs/adr/0004-m3-named-breakpoints.md)). Admin supports compact to xlarge. Guest and public pages support compact to expanded, then stay centred at their max width.

- **Window queries live in shells.** Breakpoint prefixes set nav form, pane count and margins. Inside a pane, adapt with `@container`.
- **`DataTable` owns table ↔ card.** It switches to cards when its pane is narrower than ~600px. Product code passes a card renderer and never branches on width.

Navigation per class:

| Surface | Compact                                                                                                                        | Medium, expanded                     | Large, xlarge             |
| ------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------------------- |
| Admin   | Bottom bar: Dashboard, Bookings, Booking Queue, Payments, More (opens the modal rail). Roles with ≤5 destinations get no More. | Collapsed rail; groups open a flyout | Expanded rail with labels |
| Guest   | Top bar with a menu sheet                                                                                                      | Top bar with inline links            | (centred at max width)    |

Pane layouts:

| Screen                         | Layout                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| Admin lists                    | Single pane, detail on its own route                                                       |
| Booking Queue → verify payment | List-detail; two panes from `expanded`                                                     |
| Detail views                   | Supporting pane: below up to `medium`, beside at 360px from `expanded`, 412px from `large` |
| Dashboard                      | Feed; columns follow pane width                                                            |
| Guest booking                  | Price summary below on compact and `medium`, sticky side pane from `expanded`              |
| Public calendar                | Single pane                                                                                |

Window margins are 16px on compact and 24px from `medium`, with a 24px spacer between panes. Content caps: admin 1600px, guest 1200px, form and reading columns ~40rem.

Rationale: [Adaptive layout rules per window size](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/34).

## Colour

Colour comes only from semantic tokens ([ADR 0003](docs/adr/0003-semantic-only-colour-tokens.md)). Values live once, as OKLCH, in `:root` and `.dark` in `src/index.css`. Dark mode is the `.dark` class on `<html>`, driven by `useUIStore` (light, dark or system).

- **Status is a tinted pill**: `bg-success text-success-foreground` and likewise for `warning`, `info` and `danger`. Neutral uses `muted`. Status always carries a text label.
- **`danger` and `destructive` are different roles.** `danger` is the tinted pill (Cancelled). `destructive` is the solid fill for an irreversible action button.
- **`brand`** (sand) marks identity: the logo, the active nav item, the calendar ramp. **`primary`** (timber) is for interaction: buttons, links, focus rings, downpayment emphasis.
- **Availability** uses `availability-high`, `-medium` and `-low` for 3, 2 and 1 cabins left. Booked days are `muted` with a hatch. The "3 left" / "Full" text carries the meaning, and colour backs it up.
- **The admin sidebar** uses the `sidebar-*` tokens in both themes. It isn't a dark-mode island.
- Overlays use `bg-overlay`; cards use `shadow-card`, floating surfaces `shadow-popover`.

A new token joins the contrast test's pair list in the same change.

Rationale: [Semantic token architecture](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/32).

## Type

Two faces: **Figtree** (`font-sans`) for everything, and **Bricolage Grotesque** (`font-display`) for headings only, at 600–700. Sizes are Tailwind's default steps up to `4xl`, with `text-xs` (12px) as the floor. `font-bold` is for headings; emphasis in body text uses `font-medium` or `font-semibold`.

| Role               | Admin                             | Guest                              |
| ------------------ | --------------------------------- | ---------------------------------- |
| Hero               | —                                 | display 4xl / 700 (3xl on compact) |
| Page title         | display 2xl / 600                 | display 3xl / 600                  |
| Section heading    | display lg / 600                  | display xl / 600                   |
| Body               | sans sm / 400                     | sans base / 400                    |
| Label / meta       | sans xs / 500                     | sans sm / 500                      |
| Table cell         | sans sm / 400, tabular            | —                                  |
| KPI / money figure | display 3xl / 600, tabular        | sans lg / 600, tabular             |
| Form input         | base on compact, sm from `medium` | base                               |

Inputs stay at 16px or more on compact windows, which prevents iOS zoom on focus. Figtree has no ₱ glyph, so the `sans` stack falls through to Bricolage for it (see the comment in `src/index.css`).

Rationale: [Type scale and font loading](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/36).

## Data formatting

- Money goes through `formatCurrency` (`src/lib/formatters.ts`), which gives `₱2,500.00`. Money is right-aligned in tables and uses `tabular-nums`.
- `tabular-nums` is the default inside the `DataTable`, money and date patterns. Figures elsewhere opt in. Data uses Figtree; there is no monospace face.

## Motion and density

**Density is chosen per pattern** on the default 4px spacing scale. One set of tokens, no density mode.

| Spacing                                   | Admin                    | Guest                   |
| ----------------------------------------- | ------------------------ | ----------------------- |
| Inline gap (icon and label, button group) | 2                        | 2                       |
| Form field stack                          | 4                        | 4                       |
| Card padding                              | 4                        | 6                       |
| Gap between cards                         | 4                        | 6                       |
| Page section gap                          | 6                        | 12 (16 from `expanded`) |
| `DataTable` row                           | 40px (`py-2`, `text-sm`) | —                       |

**Targets.** Every interactive primitive is at least 24px, and 44px under `coarse:` on every surface (icon buttons via `min-w-11`, clickable table rows included). Control heights are shared across surfaces: `sm` 32px, `default` 36px, `lg` 44px, with inputs matching buttons at each size. Primary actions in the guest booking flow use `lg`.

**Motion is feedback, never decoration.** Animate overlay enter and exit (dialog, sheet, popover, dropdown, select, toast), colour and opacity on hover and press, accordion and collapsible height, skeleton pulse, and spinners. Routes, list order, numbers and scrolling stay still. Speeds: `duration-150` for state changes; overlays enter in 200ms `ease-out` and exit in 150ms `ease-in`. Keyframes come from `tw-animate-css`. The global `prefers-reduced-motion` rule in `src/index.css` is the backstop, and it leaves spinners running.

Rationale: [Motion and density per surface](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/44).

## Review checklist

These checks can't be automated; check each one in the diff. Source for the rest: [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines), distilled in [Research: Vercel Web Interface Guidelines distilled](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/29).

1. Arbitrary size and spacing values (`w-[…]`, `p-[…]`, `gap-[…]`) come with a reason; the default scale is the first choice.
2. `className` passed to a pattern sets placement only.
3. Status and availability read correctly with colour removed: there's a text label.
4. Each new screen covers its empty, loading, error and long-content states. Skeletons match the final layout.
5. Long user content (guest names, notes, references) wraps or truncates: `min-w-0`, `truncate`, `break-words`.
6. Filters, tabs, pagination and open panels live in the URL (route `validateSearch`).
7. Destructive actions confirm through `AlertDialog` or offer undo. Booking and payment state updates after the server confirms, never optimistically.
8. Submit stays enabled until submission starts, then shows a spinner and keeps its label while in flight.
9. Errors sit next to their field, and submit focuses the first one.
10. Inputs set the right `type`, `inputMode` and `autoComplete`. Emails, codes and booking references turn `spellCheck` off.
11. Long or multi-step forms warn about unsaved changes (`useBlocker`).
12. Icon-only buttons have an `aria-label`; decorative icons are `aria-hidden`.
13. Help is inline text first; tooltips are the last resort.
14. Nested radii shrink inward: a child's radius is at most its parent's.
15. Hover, press and focus states raise contrast over the resting state.
16. Sticky bars leave the focused element visible (`scroll-padding` or `scroll-margin`).
17. Every gesture (swipe, drag) also has a tap or keyboard path.
18. Animations use `transform` and `opacity` and can be interrupted mid-way.
19. Labels are specific verbs ("Confirm booking", "Record payment"), copy is active voice, counts are numerals, and error messages say how to fix the problem.
20. Wording fits a family-run place: "check in" and "your stay", not "front desk" or "reception".

## Enforcement map

The single list of what fails `npm run verify`. Rules marked "review" are the checklist above. Legacy violations are frozen in `eslint-suppressions.json` (ESLint bulk suppressions), which can only shrink: fixing a violation fails lint until `npx eslint --prune-suppressions` runs. Clearing them is the Migration effort's job, not a condition for editing a file.

| Rule                                                                       | Enforcer                                              |
| -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Palette classes (`bg-blue-500`, `text-white`) and `font-mono`              | `better-tailwindcss/no-restricted-classes`            |
| Classes Tailwind can't resolve                                             | `better-tailwindcss/no-unknown-classes`               |
| Arbitrary colours (`bg-[#…]`, `text-[oklch(…)]`, `[color:…]`)              | `better-tailwindcss/no-restricted-classes`            |
| Arbitrary text sizes (`text-[…]`)                                          | `better-tailwindcss/no-restricted-classes`            |
| Arbitrary durations (`duration-[…]`)                                       | `better-tailwindcss/no-restricted-classes`            |
| Default breakpoints (`sm:`…`2xl:`, `max-md:`); touch targets use `coarse:` | `better-tailwindcss/no-restricted-classes`            |
| `transition-all`, `focus:` rings, `<img>` without `width`/`height`         | `design/no-restricted-syntax`                         |
| `@/components/ui/*` imported outside `src/components/patterns/`            | `design/no-restricted-imports`                        |
| Retired width hooks (`useResponsiveView`, `useMediaQuery`)                 | `design/no-restricted-imports`                        |
| Accessible markup (labels, keyboard handlers, alt, anchors)                | `jsx-a11y` recommended, with the shadcn component map |
| Token contrast pairs, light and dark (4.5:1; `input` and `ring` 3:1)       | contrast test in `src/styles/`                        |
| Zoom not disabled; `theme-color` matches the background                    | `index.html` test                                     |
| Everything in the [Review checklist](#review-checklist)                    | review                                                |

Rationale: [Enforcement, adoption and the enterprise-ui skill](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/35).

## Reference

### Hearth palette

A human reference only. `src/index.css` is the source of truth and holds these values as OKLCH.

| Role                         | Light                  | Dark                   |
| ---------------------------- | ---------------------- | ---------------------- |
| Background                   | `#F5F1EC`              | `#1C1816`              |
| Card                         | `#FFFFFF`              | `#26201D`              |
| Foreground                   | `#2A2421`              | `#F2EBE4`              |
| Muted / muted-foreground     | `#F5F1EC` / `#6B5F57`  | `#2A2320` / `#B3A69B`  |
| Primary / primary-foreground | `#8A5530` / `#FFFFFF`  | `#D9A77C` / `#2A1D12`  |
| Secondary                    | `#EFE8E0`              | `#302824`              |
| Accent                       | `#F3E6D8`              | `#3A2E26`              |
| Brand / brand-foreground     | `#D19C70` / `#1A1410`  | `#D9A77C` / `#1A1410`  |
| Sidebar / sidebar-foreground | `#2A2421` / `#F2EBE4`  | `#141110` / `#F2EBE4`  |
| Sidebar-primary / foreground | `#D19C70` / `#1A1410`  | `#D9A77C` / `#1A1410`  |
| Sidebar-accent / border      | `#3A322D` / `#3D3530`  | `#2A2320` / `#2A2320`  |
| Border                       | `#E8E1D8`              | `#3A312C`              |
| Input                        | `#9E8774`              | `#7A6C62`              |
| Ring                         | `#8A5530`              | `#D9A77C`              |
| Destructive / foreground     | `#B23A2E` / `#FFFFFF`  | `#D0574A` / `#141110`  |
| Success (fg on bg)           | `#2F7A4F` on `#EAF4EE` | `#86CFA2` on `#1D2C23` |
| Warning (fg on bg)           | `#8A5800` on `#FBF1DF` | `#E9B45A` on `#2F2414` |
| Danger (fg on bg)            | `#B23A2E` on `#FBECEA` | `#F2948A` on `#36201D` |
| Info (fg on bg)              | `#2B6A8F` on `#E8F2F7` | `#8CC4E4` on `#1A2A33` |

### Hand-synced hex copies

These files can't read CSS variables. When the background token changes, update them in the same commit.

| File                   | Field                                                             | Value     |
| ---------------------- | ----------------------------------------------------------------- | --------- |
| `index.html`           | `<meta name="theme-color" media="(prefers-color-scheme: light)">` | `#F5F1EC` |
| `index.html`           | `<meta name="theme-color" media="(prefers-color-scheme: dark)">`  | `#1C1816` |
| `public/manifest.json` | `theme_color`, `background_color`                                 | `#F5F1EC` |
