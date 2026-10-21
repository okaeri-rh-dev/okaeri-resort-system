/**
 * PROTOTYPE V3 Cabin timeline — cabins × days with stay bars. Tap a bar to open the booking, tap an
 * empty day to start a booking on that cabin. Pending guest bookings have no cabin yet, so they sit
 * in an "Unassigned" lane. The stays in range are listed below the grid.
 */
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button, PageHeader, TableSearch } from "@/components/patterns";
import { cn } from "@/lib/utils";

import {
  CABINS,
  dayKey,
  formatStay,
  matchesFilters,
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

const SPANS = [7, 14, 30] as const;

const barTone: Record<string, string> = {
  CheckedIn: "bg-success text-success-foreground",
  Confirmed: "bg-info text-info-foreground",
  Pending: "bg-warning text-warning-foreground",
  CheckedOut: "bg-muted text-muted-foreground",
};

interface Lane {
  key: string;
  label: string;
  cabin?: string;
  bookings: ProtoBooking[];
}

function placeUnassigned(pending: ProtoBooking[]) {
  const lanes: ProtoBooking[][] = [];
  for (const b of [...pending].sort((x, y) => x.checkIn.localeCompare(y.checkIn))) {
    const free = lanes.find((lane) => lane.every((o) => o.checkOut <= b.checkIn));
    if (free) free.push(b);
    else lanes.push([b]);
  }
  return lanes;
}

export function V3Timeline() {
  const { bookings } = useProtoStore();
  const { search, setSearch, filters } = useProtoSearch();
  const span = search.span ?? 14;
  const from = search.from ?? -1;
  const start = dayKey(from);
  const end = dayKey(from + span);
  const days = Array.from({ length: span }, (_, i) => dayKey(from + i));

  const live = bookings.filter((b) => b.status !== "Cancelled");
  const inRange = live.filter((b) => b.checkIn < end && b.checkOut > start);
  const unassigned = placeUnassigned(inRange.filter((b) => b.cabins.length === 0));

  const lanes: Lane[] = [
    ...CABINS.map((c) => ({
      key: c.code,
      label: c.name,
      cabin: c.code,
      bookings: inRange.filter((b) => b.cabins.includes(c.code)),
    })),
    ...unassigned.map((laneBookings, i) => ({
      key: `unassigned-${i}`,
      label: i === 0 ? "Unassigned" : "",
      bookings: laneBookings,
    })),
  ];

  const listed = inRange
    .filter((b) => matchesFilters(b, filters))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const listedIds = new Set(listed.map((b) => b.id));

  const columnOf = (date: string) => differenceInCalendarDays(parseISO(date), parseISO(start)) + 2;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bookings"
        description={`Today is ${TODAY}`}
        actions={<NewBookingButton />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Earlier"
            onClick={() => setSearch({ from: from - span })}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={() => setSearch({ from: undefined })}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Later"
            onClick={() => setSearch({ from: from + span })}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <div role="group" aria-label="Days shown" className="flex gap-1">
          {SPANS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={span === s ? "default" : "outline"}
              aria-pressed={span === s}
              onClick={() => setSearch({ span: s })}
            >
              {s} days
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground text-sm tabular-nums">
          {format(parseISO(start), "MMM d")} – {format(addDays(parseISO(end), -1), "MMM d")}
        </span>
      </div>

      <div className="border-border bg-card overflow-x-auto rounded-xl border">
        <div
          role="grid"
          aria-label="Cabin timeline"
          className="grid"
          style={{
            gridTemplateColumns: `6rem repeat(${span}, minmax(2.75rem, 1fr))`,
            minWidth: `${6 + span * 2.75}rem`,
          }}
        >
          <div className="bg-card border-border sticky left-0 z-20 border-r border-b" />
          {days.map((day, i) => (
            <div
              key={day}
              className={cn(
                "border-border border-b px-1 py-2 text-center text-xs tabular-nums",
                day === TODAY && "bg-accent font-semibold"
              )}
              style={{ gridColumn: i + 2, gridRow: 1 }}
            >
              <div className="text-muted-foreground">{format(parseISO(day), "EEEEE")}</div>
              <div>{format(parseISO(day), "d")}</div>
            </div>
          ))}

          {lanes.map((lane, laneIndex) => {
            const row = laneIndex + 2;
            return [
              <div
                key={`${lane.key}-label`}
                className="bg-card border-border sticky left-0 z-20 flex items-center border-r border-b px-3 text-sm font-medium"
                style={{ gridColumn: 1, gridRow: row }}
              >
                {lane.label}
              </div>,
              ...days.map((day, i) => {
                const bookable = lane.cabin && day >= TODAY;
                return bookable ? (
                  <button
                    key={`${lane.key}-${day}`}
                    type="button"
                    aria-label={`New booking, ${lane.label}, ${day}`}
                    onClick={() => setSearch({ new: true, newCabin: lane.cabin, newFrom: day })}
                    className={cn(
                      "border-border hover:bg-accent h-12 border-b border-l",
                      day === TODAY && "bg-accent/50"
                    )}
                    style={{ gridColumn: i + 2, gridRow: row }}
                  />
                ) : (
                  <div
                    key={`${lane.key}-${day}`}
                    className={cn(
                      "border-border h-12 border-b border-l",
                      !lane.cabin && "bg-muted/40"
                    )}
                    style={{ gridColumn: i + 2, gridRow: row }}
                  />
                );
              }),
              ...lane.bookings.map((b) => {
                const first = Math.max(2, columnOf(b.checkIn));
                const last = Math.min(span + 2, columnOf(b.checkOut));
                return (
                  <button
                    key={`${lane.key}-${b.id}`}
                    type="button"
                    onClick={() => setSearch({ sel: b.id, panel: undefined })}
                    aria-label={`${b.guestName}, ${formatStay(b)}, ${b.status}`}
                    className={cn(
                      "z-10 mx-0.5 my-1.5 min-w-0 truncate rounded-md px-2 text-left text-xs font-medium duration-150",
                      barTone[b.status],
                      !listedIds.has(b.id) && "opacity-30",
                      search.sel === b.id && "ring-ring ring-2"
                    )}
                    style={{ gridColumn: `${first} / ${last}`, gridRow: row }}
                  >
                    {b.guestName}
                  </button>
                );
              }),
            ];
          })}
        </div>
      </div>

      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span
            className="bg-success border-success-foreground/40 mr-1 inline-block size-3 rounded-sm border align-middle"
            aria-hidden="true"
          />
          In-house
        </span>
        <span>
          <span
            className="bg-info border-info-foreground/40 mr-1 inline-block size-3 rounded-sm border align-middle"
            aria-hidden="true"
          />
          Confirmed
        </span>
        <span>
          <span
            className="bg-warning border-warning-foreground/40 mr-1 inline-block size-3 rounded-sm border align-middle"
            aria-hidden="true"
          />
          Pending
        </span>
        <span>Tap an empty day to start a booking.</span>
      </p>

      <div className="flex gap-2">
        <TableSearch
          value={search.q ?? ""}
          onChange={(q) => setSearch({ q: q || undefined })}
          placeholder="Search name, reference or phone"
          className="flex-1"
        />
        <FiltersSheetButton />
      </div>

      <section aria-label="Stays in range" className="space-y-2">
        <h2 className="font-display text-muted-foreground text-sm font-semibold tracking-wide uppercase">
          Stays in range <span className="tabular-nums">{listed.length}</span>
        </h2>
        {listed.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No stays in these days. Search covers only the days shown.
          </p>
        ) : (
          <ul className="divide-border border-border bg-card divide-y rounded-xl border">
            {listed.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSearch({ sel: b.id, panel: undefined })}
                  className="coarse:min-h-11 min-w-48 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-semibold">{b.guestName}</span>
                  <span className="text-muted-foreground block truncate text-xs tabular-nums">
                    {formatStay(b)} · {nightsOf(b)}n · <CabinList booking={b} />
                  </span>
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <BalanceButton booking={b} />
                  <PrimaryActionButton booking={b} />
                  <BookingOverflow booking={b} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DetailSheet bookings={bookings} />
      <NewBookingSheet />
    </div>
  );
}
