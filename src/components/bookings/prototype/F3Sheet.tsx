/**
 * PROTOTYPE F3 "Sheet, calendar first" — opens over the list in a sheet (full width on phone).
 * Step 1 is a cabin × night grid: tap a free night to start, tap a later night on the same row to
 * end the stay, tap another row inside the stay to add that cabin. Step 2 is guest + payment.
 * The step is local state: phone Back closes the sheet (and the draft) at once.
 */
import { useState } from "react";

import { getRouteApi } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";

import {
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { cabinIsFree, CABINS, dayKey, type ProtoBooking } from "./fixture";
import {
  GuestPicker,
  NotesField,
  PaymentFields,
  PriceSummary,
  SourceChoice,
  useDraft,
  type DraftApi,
} from "./new-booking";
import { useProtoSearch } from "./search";
import { useProtoStore } from "./store-context";

const protoRoute = getRouteApi("/admin/prototype/bookings");
const DAYS = 14;

function NightGrid({ api, bookings }: { api: DraftApi; bookings: ProtoBooking[] }) {
  const { draft } = api;
  const [start, setStart] = useState(() => draft.checkIn ?? dayKey(0));
  const days = Array.from({ length: DAYS }, (_, i) =>
    format(addDays(parseISO(start), i), "yyyy-MM-dd")
  );
  const nextDay = (day: string) => format(addDays(parseISO(day), 1), "yyyy-MM-dd");
  const inStay = (day: string) =>
    !!draft.checkIn && !!draft.checkOut && draft.checkIn <= day && day < draft.checkOut;

  const tap = (cabin: string, day: string) => {
    const picked = draft.cabins.some((c) => c.code === cabin);
    if (draft.checkIn && draft.checkOut && inStay(day)) {
      // Inside the stay: add or remove this cabin for the same dates.
      api.update({
        cabins: picked
          ? draft.cabins.filter((c) => c.code !== cabin)
          : [...draft.cabins, { code: cabin, guests: 2 }],
      });
      return;
    }
    if (draft.checkIn && picked && day > draft.checkIn) {
      api.update({ checkOut: nextDay(day) });
      return;
    }
    api.update({ checkIn: day, checkOut: nextDay(day), cabins: [{ code: cabin, guests: 2 }] });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Tap the first night, then the last night</p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStart(format(addDays(parseISO(start), -7), "yyyy-MM-dd"))}
          >
            ‹ Week
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setStart(format(addDays(parseISO(start), 7), "yyyy-MM-dd"))}
          >
            Week ›
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" aria-label="Free nights per cabin">
          <thead>
            <tr>
              <th className="bg-background sticky left-0 pr-2 text-left font-medium">Cabin</th>
              {days.map((day) => (
                <th key={day} className="w-9 text-center font-normal">
                  <span className="text-muted-foreground block">
                    {format(parseISO(day), "EEE")}
                  </span>
                  {format(parseISO(day), "d")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CABINS.map((cabin) => {
              const picked = draft.cabins.some((c) => c.code === cabin.code);
              return (
                <tr key={cabin.code}>
                  <th className="bg-background sticky left-0 pr-2 text-left font-medium whitespace-nowrap">
                    {cabin.name}
                  </th>
                  {days.map((day) => {
                    const free = cabinIsFree(bookings, cabin.code, day, nextDay(day));
                    const selected = picked && inStay(day);
                    return (
                      <td key={day} className="p-0.5">
                        <button
                          type="button"
                          disabled={!free}
                          aria-pressed={selected}
                          aria-label={`${cabin.name}, night of ${day}: ${
                            free ? (selected ? "picked" : "free") : "booked"
                          }`}
                          onClick={() => tap(cabin.code, day)}
                          className={cn(
                            "coarse:size-11 size-8 rounded-md border text-center duration-150",
                            !free && "bg-muted text-muted-foreground border-transparent",
                            free && !selected && "border-border hover:bg-accent",
                            selected && "bg-primary text-primary-foreground border-primary"
                          )}
                        >
                          {!free ? "×" : selected ? "✓" : ""}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground text-xs">
        × booked · ✓ picked. Tap another cabin inside the picked nights to add it on the same dates.
      </p>
    </div>
  );
}

function GuestsPerCabin({ api }: { api: DraftApi }) {
  if (api.lines.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm">
      {api.lines.map((line) => (
        <li key={line.code} className="flex items-center justify-between gap-2">
          <span>{line.name}</span>
          <select
            aria-label={`Guests in ${line.name}`}
            className="border-border bg-background h-9 rounded-md border px-2"
            value={line.guests}
            onChange={(e) =>
              api.update({
                cabins: api.draft.cabins.map((c) =>
                  c.code === line.code ? { ...c, guests: Number(e.target.value) } : c
                ),
              })
            }
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </li>
      ))}
    </ul>
  );
}

function F3Body({ onDone }: { onDone: (sel?: string) => void }) {
  const search = protoRoute.useSearch();
  const store = useProtoStore();
  const api = useDraft({ cabin: search.newCabin, from: search.newFrom });
  const [step, setStep] = useState<1 | 2>(1);

  const next = () => {
    const problem = step === 1 ? api.problems.stay : api.problems.guest || api.problems.payment;
    if (problem) {
      toast.error(problem);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    const booking = api.toBooking();
    store.add(booking);
    toast.success(`Booking saved: ${booking.guestName}`, {
      description: "Prototype only. Nothing was saved to the database.",
    });
    onDone(booking.id);
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>New booking</SheetTitle>
        <SheetDescription>
          Step {step} of 2: {step === 1 ? "cabins and nights" : "guest and payment"}
        </SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {step === 1 ? (
          <>
            <SourceChoice api={api} dense />
            <NightGrid api={api} bookings={store.bookings} />
            <GuestsPerCabin api={api} />
          </>
        ) : (
          <>
            <PriceSummary api={api} />
            <GuestPicker api={api} bookings={store.bookings} />
            <PaymentFields api={api} />
            <NotesField api={api} />
          </>
        )}
      </div>
      <div className="border-border flex items-center justify-between gap-2 border-t p-4">
        <div className="min-w-0 text-sm">
          <p className="font-semibold tabular-nums">{formatCurrency(api.total)}</p>
          <p className="text-muted-foreground text-xs">
            {api.lines.length} {api.lines.length === 1 ? "cabin" : "cabins"} · {api.nights}{" "}
            {api.nights === 1 ? "night" : "nights"}
          </p>
        </div>
        <div className="flex gap-2">
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <Button onClick={next}>{step === 1 ? "Next" : "Save booking"}</Button>
        </div>
      </div>
    </>
  );
}

export function F3Sheet() {
  const { search, setSearch } = useProtoSearch();
  const open = !!search.new;
  const close = (sel?: string) =>
    setSearch({ new: undefined, newCabin: undefined, newFrom: undefined, sel });
  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="medium:max-w-xl flex w-full flex-col gap-0 p-0">
        {open && <F3Body onDone={close} />}
      </SheetContent>
    </Sheet>
  );
}
