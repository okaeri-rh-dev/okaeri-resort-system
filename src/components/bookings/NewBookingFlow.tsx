import { useId, useRef, useState } from "react";

import { getRouteApi, Navigate, useBlocker } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Check, Loader2, Minus, Plus, UserRound, X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  DateRangePicker,
  Input,
  Label,
  PageHeader,
  Textarea,
  toast,
  type DateRange,
} from "@/components/patterns";
import {
  OfflineBookingError,
  useCreateMultiUnitBooking,
  useMultiUnitAvailability,
} from "@/hooks/useMultiUnitBookingQueries";
import { usePricingConfig, type PricingConfig } from "@/hooks/usePricingConfig";
import {
  nightsBetween,
  pickedDay,
  unavailableReason,
  type StaffBookingSource,
} from "@/lib/bookings";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useGuestPick } from "@/stores/useGuestStore";
import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import { useUnits } from "@/stores/useUnitStore";
import type { Unit } from "@/types";

export const NEW_BOOKING_STEPS = ["stay", "guest", "payment", "review"] as const;
type Step = (typeof NEW_BOOKING_STEPS)[number];
const STEP_TITLES: Record<Step, string> = {
  stay: "Stay",
  guest: "Guest",
  payment: "Payment",
  review: "Review",
};

// Airbnb joins in #340 with its payout step.
const SOURCES: { value: StaffBookingSource; hint: string }[] = [
  { value: "Direct", hint: "Phone, Messenger, a repeat guest" },
  { value: "Walk-in", hint: "The guest is here now" },
];
const METHODS = [
  { value: "GCash", label: "GCash" },
  { value: "BankTransfer", label: "Bank transfer" },
  { value: "Cash", label: "Cash" },
  { value: "CreditCard", label: "Card" },
] as const;
type PaymentMethod = (typeof METHODS)[number]["value"];

const route = getRouteApi("/admin/bookings/new");

interface Draft {
  source: StaffBookingSource;
  checkIn?: string;
  checkOut?: string;
  cabins: { unitId: string; guests: number }[];
  guestId?: string;
  guestName: string;
  phone: string;
  email: string;
  isNewGuest: boolean;
  method?: PaymentMethod;
  notes: string;
}

const EMPTY_DRAFT: Draft = {
  source: "Direct",
  cabins: [],
  guestName: "",
  phone: "",
  email: "",
  isNewGuest: false,
  notes: "",
};

/** The same rates the server stores: global pricing config first, then the unit's own. */
function priceCabin(unit: Unit, config: PricingConfig | undefined, draft: Draft, guests: number) {
  const bookingUnit = {
    unit_id: unit.unit_id,
    unit_name: unit.unit_name,
    unit_code: unit.unit_code ?? "",
    unit_type: unit.unit_type,
    max_occupancy: unit.max_occupancy,
    base_occupancy: config?.base_occupancy ?? unit.base_occupancy,
    base_rate: config?.base_rate ?? unit.base_rate,
    weekend_rate: config?.weekend_rate ?? unit.weekend_rate ?? config?.base_rate ?? unit.base_rate,
    extra_person_rate: config?.extra_person_rate ?? unit.extra_person_rate ?? 0,
    pricing: { nights: 0, base_total: 0, weekend_surcharge: 0, extra_person_fee: 0, unit_total: 0 },
    availability: { is_available: true, checking: false },
  };
  return useMultiUnitBookingStore
    .getState()
    .calculateUnitPricing(bookingUnit, draft.checkIn ?? "", draft.checkOut ?? "", guests);
}

