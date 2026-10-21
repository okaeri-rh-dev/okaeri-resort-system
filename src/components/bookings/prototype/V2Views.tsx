/**
 * PROTOTYPE V2 Views + side pane — a dense table with view tabs and visible filter chips. From
 * `expanded` (840px of page width) the selected booking opens in a side pane beside the list;
 * narrower, it opens in a full-screen sheet. Breaks DESIGN.md's "admin lists are single-pane".
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { X } from "lucide-react";

import {
  Button,
  DataTable,
  ListCard,
  PageHeader,
  StatusBadge,
  TableEmptyState,
  TableSearch,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

import {
  activeFilterCount,
  balanceOf,
  formatStay,
  hasBalanceDue,
  matchesFilters,
  needsAction,
  nightsOf,
  primaryActionOf,
  TODAY,
  type ProtoBooking,
} from "./fixture";
import { useProtoSearch, type ProtoSearch } from "./search";
import {
  BalanceButton,
  BookingDetail,
  BookingOverflow,
  CabinList,
  DetailSheet,
  FilterChoices,
  FiltersSheetButton,
  NewBookingButton,
  NewBookingSheet,
  PrimaryActionButton,
} from "./shared";
import { useProtoStore } from "./store-context";

type View = NonNullable<ProtoSearch["view"]>;

const TWO_PANE_MIN_WIDTH = 840;
const PAGE = 20;

const views: { value: View; label: string; matches: (b: ProtoBooking) => boolean }[] = [
  {
    value: "upcoming",
    label: "Upcoming",
    matches: (b) => (b.status === "Confirmed" || b.status === "Pending") && b.checkOut > TODAY,
  },
  { value: "inhouse", label: "In-house", matches: (b) => b.status === "CheckedIn" },
  { value: "action", label: "Needs action", matches: needsAction },
  { value: "past", label: "Past", matches: (b) => b.status === "CheckedOut" },
  { value: "cancelled", label: "Cancelled", matches: (b) => b.status === "Cancelled" },
];

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

function GuestCell({ booking }: { booking: ProtoBooking }) {
  const { search, setSearch } = useProtoSearch();
  const selected = search.sel === booking.id;
  return (
    <button
      type="button"
      onClick={() => setSearch({ sel: booking.id, panel: undefined })}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "block max-w-56 min-w-0 text-left hover:underline",
        selected && "text-primary font-semibold"
      )}
    >
      <span className="block truncate font-medium">{booking.guestName}</span>
      <span className="text-muted-foreground block text-xs">
        {booking.reference}
        {booking.source === "walk-in" && " · walk-in"}
      </span>
    </button>
  );
}

const columns: ColumnDef<ProtoBooking>[] = [
  { id: "guest", header: "Guest", cell: ({ row }) => <GuestCell booking={row.original} /> },
  {
    id: "stay",
    header: "Stay",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatStay(row.original)} · {nightsOf(row.original)}n
      </span>
    ),
  },
  { id: "cabins", header: "Cabins", cell: ({ row }) => <CabinList booking={row.original} /> },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge {...statusBadgeProps(row.original.status, "Pending")} />,
  },
  {
    id: "balance",
    header: "Balance",
    meta: { align: "right" },
    cell: ({ row }) =>
      balanceOf(row.original) > 0 && row.original.status !== "Pending"
        ? formatCurrency(balanceOf(row.original))
        : "—",
  },
  {
    id: "action",
    header: () => <span className="sr-only">Actions</span>,
    meta: { pinned: true },
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-1">
        <PrimaryActionButton booking={row.original} />
        <BookingOverflow booking={row.original} />
      </div>
    ),
  },
];

function BookingCardV2({ booking }: { booking: ProtoBooking }) {
  return (
    <ListCard className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <GuestCell booking={booking} />
        <div className="flex items-center gap-1">
          <StatusBadge {...statusBadgeProps(booking.status, "Pending")} />
          <BookingOverflow booking={booking} />
        </div>
      </div>
      <p className="text-muted-foreground text-sm tabular-nums">
        {formatStay(booking)} · {nightsOf(booking)}n · <CabinList booking={booking} />
      </p>
      {(primaryActionOf(booking) || hasBalanceDue(booking)) && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          <BalanceButton booking={booking} />
          <PrimaryActionButton booking={booking} />
        </div>
      )}
    </ListCard>
  );
}

export function V2Views() {
  const { bookings } = useProtoStore();
  const { search, setSearch, filters } = useProtoSearch();
  const pageRef = useRef<HTMLDivElement>(null);
  const twoPane = useWidth(pageRef) >= TWO_PANE_MIN_WIDTH;
  const view = search.view ?? "upcoming";
  const [shown, setShown] = useState(PAGE);

  const matching = useMemo(
    () => bookings.filter((b) => matchesFilters(b, filters)),
    [bookings, filters.q, filters.cabin, filters.pay, filters.src]
  );
  const counts = Object.fromEntries(
    views.map((v) => [v.value, matching.filter(v.matches).length])
  ) as Record<View, number>;

  const allRows = useMemo(() => {
    const current = views.find((v) => v.value === view) ?? views[0];
    const latestFirst = view === "past" || view === "cancelled";
    return matching
      .filter(current.matches)
      .sort((a, b) =>
        latestFirst ? b.checkIn.localeCompare(a.checkIn) : a.checkIn.localeCompare(b.checkIn)
      );
  }, [matching, view]);
  const paged = view === "past" || view === "cancelled";
  const rows = useMemo(() => (paged ? allRows.slice(0, shown) : allRows), [allRows, paged, shown]);

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  const selected = bookings.find((b) => b.id === search.sel);

  return (
    <div ref={pageRef} className="space-y-4">
      <PageHeader
        title="Bookings"
        description={`Today is ${TODAY}`}
        actions={<NewBookingButton />}
      />

      <Tabs
        value={view}
        onValueChange={(next) => {
          setShown(PAGE);
          setSearch({ view: next as View });
        }}
      >
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {views.map((v) => (
            <TabsTrigger key={v.value} value={v.value} className="gap-1.5">
              {v.label}
              <span className="text-muted-foreground tabular-nums">{counts[v.value]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-3">
        <TableSearch
          value={search.q ?? ""}
          onChange={(q) => setSearch({ q: q || undefined })}
          placeholder="Search name, reference or phone"
          className="expanded:max-w-xs expanded:flex-none min-w-56 flex-1"
        />
        {twoPane ? <FilterChoices layout="row" /> : <FiltersSheetButton />}
        {twoPane && activeFilterCount(filters) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch({ cabin: undefined, pay: undefined, src: undefined })}
          >
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-3">
          <DataTable
            table={table}
            label={`Bookings: ${view}`}
            renderCard={(row) => <BookingCardV2 booking={row.original} />}
            emptyState={
              <TableEmptyState
                title={view === "inhouse" ? "No one is staying tonight" : "No bookings here"}
              />
            }
          />
          {paged && shown < allRows.length && (
            <Button variant="outline" onClick={() => setShown((n) => n + PAGE)}>
              Show more ({allRows.length - shown} left)
            </Button>
          )}
        </div>

        {twoPane && selected && (
          <aside
            aria-label="Selected booking"
            className="border-border bg-card shadow-card large:w-md sticky top-4 w-96 shrink-0 space-y-4 rounded-xl border p-4"
          >
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close booking"
                onClick={() => setSearch({ sel: undefined, panel: undefined })}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <BookingDetail booking={selected} />
          </aside>
        )}
      </div>

      {!twoPane && <DetailSheet bookings={bookings} />}
      <NewBookingSheet />
    </div>
  );
}
