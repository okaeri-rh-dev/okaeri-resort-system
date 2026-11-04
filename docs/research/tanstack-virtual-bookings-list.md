# Virtualizing the bookings list with TanStack Virtual

Research for [#302](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/302), child of map [#297](https://github.com/okaeri-rh-dev/okaeri-resort-system/issues/297). Researched 2026-11-04.

Sources are pinned to TanStack/virtual commit `11b48e4` (main on 2026-11-04), written below as `TV@11b48e4`. Base URL: `https://github.com/TanStack/virtual/blob/11b48e4ab8b08d483c8fe29a31ef11261ffbda04/`.

## Answer

Use `@tanstack/react-virtual` 3.14.x with `useVirtualizer` (element scroll), not `useWindowVirtualizer`. The admin shell scrolls `<main>`, not the window. Flatten the groups into one list of header items and booking items. Keep the current group header rendered with a custom `rangeExtractor`, which is the documented sticky pattern. On phone, measure each card with `measureElement`. On desktop, keep the semantic `<table>` and use spacer rows, as in the official table example. TanStack Virtual renders no markup and has no accessibility features, so `aria-rowcount` / `aria-rowindex` (table) or `aria-setsize` / `aria-posinset` (cards) are ours to add. It supports React 19. It costs about 10.5 KB gzipped.

Two caveats matter most. First, CSS sticky will not stick to `<main>` today: `DataTable` wraps the table in `overflow-hidden` and `overflow-auto` boxes. Second, the scroll element (`<main>`) lives in `AppShell`, outside `DataTable`, so the list needs a way to reach it and a `scrollMargin` for the filters above it.

## How the list renders today

- `BookingsTable` (`src/components/bookings/BookingsTable/index.tsx`) renders `BookingFilters`, then the shared `DataTable` pattern, then `TablePagination`.
- `useBookingsTable` fetches every booking with `useBookings()`, filters in memory, and paginates with `getPaginationRowModel` at 10 rows per page (`hooks/useBookingsTable.ts:132-151`).
- `DataTable` (`src/components/patterns/DataTable.tsx`) measures its own width. Below 600px it renders a `<ul>` of cards (`renderCard` → `BookingCard`) with `space-y-4`. At 600px and up it renders a `<table>` with 40px rows. One form renders at a time.
- The table sits inside `div.overflow-hidden.rounded-md.border`, and the `Table` primitive wraps `<table>` in `div.relative.w-full.overflow-auto` (`src/components/ui/table.tsx:7`).
- `AppShell` makes the page `h-dvh` and scrolls `<main className="... flex-1 overflow-y-auto">` (`src/components/patterns/AppShell.tsx:491,601`). The window does not scroll in the admin app.
- `BookingsTable` is lazy-loaded by the route (`src/routes/admin/bookings.tsx:20`).

## Grouped lists with sticky group headers

TanStack Virtual has no grouping concept. The official sticky example flattens groups into one array where each group label is its own item (`examples/react/sticky/src/main.tsx:9-19`, TV@11b48e4).

The pattern:

1. Record the indexes of the header items (`stickyIndexes`).
2. Pass a `rangeExtractor` that finds the last header at or before `range.startIndex`, adds it to `defaultRangeExtractor(range)`, and returns the sorted set (`sticky/src/main.tsx:40-55`). The API doc says `rangeExtractor` exists for "rendering sticky items, headers, footers, etc." (`docs/api/virtualizer.md:143-149`).
3. Render the active header with `position: sticky; top: 0` and every other item with `position: absolute` plus `translateY(start)` (`sticky/src/main.tsx:81-99`).

Caveats:

- The example uses fixed 50px items (`estimateSize: () => 50`) and sets `height: virtualRow.size` on every item. It does not combine sticky headers with `measureElement`. Mixing the two is not shown in any official example.
- The active-header index lives in a ref that `rangeExtractor` mutates during the virtualizer's range calculation (`sticky/src/main.tsx:24,42`). That works, but it is a side effect inside a calculation.
- The `rangeExtractor` must be stable (`useCallback`), as in the example.
- The example only sticks one header at a time; there is no "push up" handoff between headers.
- The groups the map names ("Needs action", "In-house", …) are few. An alternative is one virtualizer per group in the same scroll element, each with its own `scrollMargin`. The doc names "multiple virtualizers … within a single scrolling element" as a `scrollMargin` use case (`docs/api/virtualizer.md:207-219`). Plain CSS sticky would then work per section. This is my inference; there is no official example of it, and each `scrollMargin` must be re-measured when the sections above change height.

## Rows of varying height (phone cards)

Dynamic measurement is first-class:

- Attach `ref={virtualizer.measureElement}` and `data-index={item.index}` to each item (`docs/api/virtualizer.md:542-559`). The default measurement is `getBoundingClientRect()`, and a `ResizeObserver` re-measures on resize.
- `estimateSize` is required. For measured items the doc says to "estimate the largest possible size" (`docs/api/virtualizer.md:31-39`).
- Set `getItemKey` to the booking id and memoize it. The default key is the index, and the doc says to override it when possible (`docs/api/virtualizer.md:133-141`). This matters when filters change.
- Use the `gap` option for the space between cards (`docs/api/virtualizer.md:221-227`). Absolutely positioned items ignore `space-y-4` margins.
- When an item above the viewport changes size, the virtualizer corrects the scroll position, but not while the user scrolls backward. This avoids jumps on scroll-up (`shouldAdjustScrollPositionOnItemSizeChange`, `docs/api/virtualizer.md:581-605`). iOS WebKit defers these writes until a touch or momentum scroll ends (same section).
- For `scrollToIndex` with smooth scrolling, the doc prefers "block translation": translate the whole rendered block by the first item's `start`, not each item (`docs/api/virtualizer.md:433-435`).
- If the list is hidden with `display: none` (for example a closed tab), set `useCachedMeasurements` so measurements are not reset to 0 (`docs/api/virtualizer.md:353-367`).
- The official dynamic example sets `overflowAnchor: 'none'` and `contain: 'strict'` on its scroll element (`examples/react/dynamic/src/main.tsx:68-77`). We cannot set `contain: strict` on `<main>` without checking side effects on the rest of the shell.

## Fit with TanStack Table for the dense table layout

The official `table` example combines `useReactTable` and `useVirtualizer` (`examples/react/table/src/main.tsx`, TV@11b48e4):

- Take `rows` from `table.getRowModel()` and pass `count: rows.length` (`:78-87`). Sorting and filtering stay in TanStack Table; the virtualizer only windows the final row model.
- "Table rows can't be absolutely positioned", so it renders a spacer `<tr>` above and below the visible rows. Their heights are `virtualRows[0].start` and `getTotalSize() - lastRow.end` (`:91-98`, `:141-167`, `:178-181`). This keeps a real `<table>` with a sticky `<thead>`.
- It uses `estimateSize: () => 34` and `overscan: 20`. Our rows are 40px, so `estimateSize: () => 40`.

What changes in our code (inference, not tested):

- Drop `getPaginationRowModel` and `TablePagination` when the list virtualizes. `DataTable` renders `table.getRowModel().rows`, so the row model must be unpaginated.
- `DataTable` should virtualize both forms (cards and table) from the same row model. Switching form changes item sizes, so the virtualizer should be re-measured (`measure()`, `docs/api/virtualizer.md:502`) or remounted on switch.
- Sticky group headers in a table: the sticky example's absolute positioning does not apply to `<tr>`. A group header would be a full-width `<tr>` whose cells are `position: sticky` with `top` equal to the `<thead>` height. If `rangeExtractor` keeps the active header rendered, the top spacer must be computed from the first non-header visible row, not `virtualRows[0]`. No official example covers this.
- `DataTable` is a shared pattern. Putting the virtualizer in it adds the library to every page chunk that uses `DataTable`. A `virtualize` prop or a separate pattern keeps it to the bookings chunk.

## Window scroll vs container scroll

- `useWindowVirtualizer` targets the window and needs `scrollMargin` for content above the list (`examples/react/window/src/main.tsx:16-21`).
- `useVirtualizer` takes `getScrollElement` (`docs/api/virtualizer.md:23-29`).
- The admin shell scrolls `<main>`, not the window (`AppShell.tsx:491,601`), so `useWindowVirtualizer` does not fit. Use `useVirtualizer` with `getScrollElement` returning `<main>`, and `scrollMargin` equal to the list's offset inside `<main>` (filters and page header above it). The doc suggests measuring `scrollMargin` with `getBoundingClientRect()` or a `ResizeObserver` when content above can change height (`docs/api/virtualizer.md:213-219`). Our filter bar can wrap or grow, so measure it.
- Item transforms then subtract `options.scrollMargin` (`docs/api/virtualizer.md:213-218`).
- `DataTable` has no handle on `<main>`. Options are `ref.closest("main")`, or a context from `AppShell`. Giving the list its own fixed-height scroll box would avoid this but adds a second scrollbar inside the page, which the map's phone layout probably does not want.
- CSS sticky sticks to the nearest ancestor with a scrolling box, and `overflow: hidden` or `auto` creates one even when it does not scroll ([CSS Positioned Layout 3, sticky positioning](https://www.w3.org/TR/css-position-3/#stickypos-insets)). The `overflow-hidden` wrapper and the `overflow-auto` table wrapper in `DataTable` would therefore trap a sticky `<thead>` or group header. One fix is `overflow: clip` for the rounded border (`clip` does not make a scroll container, [CSS Overflow 3](https://www.w3.org/TR/css-overflow-3/#valdef-overflow-clip)). The `overflow-auto` wrapper exists for sideways scrolling on narrow panes, and `DataTable` reads its `scrollWidth` to hide low-priority columns (`DataTable.tsx:121-128`), so removing it needs a decision.

## Keyboard and screen readers

TanStack Virtual is headless and "does not ship with or render any markup" (`docs/introduction.md:5`). Its docs, examples, and core source contain no ARIA or focus handling (searched `docs/`, `examples/react/*`, `packages/virtual-core/src/index.ts` at TV@11b48e4 for `aria`, `role=`, `tabindex`, `focus`: no hits). Everything below is ours to build.

- Table form: put `aria-rowcount` on `<table>` with the total row count including header rows, and `aria-rowindex` on each rendered `<tr>`, 1-based. This is the ARIA way to say rows are missing from the DOM ([WAI-ARIA 1.2 `aria-rowcount`](https://www.w3.org/TR/wai-aria-1.2/#aria-rowcount), [`aria-rowindex`](https://www.w3.org/TR/wai-aria-1.2/#aria-rowindex)). Spacer rows should be `aria-hidden` (inference).
- Card form: put `aria-setsize` and `aria-posinset` on each `<li>` ([WAI-ARIA 1.2 `aria-setsize`](https://www.w3.org/TR/wai-aria-1.2/#aria-setsize), [`aria-posinset`](https://www.w3.org/TR/wai-aria-1.2/#aria-posinset); `listitem` supports both).
- Group headers should count in neither total if they are not bookings, or be marked as headings. The spec does not decide this for us.
- Focus: a focused row or open row menu that scrolls out of range unmounts, and focus falls to `<body>`. `rangeExtractor` can keep the focused index rendered, the same way the sticky example keeps the header (inference from `docs/api/virtualizer.md:143-149`; not tested).
- Browser find (Ctrl+F) cannot find bookings that are not rendered. The search box must stay.
- None of this was tested with a screen reader.

## Bundle size and React 19

- Latest: `@tanstack/react-virtual@3.14.26`, depending on `@tanstack/virtual-core@3.19.11`, published 2026-11-03 (`npm view @tanstack/react-virtual`).
- Peer deps: `react` and `react-dom` `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` (`npm view`). The repo is on `react ^19.3.0` and `@tanstack/react-table ^8.21.3` (`package.json:96,105,107`). React Virtual does not depend on React Table, so their versions do not interact.
- Size: bundling `useVirtualizer`, `useWindowVirtualizer`, and `defaultRangeExtractor` from 3.14.26 with esbuild (minify, ESM, React external) gives 35,458 bytes minified and 10,738 bytes gzipped. Measured locally 2026-11-04; tree-shaking in Vite may differ slightly. The route lazy-loads `BookingsTable`, so the cost lands in that chunk unless the shared `DataTable` imports it.
- React 19 `flushSync` warning: the React adapter calls `flushSync` by default (`useFlushSync = true`, `packages/react-virtual/src/index.tsx:80`). The React docs say React 19 can warn "flushSync was called from inside a lifecycle method", and `useFlushSync: false` removes it at the cost of more blank space during fast scrolls with measured items (`docs/framework/react/react-virtual.md:38-75`; changelog `packages/react-virtual/CHANGELOG.md:287-292`). Version 3.14.13 stopped calling `flushSync` from the `measureElement` ref path, the main source of that warning (`packages/react-virtual/CHANGELOG.md:102`).
- The adapter also offers `directDomUpdates`, which writes positions to the DOM and skips React re-renders on scroll (`packages/react-virtual/src/index.tsx:40-73`). It requires absolutely positioned items, so it does not fit the spacer-row table. Not needed at our list sizes.
- The repo does not use the React Compiler (no `babel-plugin-react-compiler` in `package.json` or `vite.config.ts`), so compiler memoization of the mutable virtualizer instance is not a concern today.

## Not verified

- No prototype was built. The spacer-row table with a sticky group header, and `measureElement` combined with sticky headers, are inferences.
- No screen reader or keyboard test.
- Bundle size was measured with esbuild, not this repo's Vite build.
- How many bookings the list will hold was not checked, so whether virtualization pays for itself over a plain long list is open.
- `overflow: clip` as a fix for the sticky trap was not tried in `DataTable`.

## Decisions Needed

1. Scroll element: virtualize against `AppShell`'s `<main>` with `scrollMargin` (recommended), or give the list its own scroll box.
2. Grouping: one flattened list with `rangeExtractor` sticky headers (recommended, documented pattern), or one virtualizer per group.
3. Where it lives: a `virtualize` option on `DataTable` (recommended, one place for both forms), or a bookings-only list component.
4. Sticky trap: replace `overflow-hidden` with `overflow-clip` and drop the table's `overflow-auto` wrapper when virtualized (recommended), accepting no sideways scroll in that mode.
5. `useFlushSync`: keep the default `true` (recommended) and set `false` only if the React 19 warning shows up.
