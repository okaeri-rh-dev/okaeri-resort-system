/**
 * PROTOTYPE V1 Agenda — one list grouped Needs action / In-house / Arriving this week / Later, with
 * Past and Cancelled folded at the bottom. Compact rows at every width, one status action per row.
 */
import { useState } from "react";

import { PageHeader, TableSearch } from "@/components/patterns";
import { cn } from "@/lib/utils";

import {
  dayKey,
  formatStay,
  hasBalanceDue,
  matchesFilters,
  needsAction,
  nightsOf,
  TODAY,
  type ProtoBooking,
} from "./fixture";
import { useProtoSearch } from "./search";
import {
  BalanceButton,
  BookingOverflow,
  CabinList,
  DetailSheet,
  FiltersSheetButton,
  NewBookingButton,
  NewBookingSheet,
  PrimaryActionButton,
} from "./shared";
import { useProtoStore } from "./store-context";

const WEEK_END = dayKey(7);
const PAGE = 10;

function groupOf(b: ProtoBooking) {
  if (needsAction(b)) return "action";
  if (b.status === "CheckedIn") return "inhouse";
  if (b.status === "Confirmed") return b.checkIn < WEEK_END ? "week" : "later";
  if (b.status === "Cancelled") return "cancelled";
  return "past";
}

function AgendaRow({ booking }: { booking: ProtoBooking }) {
  const { setSearch } = useProtoSearch();
  return (
    <li className="border-border bg-card flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2">
      <button
        type="button"
        onClick={() => setSearch({ sel: booking.id, panel: undefined })}
        className="coarse:min-h-11 min-w-48 flex-1 text-left"
      >
        <span className="block truncate text-sm font-semibold">{booking.guestName}</span>
        <span className="text-muted-foreground block truncate text-xs tabular-nums">
          {formatStay(booking)} · {nightsOf(booking)}n · <CabinList booking={booking} />
          {booking.source === "walk-in" && " · walk-in"}
          {booking.status === "Pending" && " · pending"}
        </span>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {hasBalanceDue(booking) && <BalanceButton booking={booking} />}
        <PrimaryActionButton booking={booking} />
        <BookingOverflow booking={booking} />
      </div>
    </li>
  );
}

function Section({
  title,
  bookings,
  empty,
  paged,
}: {
  title: string;
  bookings: ProtoBooking[];
  empty?: string;
  paged?: boolean;
}) {
  const [shown, setShown] = useState(paged ? 0 : Infinity);
  if (bookings.length === 0 && !empty) return null;
  const visible = bookings.slice(0, shown);

  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="font-display text-muted-foreground flex items-baseline gap-2 text-sm font-semibold tracking-wide uppercase">
        {title}
        <span className="tabular-nums">{bookings.length}</span>
      </h2>
      {bookings.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-4 text-sm">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((b) => (
            <AgendaRow key={b.id} booking={b} />
          ))}
        </ul>
      )}
      {paged && shown < bookings.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className={cn("text-primary coarse:min-h-11 text-sm font-medium hover:underline")}
        >
          {shown === 0 ? `Show ${title.toLowerCase()}` : "Show more"} ({bookings.length - shown}{" "}
          left)
        </button>
      )}
    </section>
  );
}

export function V1Agenda() {
  const { bookings } = useProtoStore();
  const { search, setSearch, filters } = useProtoSearch();
  const matching = bookings.filter((b) => matchesFilters(b, filters));

  const byGroup = (group: string) => matching.filter((b) => groupOf(b) === group);
  const byCheckIn = (a: ProtoBooking, b: ProtoBooking) => a.checkIn.localeCompare(b.checkIn);
  const latestFirst = (a: ProtoBooking, b: ProtoBooking) => b.checkIn.localeCompare(a.checkIn);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Bookings"
        description={`Today is ${TODAY}`}
        actions={<NewBookingButton />}
      />
      <div className="flex gap-2">
        <TableSearch
          value={search.q ?? ""}
          onChange={(q) => setSearch({ q: q || undefined })}
          placeholder="Search name, reference or phone"
          className="flex-1"
        />
        <FiltersSheetButton />
      </div>

      <Section
        title="Needs action"
        bookings={byGroup("action").sort(byCheckIn)}
        empty="Nothing to do."
      />
      <Section
        title="In-house"
        bookings={byGroup("inhouse").sort(byCheckIn)}
        empty="No one is staying tonight."
      />
      <Section
        title="Arriving this week"
        bookings={byGroup("week").sort(byCheckIn)}
        empty="No arrivals this week."
      />
      <Section title="Later" bookings={byGroup("later").sort(byCheckIn)} />
      <Section title="Past" bookings={byGroup("past").sort(latestFirst)} paged />
      <Section title="Cancelled" bookings={byGroup("cancelled").sort(latestFirst)} paged />

      <DetailSheet bookings={bookings} />
      <NewBookingSheet />
    </div>
  );
}
