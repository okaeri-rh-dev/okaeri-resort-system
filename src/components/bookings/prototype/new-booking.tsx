/* eslint-disable react-refresh/only-export-components -- PROTOTYPE: one throwaway file */
/**
 * PROTOTYPE — the draft model and form pieces the three New booking flow variants share
 * (ticket "One new booking flow for one or more cabins"). Layout is NOT shared: each variant
 * arranges these pieces its own way. Prices are fake: ₱9,000 a cabin a night for 4 guests,
 * ₱500 a night for each extra guest, 6 guests at most.
 */
import { useId, useMemo, useState } from "react";

import { addDays, format, parseISO } from "date-fns";
import { Check, Minus, Plus, UserRound, X } from "lucide-react";

import {
  Button,
  DateRangePicker,
  Input,
  Label,
  Textarea,
  type DateRange,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import {
  cabinIsFree,
  CABINS,
  dayKey,
  formatStay,
  nightsOf,
  type ProtoBooking,
  type ProtoSource,
} from "./fixture";

export type NewSource = "Direct" | "Walk-in" | "Airbnb";
type PaymentMethod = "GCash" | "BankTransfer" | "Cash" | "Card";

const SOURCES: { value: NewSource; hint: string }[] = [
  { value: "Direct", hint: "Phone, Messenger, a repeat guest" },
  { value: "Walk-in", hint: "The guest is here now" },
  { value: "Airbnb", hint: "Booked on Airbnb: enter the payout" },
];
const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "GCash", label: "GCash" },
  { value: "BankTransfer", label: "Bank transfer" },
  { value: "Cash", label: "Cash" },
  { value: "Card", label: "Card" },
];

const NIGHTLY = 9000;
const BASE_GUESTS = 4;
const MAX_GUESTS = 6;
const EXTRA_GUEST_NIGHTLY = 500;

export interface DraftCabin {
  code: string;
  guests: number;
}

export interface Draft {
  source: NewSource;
  checkIn?: string;
  checkOut?: string;
  cabins: DraftCabin[];
  /** Set when staff pick an existing guest; the name and contact then come from that guest. */
  guestId?: string;
  guestName: string;
  phone: string;
  email: string;
  method?: PaymentMethod;
  payout?: number;
  confirmationCode: string;
  notes: string;
}

export interface KnownGuest {
  id: string;
  name: string;
  contact: string;
  stays: number;
  lastStay: string;
}

/** Existing guests, made from the fixture bookings (the real flow searches the guests table). */
export function knownGuestsOf(bookings: ProtoBooking[]): KnownGuest[] {
  const byName = new Map<string, KnownGuest>();
  for (const b of bookings) {
    const known = byName.get(b.guestName);
    if (known) {
      known.stays += 1;
      if (b.checkIn > known.lastStay) known.lastStay = b.checkIn;
    } else {
      byName.set(b.guestName, {
        id: `g-${byName.size}`,
        name: b.guestName,
        contact: b.contact,
        stays: 1,
        lastStay: b.checkIn,
      });
    }
  }
  return [...byName.values()];
}

export type Section = "stay" | "guest" | "payment";

