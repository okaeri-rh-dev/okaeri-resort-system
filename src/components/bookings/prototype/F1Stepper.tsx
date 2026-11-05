/**
 * PROTOTYPE F1 "Stepper page" — full page, 4 steps: Stay → Guest → Payment → Review.
 * Each step is a history entry (`?step=`), so phone Back goes one step back, not off the page.
 * Laptop: the price summary sits in a sticky side pane. Phone: a sticky bottom bar with the total.
 */
import { getRouteApi } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";

import { Button, Card, CardContent, PageHeader, toast } from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import {
  CabinPicker,
  GuestPicker,
  NotesField,
  PaymentFields,
  PriceSummary,
  SourceChoice,
  StayDates,
  useDraft,
  type Section,
} from "./new-booking";
import { useProtoStore } from "./store-context";

const protoRoute = getRouteApi("/admin/prototype/bookings");

const STEPS: { title: string; section?: Section }[] = [
  { title: "Stay", section: "stay" },
  { title: "Guest", section: "guest" },
  { title: "Payment", section: "payment" },
  { title: "Review" },
];

export function F1Stepper() {
  const search = protoRoute.useSearch();
  const navigate = protoRoute.useNavigate();
  const store = useProtoStore();
  const api = useDraft({ cabin: search.newCabin, from: search.newFrom });

  const step = Math.min(search.step ?? 1, 4);
  const current = STEPS[step - 1];
  const problem = current.section ? api.problems[current.section] : null;
  const goTo = (next: number) => void navigate({ search: (prev) => ({ ...prev, step: next }) });
  const leave = (sel?: string) =>
    void navigate({
      search: (prev) => ({
        ...prev,
        new: undefined,
        step: undefined,
        newCabin: undefined,
        newFrom: undefined,
        sel,
      }),
    });

  const next = () => {
    if (problem) {
      toast.error(problem);
      return;
    }
    if (step < 4) {
      goTo(step + 1);
      return;
    }
    const booking = api.toBooking();
    store.add(booking);
    toast.success(`Booking saved: ${booking.guestName}`, {
      description: "Prototype only. Nothing was saved to the database.",
    });
    leave(booking.id);
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => leave()}>
          <ArrowLeft aria-hidden="true" />
          Bookings
        </Button>
        <PageHeader title="New booking" description={`Step ${step} of 4: ${current.title}`} />
      </div>

      <ol className="flex gap-2 text-sm" aria-label="Steps">
        {STEPS.map((s, index) => {
          const number = index + 1;
          const done = number < step;
          return (
            <li key={s.title} className="min-w-0 flex-1">
              <button
                type="button"
                disabled={number > step}
                aria-current={number === step ? "step" : undefined}
                onClick={() => goTo(number)}
                className={cn(
                  "w-full border-t-4 pt-2 text-left duration-150",
                  number <= step ? "border-primary" : "border-muted text-muted-foreground"
                )}
              >
                <span className="flex items-center gap-1 font-medium">
                  {done && <Check className="size-4" aria-hidden="true" />}
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="expanded:grid-cols-[minmax(0,40rem)_22rem] grid gap-6">
        <div className="space-y-6">
          {step === 1 && (
            <>
              <SourceChoice api={api} />
              <StayDates api={api} />
              <CabinPicker api={api} bookings={store.bookings} />
            </>
          )}
          {step === 2 && <GuestPicker api={api} bookings={store.bookings} />}
          {step === 3 && (
            <>
              <PaymentFields api={api} />
              <NotesField api={api} />
            </>
          )}
          {step === 4 && (
            <Card>
              <CardContent className="space-y-4 pt-4">
                <h2 className="font-display text-lg font-semibold">Check and save</h2>
                <PriceSummary api={api} />
                {api.draft.notes && <p className="text-sm break-words">Notes: {api.draft.notes}</p>}
              </CardContent>
            </Card>
          )}

          <div className="expanded:flex hidden justify-between gap-2">
            <Button variant="outline" onClick={() => (step === 1 ? leave() : goTo(step - 1))}>
              {step === 1 ? "Cancel" : "Back"}
            </Button>
            <Button onClick={next}>{step === 4 ? "Save booking" : "Next"}</Button>
          </div>
        </div>

        {step < 4 && (
          <aside className="expanded:block hidden">
            <Card className="sticky top-4">
              <CardContent className="pt-4">
                <PriceSummary api={api} />
              </CardContent>
            </Card>
          </aside>
        )}
      </div>

      <div className="bg-background border-border expanded:hidden medium:bottom-0 medium:left-20 fixed right-0 bottom-(--admin-bottom-bar-height) left-0 z-40 flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0 text-sm">
          <p className="font-semibold tabular-nums">{formatCurrency(api.total)}</p>
          <p className="text-muted-foreground truncate text-xs">
            {api.lines.length} {api.lines.length === 1 ? "cabin" : "cabins"} · {api.nights}{" "}
            {api.nights === 1 ? "night" : "nights"}
          </p>
        </div>
        <Button size="lg" onClick={next}>
          {step === 4 ? "Save booking" : "Next"}
        </Button>
      </div>
    </div>
  );
}
