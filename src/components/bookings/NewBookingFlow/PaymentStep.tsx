import { useId } from "react";

import { Input, Label, Textarea } from "@/components/patterns";
import { cn } from "@/lib/utils";

import { METHODS, type Draft, type Update } from "./draft";

export function PaymentStep({
  draft,
  update,
  cabinCount,
}: {
  draft: Draft;
  update: Update;
  cabinCount: number;
}) {
  const ids = useId();
  const notes = (
    <div className="space-y-2">
      <Label htmlFor={`${ids}-notes`}>Notes (optional)</Label>
      <Textarea
        id={`${ids}-notes`}
        rows={2}
        placeholder="Early check-in, extra bed, …"
        value={draft.notes}
        onChange={(e) => update({ notes: e.target.value })}
      />
    </div>
  );

  if (draft.source === "Airbnb") {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor={`${ids}-payout`}>Payout (₱)</Label>
          <Input
            id={`${ids}-payout`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            placeholder="4500.00"
            aria-describedby={`${ids}-payout-hint`}
            value={draft.payout}
            onChange={(e) => update({ payout: e.target.value })}
          />
          <p id={`${ids}-payout-hint`} className="text-muted-foreground text-xs">
            The amount Airbnb pays the resort for this stay, after Airbnb&apos;s fee. Not the price
            the guest paid on Airbnb.
            {cabinCount > 1 &&
              " The payout is split across cabins in proportion to their usual prices."}{" "}
            The booking starts Confirmed and fully paid.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${ids}-code`}>Airbnb confirmation code (optional)</Label>
          <Input
            id={`${ids}-code`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="HMABC123"
            value={draft.confirmationCode}
            onChange={(e) => update({ confirmationCode: e.target.value })}
          />
        </div>
        {notes}
      </>
    );
  }

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
      {notes}
    </>
  );
}
