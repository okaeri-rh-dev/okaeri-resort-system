import { StatusBadge } from "@/components/patterns";
import { statusBadgeProps } from "@/lib/status-tone";
import type { CabinNight } from "@/types";

/** A cabin's state tonight, with the block reason as inline help when Blocked. */
export function CabinTonight({ cabinNight }: { cabinNight: CabinNight }) {
  return (
    <div className="space-y-1">
      <StatusBadge {...statusBadgeProps(cabinNight.state, "Free")} />
      {cabinNight.blockReason && (
        <p className="text-muted-foreground text-xs">{cabinNight.blockReason}</p>
      )}
    </div>
  );
}
