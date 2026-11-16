import { parseISO } from "date-fns";
import { Check } from "lucide-react";

import { DateRangePicker, type DateRange } from "@/components/patterns";
import { pickedDay, type StaffBookingSource } from "@/lib/bookings";
import { cn } from "@/lib/utils";
import type { Unit } from "@/types";

import { CabinPicker } from "../CabinPicker";
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
        cabins={draft.cabins}
        onChange={(cabins) => update({ cabins })}
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
