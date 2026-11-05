/**
 * PROTOTYPE F2 "One page" — full page, no steps. Every section is on one scroll, each with a
 * done tick. Laptop: sticky summary pane with Save. Phone: sticky bottom bar with total + Save.
 * Save with a gap scrolls to the first section that is not done.
 */
import type { ReactNode } from "react";

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
const ORDER: Section[] = ["stay", "guest", "payment"];

function Block({
  id,
  number,
  title,
  done,
  children,
}: {
  id: string;
  number: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4 space-y-4">
      <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full text-xs",
            done ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {done ? <Check className="size-3.5" aria-label="Done" /> : number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function F2OnePage() {
  const search = protoRoute.useSearch();
  const navigate = protoRoute.useNavigate();
  const store = useProtoStore();
  const api = useDraft({ cabin: search.newCabin, from: search.newFrom });

  const leave = (sel?: string) =>
    void navigate({
      search: (prev) => ({ ...prev, new: undefined, newCabin: undefined, newFrom: undefined, sel }),
    });

  const save = () => {
    const firstGap = ORDER.find((section) => api.problems[section]);
    if (firstGap) {
      toast.error(api.problems[firstGap] ?? "");
      document.getElementById(`f2-${firstGap}`)?.scrollIntoView({ block: "start" });
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
        <PageHeader title="New booking" />
      </div>

      <div className="expanded:grid-cols-[minmax(0,40rem)_22rem] grid gap-6">
        <div className="space-y-10">
          <Block id="f2-stay" number={1} title="Stay" done={!api.problems.stay}>
            <SourceChoice api={api} />
            <StayDates api={api} />
            <CabinPicker api={api} bookings={store.bookings} />
          </Block>
          <Block id="f2-guest" number={2} title="Guest" done={!api.problems.guest}>
            <GuestPicker api={api} bookings={store.bookings} />
          </Block>
          <Block
            id="f2-payment"
            number={3}
            title={api.isAirbnb ? "Airbnb payout" : "Payment"}
            done={!api.problems.payment}
          >
            <PaymentFields api={api} />
            <NotesField api={api} />
          </Block>
        </div>

        <aside className="expanded:block hidden">
          <Card className="sticky top-4">
            <CardContent className="space-y-4 pt-4">
              <PriceSummary api={api} />
              <Button className="w-full" onClick={save}>
                Save booking
              </Button>
              <Button className="w-full" variant="ghost" onClick={() => leave()}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <div className="bg-background border-border expanded:hidden medium:bottom-0 medium:left-20 fixed right-0 bottom-(--admin-bottom-bar-height) left-0 z-40 flex items-center justify-between gap-2 border-t p-3">
        <div className="min-w-0 text-sm">
          <p className="font-semibold tabular-nums">{formatCurrency(api.total)}</p>
          <p className="text-muted-foreground truncate text-xs">
            {ORDER.filter((s) => !api.problems[s]).length} of 3 done
          </p>
        </div>
        <Button size="lg" onClick={save}>
          Save booking
        </Button>
      </div>
    </div>
  );
}
