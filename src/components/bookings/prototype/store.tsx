/** PROTOTYPE — in-memory booking store shared by all variants, so an action in V1 still shows in V2. */
import { useMemo, useState, type ReactNode } from "react";

import { toast } from "@/components/patterns";

import { buildFixture, type ProtoBooking, type Scenario } from "./fixture";
import { StoreContext, type ProtoStore } from "./store-context";

export function ProtoStoreProvider({
  scenario,
  children,
}: {
  scenario: Scenario;
  children: ReactNode;
}) {
  const [state, setState] = useState(() => ({ scenario, bookings: buildFixture(scenario) }));
  const [changed, setChanged] = useState(new Set<string>());

  let bookings = state.bookings;
  if (state.scenario !== scenario) {
    bookings = buildFixture(scenario);
    setState({ scenario, bookings });
  }

  const store = useMemo<ProtoStore>(() => {
    const update = (
      id: string,
      label: string,
      patch: (b: ProtoBooking) => Partial<ProtoBooking>
    ) => {
      const before = bookings;
      const target = before.find((b) => b.id === id);
      if (!target) return;
      setState((prev) => ({
        ...prev,
        bookings: prev.bookings.map((b) => (b.id === id ? { ...b, ...patch(b) } : b)),
      }));
      setChanged((prev) => new Set(prev).add(id));
      toast(`${label}: ${target.guestName}`, {
        description: "Prototype only. Nothing was saved.",
        action: {
          label: "Undo",
          onClick: () => setState((prev) => ({ ...prev, bookings: before })),
        },
      });
    };

    return {
      bookings,
      changedCount: changed.size,
      confirm: (id) => update(id, "Confirmed", () => ({ status: "Confirmed" })),
      checkIn: (id) => update(id, "Checked in", () => ({ status: "CheckedIn" })),
      checkOut: (id) => update(id, "Checked out", () => ({ status: "CheckedOut" })),
      verify: (id, cabins) =>
        update(id, "Payment verified", (b) => ({
          status: "Confirmed",
          cabins,
          paid: Math.round(b.total / 2),
        })),
      reject: (id) => update(id, "Payment rejected", () => ({ status: "Cancelled" })),
      recordPayment: (id) => update(id, "Payment recorded", (b) => ({ paid: b.total })),
      cancel: (id) => update(id, "Cancelled", () => ({ status: "Cancelled" })),
      reset: () => {
        setState({ scenario, bookings: buildFixture(scenario) });
        setChanged(new Set());
      },
    };
  }, [bookings, changed, scenario]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
