import { Minus, Plus, X } from "lucide-react";

import { Button } from "@/components/patterns";
import { pluralize } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Unit } from "@/types";

type PickedCabin = { unitId: string; guests: number };

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
        {value} {pluralize(value, "guest")}
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
export function CabinPicker({
  units,
  cabins,
  onChange,
  hasDates,
  isChecking,
  notFree,
}: {
  units: Unit[];
  cabins: PickedCabin[];
  onChange: (cabins: PickedCabin[]) => void;
  hasDates: boolean;
  isChecking: boolean;
  notFree: (unitId: string) => string | null;
}) {
  const setGuests = (unitId: string, guests: number) =>
    onChange(cabins.map((c) => (c.unitId === unitId ? { ...c, guests } : c)));

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Cabins</legend>
      {!hasDates && (
        <p className="text-muted-foreground text-sm">Pick the dates first to see free cabins.</p>
      )}
      <ul className="space-y-2">
        {units.map((unit) => {
          const picked = cabins.find((c) => c.unitId === unit.unit_id);
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
                    onClick={() => onChange(cabins.filter((c) => c.unitId !== unit.unit_id))}
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
                    onChange([
                      ...cabins,
                      { unitId: unit.unit_id, guests: Math.min(2, unit.max_occupancy) },
                    ])
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
