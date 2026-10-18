# Research: Tailwind v4 semantic tokens and palette removal with shadcn

Ticket: #30 (map #27). Date: 2026-10-18. Versions checked: `tailwindcss` / `@tailwindcss/vite` 4.3.3 (installed), `shadcn` CLI 4.22.0 (latest on npm), `tailwind-merge` ^3.7.0.

Method: primary docs (tailwindcss.com, ui.shadcn.com, tailwind-merge docs via context7), shadcn CLI source (`shadcn-ui/ui` `packages/registry/src`), the live shadcn registry JSON, and compile experiments against the repo's installed Tailwind (`@tailwindcss/node` `compile()`), plus `shadcn add --dry-run` against a scratch copy of this repo's `components.json` / `package.json` / `src/index.css`. Claims marked **[tested]** were reproduced; **[source]** were read in code; **[docs]** are quoted from official docs.

## 1. How the default palette is removed

Inside `@theme`, setting a namespace to `initial` removes every default value in it [docs: https://tailwindcss.com/docs/theme]:

```css
@theme {
  --color-*: initial; /* drop the whole default palette */
  --color-midnight: #121063;
}
```

> "all of the default utilities that use that namespace (like `bg-red-500`) will be removed, and only your custom values (like `bg-midnight`) will be available."

`--*: initial` drops the entire default theme (spacing, fonts, radii, shadows...), which is far more than the palette; not recommended here.

### What `--color-*: initial` removes and keeps [tested, Tailwind 4.3.3]

| Class                                                        | After reset                                                                                             |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `bg-orange-500`, `border-neutral-200`, any `{hue}-{shade}`   | gone                                                                                                    |
| `bg-white`, `text-white`, `bg-black/80`                      | **gone** (`--color-black`/`--color-white` live in the `--color-*` namespace, `theme.css` lines 322-323) |
| `bg-transparent`, `text-current`, `inherit`                  | kept (built-in keywords, not theme vars)                                                                |
| `border`, `ring-2`, `divide-y`, `ring-offset-2`, `shadow-lg` | kept; `ring-*` falls back to `currentcolor`; shadows use hard-coded `rgb(0 0 0 / x)`, not color vars    |
| Preflight (borders, placeholder)                             | unaffected; placeholder uses `color-mix(currentcolor ...)`                                              |
| Your tokens, with opacity (`bg-primary/50`)                  | work; compiled to `color-mix(in oklab, var(--primary) 50%, transparent)`                                |

## 2. What breaks in this repo

There are two ways it fails, and the difference matters for enforcement:

1. **`@apply` with a removed class fails the build.** [tested] `Cannot apply unknown utility class 'border-neutral-200'`. `src/styles/enterprise-tables.css` is `@import`ed from `src/index.css` and has **34 `@apply` lines** using `neutral-*`, `blue-*`, `gray-*`, `red-*`, `green-*`, `white`, `black`. Removing the palette fails `vite build` until that file is migrated. Only `.enterprise-table*` and `.enterprise-form` have consumers (`src/components/tables/utils.tsx`); `kpi-card`, `mobile-table-card`, `table-action-button`, `booking-reference`, `unit-code`, `php-currency`, `inline-edit-trigger`, `filter-active`, `table-skeleton*` have **no** `.tsx` consumers, so they can be deleted rather than migrated.
2. **Class names in TSX fail silently.** [tested] An unknown class in markup just generates no CSS: no error and no warning. Today `grep` finds **1,465 palette-class occurrences in 153 files** under `src/` (regex `(bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|shadow|decoration)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)`; the map's ~1,107/114 used a narrower pattern). All of them would render unstyled. Nothing in the toolchain catches this today: `prettier-plugin-tailwindcss` only sorts, and there is no Tailwind ESLint plugin.

The silent proof is already in the repo: `card.tsx` variants `ocean`, `coral`, `sand`, `palm`, `sunset` use `bg-ocean-50` etc., and `glass` / `gradient-*` use utility classes. None of these are defined anywhere (`@theme` has no such colors, and no CSS defines `.glass` or `.gradient-ocean`), so these variants render unstyled today and nothing flagged it.

### In `src/components/ui` (29 primitives)

- `badge.tsx` `warning`: `bg-orange-500 text-white hover:bg-orange-600 dark:bg-orange-600 ...`
- `alert.tsx` `warning`: `yellow-*` throughout
- `button.variants.ts` `destructive`: `text-white`
- `sheet.tsx` overlay: `bg-black/80`
- `card.tsx`: `text-white`, `border-white/20` (plus the dead resort variants above)
- `skeleton.tsx`: ~25 `neutral-*` / `white` / `blue-600` usages (it is a pattern-like file, not a stock primitive)

Stock shadcn v4 components need only **`black` and `white`**. [tested against the live registry `ui.shadcn.com/r/styles/new-york-v4/*.json`] Overlays (`dialog`, `sheet`, `alert-dialog`, `drawer`) use `bg-black/50`; `button` and `badge` `destructive` use `text-white`. `switch`, `checkbox`, `calendar`, `sonner`, `chart`, `tooltip` and `input` use tokens only. So a palette-free theme that keeps stock primitives working must either re-declare `--color-black` / `--color-white` after the reset, or replace those uses with tokens (e.g. `--overlay`, `destructive-foreground`).

### Raw CSS and third-party libraries

- `src/components/ui/responsive-date-picker.css` uses `hsl(var(--accent))`, `hsl(var(--primary))` and `hsl(var(--ring))`, which assume the **legacy bare-triplet** format (`--accent: 210 40% 96.1%`). It does not depend on the palette, but it **breaks when tokens move to full color values** (`hsl(oklch(...))` is invalid). Change it to `var(--accent)` in the same change.
- `src/styles/calendar.css` (hard-coded `rgb()`) and `print.css` (hex): unaffected by the reset, but they bypass tokens, so dark mode and enforcement need to cover them.
- A raw `var(--color-red-500)` in CSS stays in the output but resolves to nothing after the reset. [tested] No such references exist in `src/` today, apart from READMEs.
- `sonner`: the stock shadcn wrapper maps `--normal-bg: var(--popover)` etc. to tokens, so it works. **But** the repo's `sonner.tsx` uses `next-themes` `useTheme()`, and there is no `ThemeProvider` anywhere in `src/` (the theme lives in `useUIStore`), so the toaster theme is always `"system"`. This is a separate dark-mode wiring bug.
- `react-day-picker` via shadcn `calendar.tsx`: tokens only.
- `cmdk`, Radix: unstyled. `lucide-react`: `currentColor`.
- `recharts`: not installed. If `chart` is added later, it uses `--chart-1..5` and a `THEMES = { light: "", dark: ".dark" }` map, so it needs the `.dark` class strategy.
- Tailwind v4 does not scan `node_modules`, and `index.css` has no `@source` / `@plugin`, so no third-party package contributes Tailwind classes.
- `tailwind-merge` v3: custom `--color-*` names merge correctly with **no config** [docs, tailwind-merge configuration.md]. Custom **non-color** namespaces do need `extendTailwindMerge`. For example, a `--text-body` font size conflicts with `text-*` colors unless registered under `theme.text`. This matters if the token set adds type-scale names.

## 3. Current state of dark mode in this repo

- `src/index.css` puts **hard-coded** `hsl(...)` values in a plain `@theme` block. `bg-primary` compiles to `var(--color-primary)`, which is the fixed light value [tested]. The `:root` / `.dark` blocks in `@layer base` define `--primary` etc. as bare triplets that **no utility reads**, so `.dark` changes nothing for utilities. Only `responsive-date-picker.css` reads them.
- `src/stores/useUIStore.ts` (`initializeTheme`, called in `App.tsx`) **does** add `.dark` to `<html>` when the OS is dark (default `"system"`).
- Tailwind's `dark:` variant defaults to `@media (prefers-color-scheme: dark)` [docs + tested], not the `.dark` class, and `index.css` has no `@custom-variant dark`. So the 63 `dark:` usages in 11 files follow the OS media query. For example, `badge` warning `dark:bg-orange-600` and button outline `dark:bg-input/30` fire over light-valued tokens. An OS-dark user gets a mix of light tokens and dark overrides, and a manual "light" choice in the store cannot suppress them.

## 4. Recommended wiring (shadcn v4 convention)

From the shadcn Tailwind v4 guide [docs: https://ui.shadcn.com/docs/tailwind-v4] and theming page [docs: https://ui.shadcn.com/docs/theming]. The CLI's own CSS writer [source: `packages/registry/src/updaters/update-css-vars.ts`] emits exactly this shape:

```css
@import "tailwindcss";
@import "tw-animate-css"; /* see note below */

@custom-variant dark (&:is(.dark *)); /* what the CLI writes; Tailwind docs show (&:where(.dark, .dark *)) */

:root {
  /* top level, NOT inside @layer base */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  /* ... */
  --radius: 0.625rem;
}
.dark {
  --background: oklch(0.145 0 0);
  /* ... */
}

@theme inline {
  --color-*: initial; /* our addition, not shadcn's */
  --color-background: var(--background);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... */
  --radius-lg: var(--radius);
}
```

Key facts:

- **Use `@theme inline` whenever a theme var references another var.** [docs] "Without using `inline`, your utility classes might resolve to unexpected values because of how variables are resolved in CSS." With `inline`, `bg-primary` compiles straight to `var(--primary)`, so swapping `.dark` values works at runtime [tested: `.bg-primary/50 { background-color: color-mix(in oklab, var(--primary) 50%, transparent) }`].
- **Values are full colors (OKLCH), not bare triplets.** shadcn: "HSL colors are now converted to OKLCH." Upgrade path: move `:root` / `.dark` out of `@layer base`, wrap values in a color function, and reference them from `@theme inline` without `hsl()`.
- **Dark mode uses the class strategy**: `@custom-variant dark (&:is(.dark *))` or the Tailwind docs' `(&:where(.dark, .dark *))`. `:where` has zero specificity; `:is(.dark *)` does not match the `<html class="dark">` element itself. Either works with `useUIStore` toggling `.dark` on `<html>`. To avoid a flash of the wrong theme, Tailwind recommends an inline `<head>` script that sets the class from `localStorage` / `matchMedia` before paint.
- **Naming convention** [docs: theming]: a surface token plus a `-foreground` pair ("the base token controls the surface color and the `-foreground` token controls the text and icon color that sits on that surface"; the `-background` suffix is dropped). Stock set: `background`, `foreground`, `card(-foreground)`, `popover(-foreground)`, `primary(-foreground)`, `secondary(-foreground)`, `muted(-foreground)`, `accent(-foreground)`, `destructive`, `border`, `input`, `ring`, `chart-1..5`, `sidebar`, `sidebar-foreground`, `sidebar-primary(-foreground)`, `sidebar-accent(-foreground)`, `sidebar-border`, `sidebar-ring`, `radius`. Current v4 shadcn **dropped `destructive-foreground`** (buttons use `text-white`). The repo still has it, which is harmless.
- **Adding app tokens** (e.g. `warning`, `success`, `info`, status colors) follows the documented pattern: define them in `:root` and `.dark`, then map them in `@theme inline` as `--color-warning: var(--warning)`. This gives `bg-warning text-warning-foreground`.
- `@theme` vs `:root` [docs]: "Use `@theme` when you want a design token to map directly to a utility class, and use `:root` for defining regular CSS variables that shouldn't have corresponding utility classes." Only used theme vars are emitted unless you use `@theme static`.
- **Animations**: shadcn v4 replaced `tailwindcss-animate` with `tw-animate-css`. **Neither is installed here**, so `animate-in`, `fade-in-0` etc. in 7 primitives (`dialog`, `sheet`, `popover`, `select`, `dropdown-menu`, `hover-card`, `alert-dialog`) are dead classes today. Current shadcn also imports `shadcn/tailwind.css` (accordion keyframes and `data-open`, `data-closed`, `data-checked` custom variants) in its `index` style item.

## 5. shadcn CLI compatibility and `components.json` drift

- **Tailwind version detection does not use `tailwind.config`.** [source: `get-project-info.ts` `getTailwindVersion`] It returns `v4` if `tailwind.config === ""`, otherwise it checks `package.json` and returns v4 unless `tailwindcss` matches `^3`. With `^4.3.3`, the CLI treats the repo as v4. `updateTailwindConfig` returns early for v4 [source: `update-tailwind-config.ts` "No tailwind config in v4."]. **So the missing `tailwind.config.ts` is never read and causes no error.** It is misleading only; the docs say "For Tailwind CSS v4, leave this blank."
- **`"style": "default"` is the real drift.** [tested with `shadcn@4.22.0 add dialog --dry-run --view`] With `style: default`, the CLI fetches the legacy v3-era `default` registry: `React.forwardRef`, `bg-black/80`, and `animate-in` classes that depend on the uninstalled plugin. With `style: new-york` and `config: ""`, the same command fetches the v4 components (12 `data-slot` attributes, `bg-black/50`, no `forwardRef`). Docs: "The `default` style has been deprecated. Use the `new-york` style instead." and style "cannot be changed after initialization". In practice, editing the field changes what future `add` commands fetch. Existing files are not rewritten, and new-york differs visually (e.g. `h-9` vs `h-10` buttons).
- **`baseColor: "slate"`** is no longer in the documented list (`neutral, stone, zinc, mauve, olive, mist, taupe`), although `r/colors/slate.json` is still served. It only seeds tokens at `init`. With a hand-authored token set it is irrelevant, apart from being a reason not to re-run `init`.
- **How `shadcn add` edits `src/index.css`** [source: `update-css-vars.ts`]. It runs only when a registry item ships `cssVars` (e.g. `sidebar` adds 16 vars [tested dry-run]; `button`/`dialog` add none):
  - It looks for a **top-level** `:root` / `.dark` rule (`root.nodes.find(... selector === ":root")`). The repo's are nested in `@layer base`, so the CLI would **append a second top-level `:root` / `.dark`**.
  - It looks for `@theme` with params exactly `inline`. The repo has a plain `@theme`, so it would **append a new `@theme inline`** block.
  - It adds `@custom-variant dark (&:is(.dark *))` only if **no** `@custom-variant` exists at all.
  - It never overwrites existing vars for components (`overwriteCssVars` is true only for `registry:style` / `registry:theme`), and it **never writes or removes `--color-*: initial`**. A palette reset placed inside the `@theme inline` block survives CLI edits.
  - So adopting the canonical layout (top-level `:root` / `.dark`, one `@theme inline`, one `@custom-variant dark`) is what keeps the CLI's edits clean.
- **Are stock primitives palette-free?** Nearly. The only default-palette classes in current new-york-v4 components are `bg-black/50` and `text-white` (section 2). The CLI does not rewrite classes against your theme. Any future registry component (or third-party registry) that uses palette classes would render partially unstyled with no error. The enforcement lint has to cover `src/components/ui` too.

## 6. Implications for the token-architecture grilling (#32)

- Palette removal is feasible, but it is **a build-breaking change (34 `@apply` lines) plus a silent-breakage change (1,465 TSX usages)**. It cannot ship before the migration unless it is gated or staged.
- Removing the palette alone does not enforce anything in TSX. A lint rule is required: `eslint-plugin-better-tailwindcss` supports v4 and has `no-unknown-classes` and `no-restricted-classes` (pointer only, not evaluated here).
- Keep `black` / `white` (re-declared after the reset) or tokenize overlay and on-destructive text, so stock primitives keep working.
- Dark mode needs three fixes together: `@custom-variant dark` (class), `@theme inline` + top-level `:root` / `.dark` with full color values, and one theme source (`useUIStore` vs `next-themes` in `sonner.tsx`).
- `components.json`: set `tailwind.config` to `""` and decide whether to switch `style` to `new-york` (this affects future `add` output only).

## Not verified

- No full `shadcn add` was applied, so the CSS edits in section 5 come from reading the source, not from an observed diff. (`--dry-run --diff` printed no CSS diff.)
- No visual or contrast check of OKLCH values. Production build and runtime were not exercised.
- `eslint-plugin-better-tailwindcss` configuration (CSS entry point) and its false-positive rate were not tested.
- The occurrence counts are regex-based. They include READMEs and test files under `src/`, and they miss dynamically built class strings.
