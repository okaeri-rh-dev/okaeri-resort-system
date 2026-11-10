import { format, parseISO } from "date-fns";

import { formatCurrency } from "@/lib/formatters";

import type { CabinLine, Draft } from "./draft";

export function PriceSummary({
  draft,
  nights,
  lines,
  total,
}: {
  draft: Draft;
  nights: number;
  lines: CabinLine[];
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
                {line.unit.unit_name} · {line.guests} {line.guests === 1 ? "guest" : "guests"}
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
      <p className="text-muted-foreground text-xs">
        {draft.source} ·{" "}
        {draft.source === "Airbnb" ? "Total is the payout · Starts Confirmed" : "Starts Pending"}
      </p>
    </div>
  );
}
