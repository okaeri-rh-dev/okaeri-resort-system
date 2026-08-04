---
name: enterprise-ui
description: This repo's Professional Enterprise design conventions for building or reviewing UI — dense tables in nested cards, monospace data formatting, ₱ currency rules, status badges, forms, and navigation patterns. Use when creating or modifying components, tables, forms, or dashboards so new UI matches the implemented system.
---

# Professional Enterprise UI Conventions

Source of truth: `src/styles/enterprise-tables.css` (`.enterprise-table`) and the existing components (BookingsTable, ExpensesTable, UnitsTable). **When this document and the code disagree, the code wins** — update this file rather than "fixing" the app to match it.

## Philosophy

Information density over decoration. No animations except essential feedback; instant transitions. Every UI element must serve a functional purpose. Users are family members running daily operations, mostly on phones.

## Tables (nested-card structure)

```tsx
<div className="space-y-4">
  {/* Filters card: search, filters, action buttons */}
  <Card className="border-neutral-200 p-4">
    <FilterControls />
  </Card>

  {/* Table card: overflow-hidden, zero padding */}
  <Card className="overflow-hidden border-neutral-200">
    <Table>...</Table>
    <div className="border-t border-neutral-200 bg-neutral-50/30 px-4 py-3">
      <Pagination />
    </div>
  </Card>
</div>
```

- Borders are always `neutral-200` (never `gray-200`); zebra striping with `neutral-50/30`; row hover `neutral-50`.
- Sticky headers for tables taller than the viewport.
- Right-align all numeric columns for vertical scanning.
- Row height: not pinned in the CSS — match the existing table components rather than a fixed px value.
- Mobile: tables collapse to card views (see `BookingCard` for the pattern).

## Data formatting (monospace is mandatory)

Use `font-mono` for anything that benefits from character alignment:

- Currency: `₱2,500.00` — ₱ symbol, thousand separators, 2 decimals, right-aligned.
- Numeric table columns (quantities, counts, percentages — one decimal: `87.4%`).
- IDs and references: `BKG-2024-001`, `EXP-2024-089`.
- Compact dates (`Jan 15` in dense displays), phone numbers (`+63 912 345 6789`), emails in table cells.

## Color and status

- Corporate blue primary is reserved for main CTAs and active states; everything else stays neutral-gray-heavy. Maintain WCAG 4.5:1 contrast minimum.
- Status indicators are text-based badges without icons: Confirmed → blue (default), Pending → gray (secondary), Cancelled/Error → red (destructive), Success → green (accent).

## Forms

Compact: 36px input heights, 1px `neutral-200` borders, blue focus state without glow, 14px base font with 500-weight labels, minimal helper text, inline validation.

## Navigation and dashboards

- Top navigation bars, not sidebars; text-based links with minimal icons; tabs with `neutral-100` backgrounds; breadcrumbs for context.
- KPI cards in horizontal rows: 1px `neutral-200` borders, max 4px border-radius, 12px padding. Charts only where they add clear value.
