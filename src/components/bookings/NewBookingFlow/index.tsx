import { useRef, useState } from "react";

import { getRouteApi, Navigate, useBlocker } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2 } from "lucide-react";

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
  PageHeader,
  toast,
} from "@/components/patterns";
import {
  OfflineBookingError,
  useCreateMultiUnitBooking,
  useMultiUnitAvailability,
} from "@/hooks/useMultiUnitBookingQueries";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { nightsBetween, unavailableReason } from "@/lib/bookings";
import { formatCurrency } from "@/lib/formatters";
import { cabinRates, priceCabin } from "@/lib/pricing/cabin-pricing";
import { cn } from "@/lib/utils";
import { useUnits } from "@/stores/useUnitStore";

import {
  EMPTY_DRAFT,
  NEW_BOOKING_STEPS,
  STEP_PROBLEMS,
  STEP_TITLES,
  type CabinLine,
  type Draft,
  type Step,
} from "./draft";
import { GuestStep } from "./GuestStep";
import { PaymentStep } from "./PaymentStep";
import { PriceSummary } from "./PriceSummary";
import { ReviewStep } from "./ReviewStep";
import { StayStep } from "./StayStep";

const route = getRouteApi("/admin/bookings/new");

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

  const lines: CabinLine[] = draft.cabins.flatMap((cabin) => {
    const unit = units.find((u) => u.unit_id === cabin.unitId);
    if (!unit) return [];
    const pricing =
      nights > 0
        ? priceCabin(
            cabinRates(unit, pricingConfig),
            draft.checkIn ?? "",
            draft.checkOut ?? "",
            cabin.guests
          )
        : null;
    return [{ ...cabin, unit, subtotal: pricing?.unit_total ?? 0 }];
  });
  const isAirbnb = draft.source === "Airbnb";
  const payout = Number(draft.payout);
  // An Airbnb booking's total is the payout (ADR 0006).
  const total =
    isAirbnb && payout > 0 ? payout : lines.reduce((sum, line) => sum + line.subtotal, 0);

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
    const { method } = draft;
    if (!draft.checkIn || !draft.checkOut || (!isAirbnb && !method)) return;
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
        // Airbnb starts Confirmed and fully paid; otherwise no amount, so it starts Pending.
        ...(isAirbnb
          ? { payout, airbnb_confirmation_code: draft.confirmationCode.trim() || undefined }
          : method && { payment: { method } }),
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
    const problem = STEP_PROBLEMS[step]({
      draft,
      nights,
      lines,
      hasAvailability: !!availability,
      takenCabin: lines.find((line) => notFree(line.unitId)),
    });
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

  const summary = <PriceSummary draft={draft} nights={nights} lines={lines} total={total} />;

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

      <StepNav stepIndex={stepIndex} goTo={goTo} />

      {/* Form column capped at ~40rem (DESIGN.md content caps), summary pane beside it. */}
      <div className="expanded:grid-cols-[minmax(0,40rem)_22rem] grid gap-6">
        <div className="space-y-6">
          {step === "stay" && (
            <StayStep
              units={units}
              draft={draft}
              update={update}
              nights={nights}
              isChecking={isCheckingAvailability}
              notFree={notFree}
            />
          )}
          {step === "guest" && <GuestStep draft={draft} update={update} />}
          {step === "payment" && (
            <PaymentStep draft={draft} update={update} cabinCount={lines.length} />
          )}
          {step === "review" && <ReviewStep draft={draft} summary={summary} />}

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

function StepNav({ stepIndex, goTo }: { stepIndex: number; goTo: (step: Step) => void }) {
  return (
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
  );
}