export function NewBookingFlow() {
  const { step } = route.useSearch();
  const navigate = route.useNavigate();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const update = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));
  const saved = useRef(false);

  const { data: units = [] } = useUnits();
  const { data: pricingConfig } = usePricingConfig();
  const nights = draft.checkIn && draft.checkOut ? nightsBetween(draft.checkIn, draft.checkOut) : 0;
  const { data: availability, isFetching: isCheckingAvailability } = useMultiUnitAvailability(
    units.map((u) => u.unit_id),
    draft.checkIn ?? "",
    draft.checkOut ?? "",
    { enabled: nights > 0 }
  );
  const notFree = (unitId: string) => (nights > 0 ? unavailableReason(availability, unitId) : null);

  const lines = draft.cabins.flatMap((cabin) => {
    const unit = units.find((u) => u.unit_id === cabin.unitId);
    if (!unit) return [];
    const pricing = nights > 0 ? priceCabin(unit, pricingConfig, draft, cabin.guests) : null;
    return [{ ...cabin, unit, subtotal: pricing?.unit_total ?? 0 }];
  });
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

  const takenCabin = lines.find((line) => notFree(line.unitId));
  const problems: Record<Step, string | null> = {
    stay:
      nights <= 0
        ? "Pick the check-in and check-out dates"
        : lines.length === 0
          ? "Add at least one cabin"
          : !availability
            ? "Checking which cabins are free"
            : takenCabin
              ? `${takenCabin.unit.unit_name} is not free on these dates. Remove it or change the dates.`
              : null,
    guest:
      draft.guestName.trim().length < 2
        ? "Enter the guest's name or pick an existing guest"
        : !draft.guestId && !draft.isNewGuest
          ? "Pick an existing guest or choose New guest"
          : !draft.guestId && !draft.phone.trim()
            ? "Enter a phone number"
            : null,
    payment: draft.method ? null : "Pick how the guest pays",
    review: null,
  };

  const stepIndex = NEW_BOOKING_STEPS.indexOf(step);
  const isDirty = draft !== EMPTY_DRAFT;
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      isDirty && !saved.current && current.pathname !== next.pathname,
    enableBeforeUnload: () => isDirty && !saved.current,
    withResolver: true,
  });

  const goTo = (next: Step) => void navigate({ search: (prev) => ({ ...prev, step: next }) });
  const leave = () => void navigate({ to: "/admin/bookings" });

  const createBooking = useCreateMultiUnitBooking();
  const save = async () => {
    if (!draft.checkIn || !draft.checkOut || !draft.method) return;
    try {
      const booking = await createBooking.mutateAsync({
        primary_guest: {
          guest_name: draft.guestName.trim(),
          email: draft.email.trim(),
          contact_number: draft.phone.trim(),
          ...(draft.guestId && { guest_id: draft.guestId }),
        },
        check_in: draft.checkIn,
        check_out: draft.checkOut,
        units: draft.cabins.map((cabin) => ({ unit_id: cabin.unitId, num_guests: cabin.guests })),
        // No amount: the booking starts Pending with no payment recorded.
        payment: { method: draft.method },
        special_requests: draft.notes.trim() || undefined,
        booking_source: draft.source,
        source: "web",
      });
      saved.current = true;
      toast.success(`Booking saved for ${draft.guestName.trim()}`);
      void navigate({ to: "/admin/bookings", search: { booking: booking.booking_id } });
    } catch (error) {
      toast.error(
        error instanceof OfflineBookingError ? error.message : "Could not save the booking",
        {
          description:
            error instanceof OfflineBookingError
              ? undefined
              : error instanceof Error
                ? error.message
                : "Try again.",
        }
      );
    }
  };

  // The draft lives in memory, so a reload or deep link to a later step starts over.
  if (!isDirty && step !== "stay") {
    return <Navigate to="/admin/bookings/new" search={{ step: "stay" }} replace />;
  }

  const next = () => {
    const problem = problems[step];
    if (problem) {
      toast.error(problem);
      return;
    }
    if (step === "review") void save();
    else goTo(NEW_BOOKING_STEPS[stepIndex + 1]);
  };
  const back = () => (stepIndex === 0 ? leave() : goTo(NEW_BOOKING_STEPS[stepIndex - 1]));
  const isSaving = createBooking.isPending;
  const nextLabel = step === "review" ? "Save booking" : "Next";

  const summary = (
    <PriceSummary
      draft={draft}
      nights={nights}
      lines={lines.map((l) => ({
        unitId: l.unitId,
        name: l.unit.unit_name,
        guests: l.guests,
        subtotal: l.subtotal,
      }))}
      total={total}
    />
  );

  return (
    <div className="expanded:pb-0 space-y-6 pb-24">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={leave}>
          <ArrowLeft aria-hidden="true" />
          Bookings
        </Button>
        <PageHeader
          title="New booking"
          description={`Step ${stepIndex + 1} of 4: ${STEP_TITLES[step]}`}
        />
      </div>

      <ol className="flex gap-2 text-sm" aria-label="Steps">
        {NEW_BOOKING_STEPS.map((s, index) => (
          <li key={s} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={index > stepIndex}
              aria-current={index === stepIndex ? "step" : undefined}
              onClick={() => goTo(s)}
              className={cn(
                "coarse:min-h-11 w-full border-t-4 pt-2 text-left duration-150",
                index <= stepIndex ? "border-primary" : "border-muted text-muted-foreground"
              )}
            >
              <span className="flex items-center gap-1 font-medium">
                {index < stepIndex && <Check className="size-4" aria-hidden="true" />}
                {STEP_TITLES[s]}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* Form column capped at ~40rem (DESIGN.md content caps), summary pane beside it. */}
      <div className="expanded:grid-cols-[minmax(0,40rem)_22rem] grid gap-6">
        <div className="space-y-6">
          {step === "stay" && (
            <>
              <SourceChoice
                value={draft.source}
                onChange={(source) => update({ source, method: undefined })}
              />
              <StayDates draft={draft} nights={nights} update={update} />
              <CabinPicker
                units={units}
                draft={draft}
                update={update}
                hasDates={nights > 0}
                isChecking={isCheckingAvailability}
                notFree={notFree}
              />
            </>
          )}
          {step === "guest" && <GuestPicker draft={draft} update={update} />}
          {step === "payment" && <PaymentStep draft={draft} update={update} />}
          {step === "review" && (
            <Card>
              <CardContent className="space-y-4 pt-4">
                <h2 className="font-display text-lg font-semibold">Check and save</h2>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{draft.source}</dd>
                  <dt className="text-muted-foreground">Guest</dt>
                  <dd className="break-words">{draft.guestName}</dd>
                  {draft.phone && (
                    <>
                      <dt className="text-muted-foreground">Phone</dt>
                      <dd>{draft.phone}</dd>
                    </>
                  )}
                  {draft.email && (
                    <>
                      <dt className="text-muted-foreground">Email</dt>
                      <dd className="break-words">{draft.email}</dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Payment</dt>
                  <dd>{METHODS.find((m) => m.value === draft.method)?.label}</dd>
                  {draft.notes && (
                    <>
                      <dt className="text-muted-foreground">Notes</dt>
                      <dd className="break-words">{draft.notes}</dd>
                    </>
                  )}
                </dl>
                {summary}
              </CardContent>
            </Card>
          )}

          <div className="expanded:flex hidden justify-between gap-2">
            <Button variant="outline" onClick={back}>
              {stepIndex === 0 ? "Cancel" : "Back"}
            </Button>
            <Button onClick={next} disabled={isSaving}>
              {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {nextLabel}
            </Button>
          </div>
        </div>

        {step !== "review" && (
          <aside className="expanded:block hidden" aria-label="Price summary">
            <Card className="sticky top-4">
              <CardContent className="pt-4">{summary}</CardContent>
            </Card>
          </aside>
        )}
      </div>

      <div className="bg-background border-border expanded:hidden medium:bottom-0 medium:left-20 fixed right-0 bottom-(--admin-bottom-bar-height) left-0 z-40 flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0 text-sm">
          <p className="font-semibold tabular-nums">{formatCurrency(total)}</p>
          <p className="text-muted-foreground truncate text-xs">
            {lines.length} {lines.length === 1 ? "cabin" : "cabins"} · {nights}{" "}
            {nights === 1 ? "night" : "nights"}
          </p>
        </div>
        <div className="flex gap-2">
          {stepIndex > 0 && (
            <Button size="lg" variant="outline" onClick={back}>
              Back
            </Button>
          )}
          <Button size="lg" onClick={next} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {nextLabel}
          </Button>
        </div>
      </div>

      <AlertDialog open={blocker.status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              This booking is not saved yet. If you leave now, what you entered is lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type Update = (patch: Partial<Draft>) => void;

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

/** One field: type a name or phone. Matches show first; "New guest" is always offered. */
function GuestPicker({ draft, update }: { draft: Draft; update: Update }) {
  const ids = useId();
  const searching = !draft.guestId && !draft.isNewGuest;
  const { data: matches = [] } = useGuestPick(searching ? draft.guestName : "");

  if (draft.guestId) {
    return (
      <div className="border-primary bg-accent flex items-start justify-between gap-2 rounded-lg border p-3 text-sm">
        <div className="flex min-w-0 gap-2">
          <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-medium break-words">{draft.guestName}</p>
            <p className="text-muted-foreground text-xs">{draft.phone || "No phone"}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => update({ guestId: undefined, guestName: "", phone: "", email: "" })}
        >
          Change guest
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
          onChange={(e) => update({ guestName: e.target.value })}
        />
        {searching && matches.length > 0 && (
          <ul className="border-border divide-border divide-y rounded-lg border">
            {matches.map((guest) => (
              <li key={guest.guest_id}>
                <button
                  type="button"
                  className="hover:bg-muted coarse:min-h-11 flex w-full items-center justify-between gap-2 p-3 text-left text-sm duration-150"
                  onClick={() =>
                    update({
                      guestId: guest.guest_id,
                      guestName: guest.guest_name,
                      phone: guest.phone_number ?? "",
                      email: guest.email ?? "",
                    })
                  }
                >
                  <span className="min-w-0 truncate font-medium">{guest.guest_name}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {guest.phone_number ?? "No phone"} · {guest.total_bookings ?? 0}{" "}
                    {guest.total_bookings === 1 ? "stay" : "stays"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!draft.isNewGuest && draft.guestName.trim().length >= 2 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => update({ isNewGuest: true })}
          >
            <Plus aria-hidden="true" />
            New guest “{draft.guestName.trim()}”
          </Button>
        )}
      </div>

      {draft.isNewGuest && (
        <>
          <div className="space-y-2">
            <Label htmlFor={`${ids}-phone`}>Phone</Label>
            <Input
              id={`${ids}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="0917 123 4567"
              value={draft.phone}
              onChange={(e) => update({ phone: e.target.value })}
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
              onChange={(e) => update({ email: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function PaymentStep({ draft, update }: { draft: Draft; update: Update }) {
  const notesId = useId();
  return (
    <>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How the guest pays</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How the guest pays">
          {METHODS.map((method) => {
            const selected = draft.method === method.value;
            return (
              <button
                key={method.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ method: method.value })}
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
        <p className="text-muted-foreground text-xs">
          The booking starts Pending with no payment recorded. Confirm it from the list once the
          deposit is in.
        </p>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor={notesId}>Notes (optional)</Label>
        <Textarea
          id={notesId}
          rows={2}
          placeholder="Early check-in, extra bed, …"
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
        />
      </div>
    </>
  );
}

function PriceSummary({
  draft,
  nights,
  lines,
  total,
}: {
  draft: Draft;
  nights: number;
  lines: { unitId: string; name: string; guests: number; subtotal: number }[];
  total: number;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        {draft.checkIn && draft.checkOut && nights > 0
          ? `${format(parseISO(draft.checkIn), "MMM d")} – ${format(parseISO(draft.checkOut), "MMM d, yyyy")} · ${nights} ${nights === 1 ? "night" : "nights"}`
          : "No dates yet"}
      </p>
      {lines.length === 0 ? (
        <p className="text-muted-foreground">No cabins yet</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((line) => (
            <li key={line.unitId} className="flex justify-between gap-2">
              <span className="min-w-0">
                {line.name} · {line.guests} {line.guests === 1 ? "guest" : "guests"}
              </span>
              <span className="tabular-nums">{formatCurrency(line.subtotal)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-border flex justify-between gap-2 border-t pt-2 font-semibold">
        <span>Total</span>
        <span className="tabular-nums" data-testid="new-booking-total">
          {formatCurrency(total)}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">{draft.source} · Starts Pending</p>
    </div>
  );
}
