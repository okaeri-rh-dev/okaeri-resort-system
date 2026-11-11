import { parseISO } from "date-fns";
import { Check, Minus, Plus, X } from "lucide-react";

import { Button, DateRangePicker, type DateRange } from "@/components/patterns";
import { pickedDay, type StaffBookingSource } from "@/lib/bookings";
import { cn } from "@/lib/utils";
import type { Unit } from "@/types";

import type { Draft, Update } from "./draft";

const SOURCES: { value: StaffBookingSource; hint: string }[] = [
  { value: "Direct", hint: "Phone, Messenger, a repeat guest" },
  { value: "Walk-in", hint: "The guest is here now" },
  { value: "Airbnb", hint: "Booked and paid on Airbnb" },
];

export function StayStep({
  units,
  draft,
  update,
  nights,
  isChecking,
  notFree,
}: {
  units: Unit[];
  draft: Draft;
  update: Update;
  nights: number;
  isChecking: boolean;
  notFree: (unitId: string) => string | null;
}) {
  return (
    <>
      <SourceChoice
        value={draft.source}
        onChange={(source) =>
          update({ source, method: undefined, payout: "", confirmationCode: "" })
        }
      />
      <StayDates draft={draft} nights={nights} update={update} />
      <CabinPicker
        units={units}
        draft={draft}
        update={update}
        hasDates={nights > 0}
        isChecking={isChecking}
        notFree={notFree}
      />
    </>
  );
}

function SourceChoice({
  value,
  onChange,
}: {
  value: StaffBookingSource;
  onChange: (source: StaffBookingSource) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Booking source</legend>
      <div className="medium:grid-cols-2 grid gap-2" role="radiogroup" aria-label="Booking source">
        {SOURCES.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "border-border coarse:min-h-11 rounded-lg border p-3 text-left text-sm duration-150",
                selected ? "border-primary bg-accent" : "hover:bg-muted"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {selected && <Check className="size-4" aria-hidden="true" />}
                {option.value}
              </span>
              <span className="text-muted-foreground block text-xs">{option.hint}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function StayDates({ draft, nights, update }: { draft: Draft; nights: number; update: Update }) {
  const value: DateRange | undefined = draft.checkIn
    ? {
        from: parseISO(draft.checkIn),
        to: draft.checkOut ? parseISO(draft.checkOut) : undefined,
      }
    : undefined;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Stay dates</p>
      <DateRangePicker
        value={value}
        aria-label="Stay dates"
        placeholder="Check-in → check-out"
        numberOfMonths={2}
        startHint="Select check-in day"
        endHint="Select check-out day"
        allowSameDay={false}
        onChange={(range) => {
          const checkIn = range?.from && pickedDay(range.from);
          const checkOut = range?.to && pickedDay(range.to);
          update({
            checkIn,
            checkOut: checkIn && checkOut && checkOut > checkIn ? checkOut : undefined,
          });
        }}
        className="w-full"
      />
      {nights > 0 && (
        <p className="text-muted-foreground text-xs">
          {nights} {nights === 1 ? "night" : "nights"}
        </p>
      )}
    </div>
  );
}

function GuestCount({
  value,
  max,
  cabinName,
  onChange,
}: {
  value: number;
  max: number;
  cabinName: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={`Guests in ${cabinName}`}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="coarse:min-w-11 size-8"
        aria-label={`One guest fewer in ${cabinName}`}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span className="w-16 text-center text-sm tabular-nums">
        {value} {value === 1 ? "guest" : "guests"}
      </span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="coarse:min-w-11 size-8"
        aria-label={`One guest more in ${cabinName}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Every cabin with its availability for the picked dates; all cabins share the dates. */
function CabinPicker({
  units,
  draft,
  update,
  hasDates,
  isChecking,
  notFree,
}: {
  units: Unit[];
  draft: Draft;
  update: Update;
  hasDates: boolean;
  isChecking: boolean;
  notFree: (unitId: string) => string | null;
}) {
  const setGuests = (unitId: string, guests: number) =>
    update({ cabins: draft.cabins.map((c) => (c.unitId === unitId ? { ...c, guests } : c)) });

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Cabins</legend>
      {!hasDates && (
        <p className="text-muted-foreground text-sm">Pick the dates first to see free cabins.</p>
      )}
      <ul className="space-y-2">
        {units.map((unit) => {
          const picked = draft.cabins.find((c) => c.unitId === unit.unit_id);
          const reason = notFree(unit.unit_id);
          const canAdd = hasDates && !isChecking && !reason;
          return (
            <li
              key={unit.unit_id}
              className={cn(
                "border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm",
                picked && "border-primary bg-accent"
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{unit.unit_name}</p>
                <p className={cn("text-xs", reason ? "text-destructive" : "text-muted-foreground")}>
                  {!hasDates
                    ? `Up to ${unit.max_occupancy} guests`
                    : isChecking
                      ? "Checking…"
                      : (reason ?? `Free · up to ${unit.max_occupancy} guests`)}
                </p>
              </div>
              {picked ? (
                <div className="flex items-center gap-2">
                  <GuestCount
                    cabinName={unit.unit_name}
                    value={picked.guests}
                    max={unit.max_occupancy}
                    onChange={(guests) => setGuests(unit.unit_id, guests)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="coarse:min-w-11 size-8"
                    aria-label={`Remove ${unit.unit_name}`}
                    onClick={() =>
                      update({ cabins: draft.cabins.filter((c) => c.unitId !== unit.unit_id) })
                    }
                  >
                    <X aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canAdd}
                  aria-label={`Add ${unit.unit_name}`}
                  onClick={() =>
                    update({
                      cabins: [
                        ...draft.cabins,
                        { unitId: unit.unit_id, guests: Math.min(2, unit.max_occupancy) },
                      ],
                    })
                  }
                >
                  <Plus aria-hidden="true" />
                  Add
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
