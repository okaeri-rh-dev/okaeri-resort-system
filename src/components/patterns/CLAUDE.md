# Patterns: authoring rules

This folder is the kit's public half. `index.ts` is the only import point for product code and the catalogue of what exists; read it before adding anything. Vocabulary and the wider rules are in `DESIGN.md` (Components).

## What may be a pattern

All three must hold:

1. **Domain-free.** No booking, payment, guest or cabin types, names or statuses. Take generic props instead: `StatusBadge` takes a `tone` (`success` | `warning` | `danger` | `info` | `neutral`), and the status → tone mapping lives in the product layer (`src/lib/status-tone.ts`).
2. **Fetch-free.** No queries, stores, Supabase calls or route loaders. Data comes in through props.
3. **Two or more uses.** A composition used once stays in its feature folder. The exceptions named in DESIGN.md qualify with one use: `AppShell`, `PageHeader`, `DataTable`, `StatusBadge`, `Callout`, `FormField`, `DatePicker`.

## How a pattern is written

- One pattern per file, exported by name from `index.ts` together with its props type.
- `className` is for placement only: margin, width, grid or flex position. Colour, type and radius come through a variant prop (`tone`, `emphasis`, `surface`), never through a class the caller passes.
- Style with tokens only. The design lint rules apply here with no suppressions: a new file in this folder must lint clean.
- Compose primitives from `@/components/ui/*`; this folder and `ui/` are the only places allowed to import them. Edits to a primitive itself go in `ui/` and are logged in `ui/README.md`.
- Give every export TSDoc: what it is, when to use it, and an `@example`. That TSDoc is the usage documentation; there is no separate README.
- Accessibility is part of the pattern: icon-only buttons get an `aria-label`, decorative icons `aria-hidden`, loading states are a named `role="status"`, and status always carries a text label.

## Tests

Each pattern has a test in `__tests__/` that imports it from `@/components/patterns` (never the file path), checks rendered output and roles rather than class strings, and includes an `axe` check (`vitest-axe`). For overlays, check the open state too. A modal Radix overlay aria-hides the page, so run axe on the overlay element itself.
