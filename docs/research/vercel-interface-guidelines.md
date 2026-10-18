# Vercel Web Interface Guidelines, distilled for this stack

Research for #29 (map #27). Question: what do the guidelines prescribe, which rules can be enforced mechanically here (ESLint flat config, TypeScript, vitest) and which belong in a DESIGN.md checklist, and which conflict with shadcn/Radix defaults.

## Sources

- **G** — guidelines text: `README.md` in [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) at commit `434b7f9` (2026-10-05). This is the content rendered at vercel.com/design/guidelines. Sections: Interactions, Animations, Layout, Content, Forms, Performance, Design, plus a "Vercel-specific" Copywriting section that the README itself says is brand preference, "not universal guidelines".
- **C** — `command.md` in the same repo: Vercel's own agent review prompt. It restates G as greppable code checks (`outline-none` without replacement, `transition: all`, `onPaste` + `preventDefault`, `<div onClick>`, …) and adds a few not in G (`text-wrap: balance` on headings, `min-w-0` on flex children, `Intl.*` over hardcoded formats). Its "Anti-patterns" list is the best seed for lint rules.
- Repo facts: `eslint.config.js`, `package.json`, `src/components/ui/*`, `index.html`, `src/index.css` on `main` at `5cd98ff`. Counts are `grep -rlE` file counts over `src/` and are approximate.
- [eslint-plugin-jsx-a11y README](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y) — v6.10.2, ships `flatConfigs.recommended`/`strict`, peer `eslint ^9`, supports a `settings["jsx-a11y"].components` map (e.g. `Button: "button"`) so rules see through wrappers.
- Sonner 2.0.8 (installed) renders its toaster section with `aria-live="polite"` (checked in `node_modules/sonner/dist/index.mjs`).

## What the stack enforces today

- ESLint: `@eslint/js`, `typescript-eslint` recommended (+ type-aware promise rules), `react-hooks`, `react-refresh`, `@tanstack/query`, and a set of `no-restricted-syntax` architecture selectors. **No `eslint-plugin-jsx-a11y`, no Tailwind class linting.** Lint runs with `--max-warnings 0`, so a rule at `warn` still fails `npm run verify`.
- vitest: `jest-axe`'s `toHaveNoViolations` is wired in `src/test/setup.ts` (plus a `vitest-axe` type shim); ~11 test files call it. axe catches missing accessible names, labels, alt, invalid ARIA and (in jsdom) not colour contrast.
- Playwright E2E exists but runs in CI only and does not gate deploy.

## Mechanical enforcement options (cheapest first)

