/**
 * PROTOTYPE — pieces every variant may reuse: the status action, the balance chip, the overflow
 * menu, the booking detail (with verify payment), the filters sheet and the new-booking cabin step.
 * Layout is NOT shared: each variant owns its own.
 */
import { useState } from "react";

import { addDays, format, parseISO } from "date-fns";
import { Filter, ImageIcon, Plus } from "lucide-react";

import {
  ActionMenu,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  StatusBadge,
  toast,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import { cn } from "@/lib/utils";

import {
  activeFilterCount,
  balanceOf,
  cabinIsFree,
  CABINS,
  dayKey,
  formatStay,
  hasBalanceDue,
  nightsOf,
  primaryActionLabel,
  primaryActionOf,
  relativeDay,
  type ProtoBooking,
} from "./fixture";
import { useProtoSearch } from "./search";
import { useProtoStore } from "./store-context";

type ButtonSize = "sm" | "default";

/** The one main action a booking's status allows. Verify opens the booking on its verify step. */
export function PrimaryActionButton({
  booking,
  size = "sm",
  className,
}: {
  booking: ProtoBooking;
  size?: ButtonSize;
  className?: string;
}) {
  const store = useProtoStore();
  const { setSearch } = useProtoSearch();
  const action = primaryActionOf(booking);
  if (!action) return null;

  const run = () => {
    if (action === "verify") setSearch({ sel: booking.id, panel: "verify" });
    if (action === "confirm") store.confirm(booking.id);
    if (action === "check-in") store.checkIn(booking.id);
    if (action === "check-out") store.checkOut(booking.id);
  };

  return (
    <Button size={size} className={className} onClick={run}>
      {primaryActionLabel[action]}
    </Button>
  );
}

/** The second chip: shown only while a balance is due. */
export function BalanceButton({
  booking,
  size = "sm",
}: {
  booking: ProtoBooking;
  size?: ButtonSize;
}) {
  const store = useProtoStore();
  if (!hasBalanceDue(booking)) return null;
  return (
    <Button size={size} variant="outline" onClick={() => store.recordPayment(booking.id)}>
      Record {formatCurrency(balanceOf(booking))}
    </Button>
  );
}

export function BookingOverflow({ booking }: { booking: ProtoBooking }) {
  const store = useProtoStore();
  const { setSearch } = useProtoSearch();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const canCancel = booking.status === "Pending" || booking.status === "Confirmed";

  return (
    <>
      <ActionMenu
        label={`More actions for ${booking.reference}`}
        actions={[
          {
            label: "Open booking",
            onClick: () => setSearch({ sel: booking.id, panel: undefined }),
          },
          { label: "Edit", onClick: () => toast("Edit is not in the prototype") },
          ...(hasBalanceDue(booking)
            ? [{ label: "Record payment", onClick: () => store.recordPayment(booking.id) }]
            : []),
          ...(canCancel
            ? [
                {
                  label: "Cancel booking",
                  onClick: () => setConfirmCancel(true),
                  variant: "destructive" as const,
                },
              ]
            : []),
        ]}
      />
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking</AlertDialogTitle>
            <AlertDialogDescription>
              {booking.reference} for {booking.guestName} will be cancelled and its cabins freed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep booking</AlertDialogCancel>
            <AlertDialogAction onClick={() => store.cancel(booking.id)}>
              Cancel booking
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function CabinList({ booking }: { booking: ProtoBooking }) {
  if (booking.cabins.length === 0) {
    return (
      <span className="text-muted-foreground">
        {booking.requestedCabins} {booking.requestedCabins === 1 ? "cabin" : "cabins"} requested
      </span>
    );
  }
  return <span>{booking.cabins.join(", ")}</span>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-sm break-words tabular-nums">{children}</dd>
    </div>
  );
}

function VerifyStep({ booking }: { booking: ProtoBooking }) {
  const store = useProtoStore();
  const { setSearch } = useProtoSearch();
  const free = CABINS.filter((c) =>
    cabinIsFree(store.bookings, c.code, booking.checkIn, booking.checkOut)
  );
  const [picked, setPicked] = useState<string[]>(() =>
    free.slice(0, booking.requestedCabins).map((c) => c.code)
  );
  const toggle = (code: string) =>
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <section aria-label="Verify payment" className="border-border space-y-4 rounded-lg border p-4">
      <h3 className="font-display text-lg font-semibold">Verify payment</h3>
      <div className="bg-muted text-muted-foreground flex aspect-video items-center justify-center rounded-md text-sm">
        {booking.proofUploaded ? (
          <span className="flex items-center gap-2">
            <ImageIcon className="size-4" aria-hidden="true" /> Payment screenshot (stub)
          </span>
        ) : (
          "No payment screenshot yet"
        )}
      </div>
      <p className="text-sm">
        Downpayment due: <strong>{formatCurrency(Math.round(booking.total / 2))}</strong> of{" "}
        {formatCurrency(booking.total)}
      </p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Assign {booking.requestedCabins} {booking.requestedCabins === 1 ? "cabin" : "cabins"}
        </legend>
        <div className="flex flex-wrap gap-2">
          {CABINS.map((c) => {
            const isFree = free.some((f) => f.code === c.code);
            return (
              <Button
                key={c.code}
                type="button"
                size="sm"
                variant={picked.includes(c.code) ? "default" : "outline"}
                disabled={!isFree}
                aria-pressed={picked.includes(c.code)}
                onClick={() => toggle(c.code)}
              >
                {c.name}
                {!isFree && " · booked"}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={picked.length !== booking.requestedCabins || !booking.proofUploaded}
          onClick={() => {
            store.verify(booking.id, picked);
            setSearch({ panel: undefined });
          }}
        >
          Verify and assign
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            store.reject(booking.id);
            setSearch({ panel: undefined });
          }}
        >
          Reject
        </Button>
      </div>
    </section>
  );
}

/** The whole booking: used in V2's side pane and in every variant's sheet. */
export function BookingDetail({ booking }: { booking: ProtoBooking }) {
  const { search } = useProtoSearch();
  const showVerify =
    booking.status === "Pending" && booking.source === "guest" && search.panel === "verify";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold break-words">{booking.guestName}</h2>
          <StatusBadge {...statusBadgeProps(booking.status, "Pending")} />
        </div>
        <p className="text-muted-foreground text-sm tabular-nums">
          {booking.reference}
          {booking.source === "walk-in" && " · Walk-in"}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!showVerify && <PrimaryActionButton booking={booking} size="default" />}
        <BalanceButton booking={booking} size="default" />
        <BookingOverflow booking={booking} />
      </div>

      {showVerify && <VerifyStep booking={booking} />}

      <dl className="grid grid-cols-2 gap-4">
        <Fact label="Stay">{formatStay(booking)}</Fact>
        <Fact label="Nights · guests">
          {nightsOf(booking)} · {booking.guests}
        </Fact>
        <Fact label="Cabins">
          <CabinList booking={booking} />
        </Fact>
        <Fact label="Check-in">{relativeDay(booking.checkIn)}</Fact>
        <Fact label="Total">{formatCurrency(booking.total)}</Fact>
        <Fact label="Balance">
          {balanceOf(booking) > 0 ? formatCurrency(balanceOf(booking)) : "Paid"}
        </Fact>
        <Fact label="Contact">{booking.contact}</Fact>
        <Fact label="Booked">{relativeDay(booking.createdAt)}</Fact>
      </dl>
    </div>
  );
}

/** Opens the selected booking (`?sel=`) as a sheet: full screen on a phone, a side sheet wider. */
export function DetailSheet({ bookings }: { bookings: ProtoBooking[] }) {
  const { search, setSearch } = useProtoSearch();
  const booking = bookings.find((b) => b.id === search.sel);
  return (
    <Sheet
      open={!!booking}
      onOpenChange={(open) => !open && setSearch({ sel: undefined, panel: undefined })}
    >
      <SheetContent className="medium:max-w-md w-full overflow-y-auto">
        <SheetHeader className="sr-only">
          <SheetTitle>Booking</SheetTitle>
          <SheetDescription>Booking details and actions</SheetDescription>
        </SheetHeader>
        {booking && <BookingDetail booking={booking} />}
      </SheetContent>
    </Sheet>
  );
}

function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
}: {
  legend: string;
  value: T | undefined;
  options: { value: T; label: string }[];
  onChange: (value: T | undefined) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "outline"}
            aria-pressed={value === option.value}
            onClick={() => onChange(value === option.value ? undefined : option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

/** The filters other than search, as toggle chips. Inline in V2 when wide; in a sheet elsewhere. */
export function FilterChoices() {
  const { search, setSearch } = useProtoSearch();
  return (
    <div className="space-y-4">
      <ChoiceGroup
        legend="Cabin"
        value={search.cabin}
        options={CABINS.map((c) => ({ value: c.code, label: c.name }))}
        onChange={(cabin) => setSearch({ cabin })}
      />
      <ChoiceGroup
        legend="Payment"
        value={search.pay}
        options={[
          { value: "due", label: "Balance due" },
          { value: "paid", label: "Paid in full" },
        ]}
        onChange={(pay) => setSearch({ pay })}
      />
      <ChoiceGroup
        legend="Booked by"
        value={search.src}
        options={[
          { value: "guest", label: "Guest online" },
          { value: "walk-in", label: "Walk-in" },
        ]}
        onChange={(src) => setSearch({ src })}
      />
    </div>
  );
}

export function FiltersSheetButton() {
  const { filters, setSearch } = useProtoSearch();
  const [open, setOpen] = useState(false);
  const count = activeFilterCount(filters);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? `Filters, ${count} active` : "Filters"}
      >
        <Filter aria-hidden="true" />
        Filters
        {count > 0 && (
          <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-xs font-semibold tabular-nums">
            {count}
          </span>
        )}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Narrow the list. Search stays on the page.</SheetDescription>
          </SheetHeader>
          <FilterChoices />
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={() => setOpen(false)}>
              Show results
            </Button>
            {count > 0 && (
              <Button
                variant="ghost"
                onClick={() => setSearch({ cabin: undefined, pay: undefined, src: undefined })}
              >
                Clear
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function NewBookingButton({ className }: { className?: string }) {
  const { setSearch } = useProtoSearch();
  return (
    <Button className={className} onClick={() => setSearch({ new: true })}>
      <Plus aria-hidden="true" />
      New booking
    </Button>
  );
}

/** Entry point + cabin step of the one New booking flow. `?newCabin` / `?newFrom` preset it (V3). */
export function NewBookingSheet() {
  const { search, setSearch } = useProtoSearch();
  const store = useProtoStore();
  const open = !!search.new;
  const close = () => setSearch({ new: undefined, newCabin: undefined, newFrom: undefined });

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="medium:max-w-md w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New booking</SheetTitle>
          <SheetDescription>Step 1 of 3: dates and cabins</SheetDescription>
        </SheetHeader>
        {open && (
          <CabinStep
            key={`${search.newCabin}-${search.newFrom}`}
            bookings={store.bookings}
            presetCabin={search.newCabin}
            presetFrom={search.newFrom}
            onDone={close}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function CabinStep({
  bookings,
  presetCabin,
  presetFrom,
  onDone,
}: {
  bookings: ProtoBooking[];
  presetCabin?: string;
  presetFrom?: string;
  onDone: () => void;
}) {
  const [checkIn, setCheckIn] = useState(presetFrom ?? dayKey(0));
  const [checkOut, setCheckOut] = useState(() =>
    format(addDays(parseISO(presetFrom ?? dayKey(0)), 1), "yyyy-MM-dd")
  );
  const [picked, setPicked] = useState<string[]>(presetCabin ? [presetCabin] : []);
  const validRange = checkIn < checkOut;

  const toggle = (code: string) =>
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="proto-check-in">Check-in</Label>
          <Input
            id="proto-check-in"
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proto-check-out">Check-out</Label>
          <Input
            id="proto-check-out"
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cabins (pick one or more)</legend>
        <ul className="space-y-2">
          {CABINS.map((cabin) => {
            const free = validRange && cabinIsFree(bookings, cabin.code, checkIn, checkOut);
            const selected = picked.includes(cabin.code);
            return (
              <li key={cabin.code}>
                <button
                  type="button"
                  disabled={!free}
                  aria-pressed={selected}
                  onClick={() => toggle(cabin.code)}
                  className={cn(
                    "border-border coarse:min-h-11 flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm duration-150 disabled:opacity-50",
                    selected && "border-primary bg-accent"
                  )}
                >
                  <span className="font-medium">{cabin.name}</span>
                  <span className="text-muted-foreground">
                    {free ? (selected ? "Added" : "Free · tap to add") : "Booked"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <Button
        className="w-full"
        disabled={!validRange || picked.length === 0}
        onClick={() => {
          toast(`Prototype stops here: ${picked.length} cabin(s), ${checkIn} → ${checkOut}`, {
            description: "Next steps would be guest details, then payment.",
          });
          onDone();
        }}
      >
        Continue with {picked.length} {picked.length === 1 ? "cabin" : "cabins"}
      </Button>
    </div>
  );
}