export function useDraft(preset: { cabin?: string; from?: string } = {}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    source: "Direct",
    checkIn: preset.from,
    checkOut: preset.from && format(addDays(parseISO(preset.from), 1), "yyyy-MM-dd"),
    cabins: preset.cabin ? [{ code: preset.cabin, guests: 2 }] : [],
    guestName: "",
    phone: "",
    email: "",
    confirmationCode: "",
    notes: "",
  }));
  const update = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  /** A change of source resets what depends on it: the payment step and the contact rules. */
  const setSource = (source: NewSource) =>
    setDraft((prev) =>
      prev.source === source
        ? prev
        : { ...prev, source, method: undefined, payout: undefined, confirmationCode: "" }
    );

  const isAirbnb = draft.source === "Airbnb";
  const nights =
    draft.checkIn && draft.checkOut
      ? nightsOf({ checkIn: draft.checkIn, checkOut: draft.checkOut })
      : 0;
  const lines = draft.cabins.map((cabin) => {
    const extraGuests = Math.max(0, cabin.guests - BASE_GUESTS);
    return {
      ...cabin,
      name: CABINS.find((c) => c.code === cabin.code)?.name ?? cabin.code,
      extraGuests,
      subtotal: nights * (NIGHTLY + extraGuests * EXTRA_GUEST_NIGHTLY),
    };
  });
  const engineTotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const total = isAirbnb ? (draft.payout ?? 0) : engineTotal;

  const problems: Record<Section, string | null> = {
    stay:
      nights <= 0
        ? "Pick the check-in and check-out dates"
        : draft.cabins.length === 0
          ? "Add at least one cabin"
          : null,
    guest: !draft.guestName.trim()
      ? "Enter the guest's name or pick an existing guest"
      : !isAirbnb && !draft.phone.trim() && !draft.guestId
        ? "Enter a phone number"
        : null,
    payment: isAirbnb
      ? draft.payout && draft.payout > 0
        ? null
        : "Enter the Airbnb payout"
      : draft.method
        ? null
        : "Pick how the guest pays",
  };

  const toBooking = (): ProtoBooking => {
    const id = `new-${Date.now()}`;
    const source: ProtoSource =
      draft.source === "Airbnb" ? "airbnb" : draft.source === "Walk-in" ? "walk-in" : "direct";
    return {
      id,
      reference: `OKR-${id.slice(-6)}`,
      guestName: draft.guestName.trim(),
      contact: draft.phone.trim(),
      guests: draft.cabins.reduce((sum, c) => sum + c.guests, 0),
      checkIn: draft.checkIn ?? dayKey(0),
      checkOut: draft.checkOut ?? dayKey(1),
      status: isAirbnb ? "Confirmed" : "Pending",
      source,
      cabins: draft.cabins.map((c) => c.code),
      requestedCabins: draft.cabins.length,
      total,
      paid: isAirbnb ? total : 0,
      proofUploaded: false,
      createdAt: dayKey(0),
    };
  };

  return {
    draft,
    update,
    setSource,
    isAirbnb,
    nights,
    lines,
    engineTotal,
    total,
    problems,
    isReady: !problems.stay && !problems.guest && !problems.payment,
    toBooking,
  };
}

export type DraftApi = ReturnType<typeof useDraft>;

/** The status a new booking starts in, as staff would read it before saving. */
export function startsAs(api: DraftApi) {
  return api.isAirbnb
    ? "Starts Confirmed and fully paid (Airbnb payout)."
    : "Starts Pending. Confirm it from the list once the deposit is in.";
}