1. **`eslint-plugin-jsx-a11y` `flatConfigs.recommended`** with `settings["jsx-a11y"].components` mapping shadcn wrappers (`Button`→`button`, `Input`→`input`, `Label`→`label`, `Textarea`→`textarea`, `Link` from TanStack Router→`a`). Covers: `alt-text`, `anchor-is-valid`, `click-events-have-key-events`, `no-static-element-interactions`, `no-noninteractive-element-interactions`, `label-has-associated-control`, `no-autofocus`, `interactive-supports-focus`, `aria-*` validity. `control-has-associated-label` (icon-only button names) is off in recommended and noisy; better left to axe.
2. **New `no-restricted-syntax` selectors** in the existing style (one per shipped-bug class), e.g. `Literal[value=/\btransition-all\b/]`, `JSXText[value=/\.\.\./]` / `Literal[value=/(Loading|Saving)\.\.\./]`, `JSXAttribute[name.name='onPaste']`, `Literal[value=/\bfocus:ring/]`, `Literal[value=/user-scalable=no|maximum-scale=1/]`. Cheap, no new dependency, but class-string matching misses `cn()` fragments built dynamically.
3. **vitest + axe on primitives and patterns** — one render-and-`toHaveNoViolations` test per kit pattern catches unnamed icon buttons, unlabeled inputs, missing alt, heading-order issues at the place every screen inherits them. Can also assert structural invariants (e.g. Button `type`, loading button keeps its label).
4. **TypeScript at the kit boundary** — make the rule unrepresentable: icon-only button component whose props require `aria-label: string`; a `LoadingButton` whose `loadingLabel` is typed; image component requiring `width`/`height`; a `Money`/`DateText` component as the only formatting path. Only works if feature code cannot import the raw primitive (relates to the map's "shadcn primitives private to the kit" idea).
5. **Unit test on static files** — `index.html` viewport has no `maximum-scale`/`user-scalable=no`; `theme-color` equals the background token; `<html>` gets `color-scheme` per theme.

## Rule classification

Legend — **L** ESLint (jsx-a11y or `no-restricted-syntax`), **V** vitest (axe/RTL/static-file test), **T** TypeScript at the kit boundary, **D** DESIGN.md checklist, **–** skip (not applicable to this stack or Vercel brand preference). Status column: ✓ already true in repo, ✗ currently violated, blank = unchecked.

### Interactions

| Rule (G)                                                                                              | Class         | Status / notes                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Keyboard works everywhere (WAI-ARIA APG)                                                              | L partial + D | jsx-a11y `click-events-have-key-events`, `no-static-element-interactions`, `interactive-supports-focus`; full flows are D (Radix covers its own widgets)                                                              |
| Clear focus; `:focus-visible` over `:focus`; `:focus-within` for groups; sticky UI never covers focus | L + D         | L: ban `focus:ring` and `outline-none` lacking a `focus-visible:` sibling. ✗ stock Dialog/Sheet close buttons use `focus:ring` (11 files use `focus:ring`). Sticky-cover is D (`scroll-padding-top`)                  |
| Manage focus (traps, move/return)                                                                     | D             | Radix Dialog/Sheet/Popover/AlertDialog do this ✓                                                                                                                                                                      |
| Hit target ≥24px; 44px on mobile                                                                      | V/T + D       | Matches map's floor. Button: `h-8`/`h-9` desktop ✓, `max-md:min-h-10/11` mobile (repo customisation; `sm` = 40px, below 44). ✗ Checkbox `size-4` (16px) has no desktop hit expansion; mobile has `after:-inset-2`     |
| Mobile input font ≥16px (or `maximum-scale=1`)                                                        | V             | ✓ Input/Textarea use `max-md:text-base`. G's alternative `maximum-scale=1` contradicts "Respect zoom" and WCAG — pick the font-size route only                                                                        |
| Respect zoom                                                                                          | V             | ✓ viewport has no `maximum-scale`; guard with a static-file test                                                                                                                                                      |
| Hydration-safe inputs                                                                                 | –             | SPA, no SSR                                                                                                                                                                                                           |
| Don't block paste                                                                                     | L             | `onPaste` ban; 0 hits today ✓                                                                                                                                                                                         |
| Loading buttons keep label + indicator                                                                | T + D         | Typed `LoadingButton` in the kit                                                                                                                                                                                      |
| Minimum loading-state duration (~150–300 ms delay, ~300–500 ms min)                                   | T + D         | Put it in one kit hook/skeleton wrapper; TanStack Query `isPending` flickers otherwise                                                                                                                                |
| URL as state / deep-link filters, tabs, pagination, panels                                            | D             | TanStack Router `validateSearch` is the mechanism; not lintable                                                                                                                                                       |
| Optimistic updates with rollback/Undo                                                                 | D             | Never for booking/payment state (map constraint)                                                                                                                                                                      |
| Ellipsis on follow-up menu items and "Loading…"                                                       | L             | `JSXText`/`Literal` selector for `...`; ✗ ~54 files contain `...` in strings (not all UI copy)                                                                                                                        |
| Confirm destructive actions or Undo                                                                   | D             | AlertDialog exists                                                                                                                                                                                                    |
| `touch-action: manipulation`; tap highlight                                                           | V (CSS)       | One base-layer rule in `src/index.css`                                                                                                                                                                                |
| Design forgiving interactions                                                                         | D             |                                                                                                                                                                                                                       |
| Tooltip timing (delay first, peers instant)                                                           | D             | Radix Tooltip `delayDuration`/`skipDelayDuration` implement exactly this; no Tooltip primitive installed yet                                                                                                          |
| `overscroll-behavior: contain` in modals/drawers                                                      | D             | Radix scroll-lock (react-remove-scroll) mostly covers; add class to Sheet if a drawer scrolls                                                                                                                         |
| Desktop rubber-band: `overscroll-behavior: none` on `html` in `@media (pointer: fine)`                | D             | Optional; PWA cares about mobile pull-to-refresh                                                                                                                                                                      |
| Scroll positions persist on Back/Forward                                                              | D             | TanStack Router `scrollRestoration` option                                                                                                                                                                            |
| Autofocus only on desktop single-input screens                                                        | L             | jsx-a11y `no-autofocus` (with `ignoreNonDOM`); 3 files use `autoFocus`                                                                                                                                                |
| No dead zones                                                                                         | D             |                                                                                                                                                                                                                       |
| Clean drag (no selection, `inert`)                                                                    | D             | No drag UI today                                                                                                                                                                                                      |
| Gestures have click/keyboard alternatives (WCAG 2.5.7)                                                | D             |                                                                                                                                                                                                                       |
| Links are links                                                                                       | L             | jsx-a11y `anchor-is-valid` + selector banning `onClick` that calls `navigate(` on non-`Link` elements (heuristic)                                                                                                     |
| Announce async updates (polite aria-live)                                                             | ✓ / V         | Sonner region is `aria-live="polite"` ✓; ✗ shadcn `FormMessage` (`src/components/ui/form.tsx`) has no `aria-live`/`role="alert"` (it relies on `aria-describedby`) — fix in the primitive, V test on the form pattern |
| Locale-aware keyboard shortcuts                                                                       | –             | No shortcuts                                                                                                                                                                                                          |

### Animations

| Rule                                                                | Class | Status / notes                                                                                                  |
| ------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Honor `prefers-reduced-motion`                                      | ✓     | Global reduce rule in `src/index.css`                                                                           |
| Prefer CSS > WAAPI > JS libs                                        | D     |                                                                                                                 |
| Compositor-friendly (`transform`/`opacity`)                         | D     |                                                                                                                 |
| Necessity check, easing fits subject, interruptible, correct origin | D     | Feeds the open "motion per surface" question on the map                                                         |
| Autoplay >5 s needs pause/stop/hide                                 | D     |                                                                                                                 |
| **Never `transition: all`**                                         | L     | `transition-all` selector. ✗ 9 files, including stock shadcn `buttonVariants` and `TabsTrigger` (see conflicts) |
| SVG transforms on `<g>` with `transform-box: fill-box`              | D     |                                                                                                                 |

### Layout

| Rule                                                                | Class     | Notes                                                                                              |
| ------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------- |
| Optical alignment, deliberate alignment, balanced icon/text lockups | D         |                                                                                                    |
| Responsive coverage incl. ultra-wide                                | D         | Ties to Material 3 window size classes ticket                                                      |
| Safe areas (`env(safe-area-inset-*)`)                               | ✓ / D     | Already used (Toaster offset, body padding)                                                        |
| No excessive scrollbars                                             | D         |                                                                                                    |
| Let the browser size things (flex/grid over JS measurement)         | L partial | Selector could flag `getBoundingClientRect`/`offsetHeight` in components (C lists them); heuristic |

### Content

| Rule                                                                   | Class          | Notes                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inline help first, tooltips last                                       | D              |                                                                                                                                                                                                                        |
| Stable skeletons mirror final content                                  | D              |                                                                                                                                                                                                                        |
| Accurate `<title>` per route                                           | V              | TanStack Router `head`/effect per route; test the route table. ✗ static title today                                                                                                                                    |
| No dead ends; all states designed (empty, sparse, dense, error)        | D              |                                                                                                                                                                                                                        |
| Curly quotes; avoid widows (`text-wrap: balance`/`pretty`)             | D (L possible) | Curly quotes lintable on `JSXText` but noisy; `text-balance` on headings belongs in the heading primitive                                                                                                              |
| Tabular numbers for comparisons                                        | T + D          | Bake into table/money patterns (15 files already use `tabular-nums`; enterprise-ui uses mono)                                                                                                                          |
| Redundant status cues (not colour alone)                               | T + D          | Status badge pattern requires a text label                                                                                                                                                                             |
| Icons have labels / icon-only buttons named / decoration `aria-hidden` | V + T          | axe `button-name`; typed `IconButton` requiring `aria-label`. lucide icons render without `aria-hidden` by default — kit wrapper should add it                                                                         |
| Don't ship the schema (visually hidden labels still exist)             | V              | axe `label`                                                                                                                                                                                                            |
| `…` not `...`                                                          | L              | same selector as above                                                                                                                                                                                                 |
| `scroll-margin-top` on anchored headings                               | D              |                                                                                                                                                                                                                        |
| Resilient to long user content (`truncate`, `min-w-0`, `break-words`)  | D              | Guest names, notes                                                                                                                                                                                                     |
| Locale-aware formats (`Intl.*`)                                        | L partial + T  | Single resort locale (en-PH, ₱, Asia/Manila). Enforce "format through `@/lib` helpers", not raw `toLocaleString` (28 files) — selector + typed `formatPeso`/`formatDate`. Existing `utcDateSliceSelector` is precedent |
| Language from `Accept-Language`, `translate="no"` on brand/codes       | D              | Low value: single-language app; `translate="no"` on booking refs and "Okaeri" is cheap                                                                                                                                 |
| Semantics before ARIA; headings hierarchy + skip link                  | L + V + D      | jsx-a11y + axe `heading-order`; skip link in layout shells (admin `MainLayout` only today)                                                                                                                             |
| Accessible media                                                       | –              | No media                                                                                                                                                                                                               |
| Brand resources from logo, nbsp for glued terms                        | – / D          | nbsp: `₱&nbsp;1,000`-style units in Money pattern                                                                                                                                                                      |

### Forms

| Rule                                                                                       | Class     | Notes                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter submits; ⌘/Ctrl+Enter in textarea                                                    | D         | Native `<form>` gives Enter for free                                                                                                                 |
| Labels everywhere; clicking label focuses control                                          | L + V     | jsx-a11y `label-has-associated-control` (configure `labelComponents: ["Label","FormLabel"]`, `controlComponents: ["Input","Textarea"]`); axe `label` |
| Keep submit enabled until submission starts; disable in flight + spinner + idempotency key | D         | Idempotency is backend; don't touch payment logic                                                                                                    |
| Don't block typing; don't pre-disable submit                                               | D         | Pre-disabled submit is a common react-hook-form pattern (`!isValid`); selector on `disabled={!formState.isValid}` is possible                        |
| No dead zones on checkbox/radio                                                            | T         | Checkbox+label pattern with one hit target                                                                                                           |
| Errors next to field; focus first error on submit                                          | D         | react-hook-form `shouldFocusError` defaults true ✓ when fields register refs                                                                         |
| `autocomplete` + meaningful `name`                                                         | V partial | jsx-a11y `autocomplete-valid` validates values only; presence is D                                                                                   |
| Spellcheck off for emails/codes; correct `type`/`inputmode`                                | D         | Could be typed `EmailInput`/`PhoneInput` patterns                                                                                                    |
| Placeholders end with `…` and show example                                                 | D         | Repo Input styles placeholders italic at 60% opacity (custom) — contrast check needed                                                                |
| Unsaved-changes warning                                                                    | D         | TanStack Router `useBlocker`                                                                                                                         |
| Password managers/OTP paste; no PM trigger on non-auth fields                              | D         |                                                                                                                                                      |
| Trim trailing whitespace                                                                   | D         | zod `.trim()` in schemas                                                                                                                             |
| Native `<select>` explicit bg/colour (Windows dark)                                        | –         | Radix Select, not native                                                                                                                             |

### Performance

All **D** (profiling practice) except: image `width`/`height` (L: selector on `JSXOpeningElement[name.name='img']` lacking both attributes), virtualise large lists (D), preload/subset fonts (D, feeds typography ticket), `POST/PATCH/DELETE` <500 ms (D; Cloudflare Pages Functions budget), Web Workers (D).

### Design

| Rule                                                                                        | Class | Notes                                                                                                                            |
| ------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| Layered shadows, crisp semi-transparent borders, hue-tinted borders on coloured backgrounds | D     | Token decisions (shadow and border tokens)                                                                                       |
| Nested radii (child ≤ parent, concentric)                                                   | D     | Card-in-card tables (enterprise-ui) violate easily; radius tokens                                                                |
| Colour-blind-friendly chart palettes                                                        | D     |                                                                                                                                  |
| **Prefer APCA over WCAG 2 contrast**                                                        | D     | **Conflicts with map's WCAG 2.2 AA floor** — keep WCAG 4.5:1 as the gate, APCA optional as a second opinion                      |
| Interactions increase contrast (hover/active/focus)                                         | D     | ✓ shadcn hovers mostly darken; `outline`/`ghost` use `bg-accent` (slate-100) — low delta                                         |
| `theme-color` matches page background                                                       | V     | ✗ `index.html` `#0066cc` vs white background (one of the map's three conflicting primaries). Needs light + dark `media` variants |
| `color-scheme: dark` on `<html>` in dark theme                                              | V     | ✗ not set; dark mode not wired                                                                                                   |
| Text anti-aliasing under transforms, gradient banding                                       | D     |                                                                                                                                  |

### Vercel-specific copywriting (G says brand preference)

Treat as **–** unless DESIGN.md adopts them deliberately. Worth adopting: active voice, specific button labels ("Save Booking" not "Continue"), numerals for counts, error messages state the fix, consistent currency decimals (₱ already has rules in enterprise-ui). Not obviously right here: **Title Case on buttons/headings** (decide), **`&` over "and"** (decide), second person only.

## Conflicts with shadcn/Radix defaults

1. **`transition-all` in stock shadcn** — `buttonVariants` base class and `TabsTrigger` ship `transition-all` (current shadcn v4 output). G: "Never `transition: all`". Fix in the primitive (`transition-[color,background-color,border-color,box-shadow]`), which also means diverging from upstream regeneration.
2. **`focus:` instead of `focus-visible:` on Dialog/Sheet close buttons** — stock shadcn uses `focus:ring-2 focus:outline-none`, so a pointer click shows a ring. G prefers `:focus-visible`.
3. **`outline-none` + box-shadow ring** — G/C accept it when a ring replaces it, but Tailwind v4's `outline-none` sets `outline-style: none`, and box-shadow rings disappear in Windows forced-colours mode; Tailwind v4's `outline-hidden` keeps a transparent outline for that case. Minor; worth one line in DESIGN.md if the kit is touched anyway.
4. **Checkbox / Switch / Radio hit targets** — stock shadcn Checkbox is 16px with no hit-area expansion; below G's 24px exception and WCAG 2.5.8. Repo only expands on `max-md`. Resolve with the label-as-hit-target pattern.
5. **Button `sm` on mobile = 40px**, `default` desktop = 36px — fine for 24px, short of 44px in the PWA for `sm`. Repo-level, not upstream.
6. **G's own internal conflict**: "Mobile input size" offers `maximum-scale=1` as an alternative, which "Respect zoom" and WCAG 1.4.4 forbid. Use 16px inputs (already done).
7. **APCA vs WCAG 2** — not shadcn, but conflicts with the map's stated floor.
8. **Pre-disabled submit / pointer-events** — shadcn `disabled:pointer-events-none` is fine, but common shadcn form examples gate submit on validity, which G forbids.

Not conflicts (Radix already satisfies G): focus trap/return in Dialog, Sheet, AlertDialog, Popover, DropdownMenu, Select; keyboard patterns per APG; Tooltip delay/skip-delay; scroll lock; Sonner polite live region.

## Takeaways for the enforcement grilling

- Roughly a quarter of G is mechanically checkable here; most of it is design judgement and belongs in DESIGN.md as a short checklist (G is ~110 bullets — too long to paste; agents won't read it).
- Biggest single win: add `eslint-plugin-jsx-a11y` recommended with the shadcn component map. It plugs straight into the existing flat config and `--max-warnings 0` gate. Expect a fix batch; the repo's guardrails pattern (warn → fix → error) still fails verify at warn because of `--max-warnings 0`, so it needs either a scoped rollout by `files` or the fix batch first.
- Second: 4–6 `no-restricted-syntax` selectors from C's anti-pattern list (`transition-all`, `focus:ring`, `...`, `onPaste`, raw `toLocaleString`, `<img>` without dimensions), matching the existing "each selector maps to a bug" convention.
- Third: axe tests at the pattern layer plus TypeScript-required props (`IconButton` `aria-label`, `LoadingButton` label) — only meaningful if primitives become private to the kit.
- Static-file tests for `index.html` (viewport, `theme-color`) are trivial and close two current violations.
- Vercel's `web-design-guidelines` agent skill / `command.md` is an LLM review prompt, not a gate; it could feed an `enterprise-ui` successor's review step but does not "fail `npm run verify`".

## Not verified

- Exact jsx-a11y violation count against this repo (not run; no `node_modules` in the research worktree).
- That vercel.com/design/guidelines renders byte-identical text to the repo README (the README links itself as the feedback source; page not fetched).
- Multi-line `<div … onClick>` usages (single-line grep found none).