/** Radio cards; the source is the first field of the flow (decided in "Booking source on staff-made bookings"). */
export function SourceChoice({ api, dense }: { api: DraftApi; dense?: boolean }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Booking source</legend>
      <div className={cn("grid gap-2", dense ? "grid-cols-3" : "medium:grid-cols-3")}>
        {SOURCES.map((option) => {
          const selected = api.draft.source === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => api.setSource(option.value)}
              className={cn(
                "border-border coarse:min-h-11 rounded-lg border p-3 text-left text-sm duration-150",
                selected ? "border-primary bg-accent" : "hover:bg-muted"
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {selected && <Check className="size-4" aria-hidden="true" />}
                {option.value}
              </span>
              {!dense && <span className="text-muted-foreground block text-xs">{option.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function StayDates({ api }: { api: DraftApi }) {
  const value: DateRange | undefined = api.draft.checkIn
    ? {
        from: parseISO(api.draft.checkIn),
        to: api.draft.checkOut ? parseISO(api.draft.checkOut) : undefined,
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
        onChange={(range) =>
          api.update({
            checkIn: range?.from && format(range.from, "yyyy-MM-dd"),
            checkOut: range?.to && format(range.to, "yyyy-MM-dd"),
          })
        }
        className="w-full"
      />
      {api.nights > 0 && (
        <p className="text-muted-foreground text-xs">
          {api.nights} {api.nights === 1 ? "night" : "nights"}
        </p>
      )}
    </div>
  );
}

function GuestStepper({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="coarse:min-w-11 size-8"
        aria-label="One guest fewer"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden="true" />
      </Button>
      <span className="w-14 text-center text-sm tabular-nums">
        {value} {value === 1 ? "guest" : "guests"}
      </span>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="coarse:min-w-11 size-8"
        aria-label="One guest more"
        disabled={value >= MAX_GUESTS}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}

/** Every cabin with its availability for the picked dates. All cabins share the same dates. */
export function CabinPicker({ api, bookings }: { api: DraftApi; bookings: ProtoBooking[] }) {
  const { draft } = api;
  const hasDates = api.nights > 0;
  const setGuests = (code: string, guests: number) =>
    api.update({ cabins: draft.cabins.map((c) => (c.code === code ? { ...c, guests } : c)) });

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Cabins</legend>
      {!hasDates && (
        <p className="text-muted-foreground text-sm">Pick the dates first to see free cabins.</p>
      )}
      <ul className="space-y-2">
        {CABINS.map((cabin) => {
          const picked = draft.cabins.find((c) => c.code === cabin.code);
          const free =
            !!draft.checkIn &&
            !!draft.checkOut &&
            cabinIsFree(bookings, cabin.code, draft.checkIn, draft.checkOut);
          return (
            <li
              key={cabin.code}
              className={cn(
                "border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm",
                picked && "border-primary bg-accent",
                hasDates && !free && "opacity-60"
              )}
            >
              <div className="min-w-0">
                <p className="font-medium">{cabin.name}</p>
                <p className="text-muted-foreground text-xs">
                  {!hasDates
                    ? `Up to ${MAX_GUESTS} guests`
                    : free
                      ? `Free · ${formatCurrency(NIGHTLY)} a night for ${BASE_GUESTS}`
                      : "Booked on these dates"}
                </p>
              </div>
              {picked ? (
                <div className="flex items-center gap-2">
                  <GuestStepper
                    label={`Guests in ${cabin.name}`}
                    value={picked.guests}
                    onChange={(guests) => setGuests(cabin.code, guests)}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="coarse:min-w-11 size-8"
                    aria-label={`Remove ${cabin.name}`}
                    onClick={() =>
                      api.update({ cabins: draft.cabins.filter((c) => c.code !== cabin.code) })
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
                  disabled={!free}
                  onClick={() =>
                    api.update({ cabins: [...draft.cabins, { code: cabin.code, guests: 2 }] })
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

/** One field: type a name or phone. Matches show first; "New guest" is always the last choice. */
export function GuestPicker({ api, bookings }: { api: DraftApi; bookings: ProtoBooking[] }) {
  const { draft } = api;
  const ids = useId();
  const known = useMemo(() => knownGuestsOf(bookings), [bookings]);
  const [isNew, setIsNew] = useState(!!draft.guestName && !draft.guestId);
  const query = draft.guestName.trim().toLowerCase();
  const matches =
    query.length < 2
      ? []
      : known
          .filter((g) => g.name.toLowerCase().includes(query) || g.contact.includes(query))
          .slice(0, 4);

  if (draft.guestId) {
    const guest = known.find((g) => g.id === draft.guestId);
    return (
      <div className="border-primary bg-accent flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
        <div className="flex min-w-0 gap-2">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium break-words">{draft.guestName}</p>
            <p className="text-muted-foreground text-xs">
              {draft.phone || "No phone"} · {guest?.stays ?? 1} earlier{" "}
              {guest?.stays === 1 ? "stay" : "stays"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => api.update({ guestId: undefined, guestName: "", phone: "", email: "" })}
        >
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${ids}-name`}>Guest</Label>
        <Input
          id={`${ids}-name`}
          autoComplete="off"
          placeholder="Search a name or phone, or type a new name"
          value={draft.guestName}
          onChange={(e) => api.update({ guestName: e.target.value })}
        />
        {!isNew && matches.length > 0 && (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {matches.map((guest) => (
              <li key={guest.id}>
                <button
                  type="button"
                  className="hover:bg-muted coarse:min-h-11 flex w-full items-center justify-between gap-2 p-3 text-left text-sm duration-150"
                  onClick={() =>
                    api.update({ guestId: guest.id, guestName: guest.name, phone: guest.contact })
                  }
                >
                  <span className="min-w-0 truncate font-medium">{guest.name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {guest.contact} · {guest.stays} {guest.stays === 1 ? "stay" : "stays"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!isNew && query.length >= 2 && (
          <Button type="button" size="sm" variant="outline" onClick={() => setIsNew(true)}>
            <Plus aria-hidden="true" />
            New guest “{draft.guestName.trim()}”
          </Button>
        )}
      </div>

      {isNew && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-phone`}>Phone{api.isAirbnb && " (optional for Airbnb)"}</Label>
            <Input
              id={`${ids}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={draft.phone}
              onChange={(e) => api.update({ phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-email`}>Email (optional)</Label>
            <Input
              id={`${ids}-email`}
              type="email"
              spellCheck={false}
              autoComplete="off"
              value={draft.email}
              onChange={(e) => api.update({ email: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Airbnb: payout + confirmation code. Otherwise: the payment method. */
export function PaymentFields({ api }: { api: DraftApi }) {
  const ids = useId();
  const { draft } = api;
  if (api.isAirbnb) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${ids}-payout`}>Airbnb payout</Label>
          <Input
            id={`${ids}-payout`}
            type="number"
            inputMode="decimal"
            min={0}
            placeholder="e.g. 8500"
            aria-describedby={`${ids}-payout-hint`}
            value={draft.payout ?? ""}
            onChange={(e) =>
              api.update({ payout: e.target.value ? Number(e.target.value) : undefined })
            }
          />
          <p id={`${ids}-payout-hint`} className="text-muted-foreground text-xs">
            The amount Airbnb pays the resort for this stay, after Airbnb&apos;s fee. Not the price
            the guest paid on Airbnb.
            {api.lines.length > 1 &&
              " It is split across the cabins in proportion to their usual prices."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${ids}-code`}>Airbnb confirmation code (optional)</Label>
          <Input
            id={`${ids}-code`}
            spellCheck={false}
            autoComplete="off"
            value={draft.confirmationCode}
            onChange={(e) => api.update({ confirmationCode: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
    );
  }
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">How the guest pays</legend>
      <div className="grid grid-cols-2 gap-2">
        {METHODS.map((method) => {
          const selected = draft.method === method.value;
          return (
            <button
              key={method.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => api.update({ method: method.value })}
              className={cn(
                "border-border coarse:min-h-11 rounded-lg border p-2 text-sm duration-150",
                selected ? "border-primary bg-accent font-medium" : "hover:bg-muted"
              )}
            >
              {method.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function NotesField({ api }: { api: DraftApi }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Notes (optional)</Label>
      <Textarea
        id={id}
        rows={2}
        placeholder="Early check-in, extra bed, ..."
        value={api.draft.notes}
        onChange={(e) => api.update({ notes: e.target.value })}
      />
    </div>
  );
}

/** Price lines per cabin, then the total. Airbnb shows the payout as the total. */
export function PriceSummary({ api }: { api: DraftApi }) {
  const { draft } = api;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {draft.checkIn && draft.checkOut && api.nights > 0
          ? `${formatStay({ checkIn: draft.checkIn, checkOut: draft.checkOut })} · ${api.nights} ${
              api.nights === 1 ? "night" : "nights"
            }`
          : "No dates yet"}
      </p>
      {api.lines.length === 0 ? (
        <p className="text-muted-foreground">No cabins yet</p>
      ) : (
        <ul className="space-y-1">
          {api.lines.map((line) => (
            <li key={line.code} className="flex justify-between gap-2">
              <span className="min-w-0">
                {line.name} · {line.guests} {line.guests === 1 ? "guest" : "guests"}
                {line.extraGuests > 0 && (
                  <span className="text-muted-foreground block text-xs">
                    incl. {line.extraGuests} extra × {formatCurrency(EXTRA_GUEST_NIGHTLY)} a night
                  </span>
                )}
              </span>
              <span className={cn("tabular-nums", api.isAirbnb && "text-muted-foreground")}>
                {formatCurrency(line.subtotal)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-border flex justify-between gap-2 border-t pt-2 font-semibold">
        <span>{api.isAirbnb ? "Airbnb payout" : "Total"}</span>
        <span className="tabular-nums">{formatCurrency(api.total)}</span>
      </div>
      {api.draft.guestName && (
        <p className="text-muted-foreground break-words">Guest: {api.draft.guestName}</p>
      )}
      <p className="text-muted-foreground text-xs">
        {api.draft.source} · {startsAs(api)}
      </p>
    </div>
  );
}
