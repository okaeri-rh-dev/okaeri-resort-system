import { useId } from "react";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import { ActionBadge } from "@/components/audit/ActionBadge";
import { SafeAuditText } from "@/components/audit/SafeAuditText";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  ListCard,
} from "@/components/patterns";
import { allUnitsQuery } from "@/hooks/useUnits";
import { auditActorLabel } from "@/lib/audit-display";
import { BOOKING_HISTORY_LIMIT, bookingHistoryQuery } from "@/lib/audit-hooks";
import { formatPhilippineDate } from "@/lib/timezone";
import type { AuditLog } from "@/types/audit.types";

const CABIN_VERBS: Record<string, string> = {
  INSERT: "added",
  UPDATE: "changed",
  DELETE: "removed",
};

const BOOKING_VERBS: Record<string, string> = {
  INSERT: "Booking created",
  DELETE: "Booking deleted",
};

const rowValue = (data: AuditLog["new_data"], key: string) =>
  data && typeof data === "object" && !Array.isArray(data) ? data[key] : undefined;

function describeHistoryEntry(log: AuditLog, unitNames: Map<string, string>): string | null {
  if (log.description) return log.description;
  if (log.table_name === "booking_units") {
    const unitId = rowValue(log.new_data ?? log.old_data, "unit_id");
    const name = (typeof unitId === "string" && unitNames.get(unitId)) || "A cabin";
    return `${name} ${CABIN_VERBS[log.action] ?? "changed"}`;
  }
  if (log.changed_fields?.length) {
    return `Changed ${log.changed_fields.map((field) => field.replace(/_/g, " ")).join(", ")}`;
  }
  return BOOKING_VERBS[log.action] ?? null;
}

/** The audit trail of a booking and its cabins, for managers and above. */
export function BookingHistoryCard({ bookingId }: { bookingId: string }) {
  const headingId = useId();
  const { data: fetched = [], isPending, isError } = useQuery(bookingHistoryQuery(bookingId));
  const logs = fetched.slice(0, BOOKING_HISTORY_LIMIT);
  const { data: units = [] } = useQuery(allUnitsQuery());
  const unitNames = new Map(units.map((unit) => [unit.unit_id, unit.unit_name]));

  return (
    <section aria-labelledby={headingId} className="expanded:col-span-2">
      <ListCard>
        <Collapsible>
          <h2 id={headingId} className="font-display text-base font-semibold">
            <CollapsibleTrigger className="flex min-h-8 w-full items-center justify-between gap-2 text-left">
              <span>
                History{" "}
                {!isPending && !isError && (
                  <span className="text-muted-foreground font-normal tabular-nums">
                    {logs.length}
                  </span>
                )}
              </span>
              <ChevronDown
                className="size-4 transition-transform duration-150 [[data-state=open]>&]:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
          </h2>
          <CollapsibleContent className="pt-2">
            {isPending ? (
              <p className="text-muted-foreground text-sm">Loading history…</p>
            ) : isError ? (
              <p className="text-destructive text-sm">Couldn't load the history.</p>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No changes recorded yet.</p>
            ) : (
              <ul aria-label="History" className="divide-y">
                {logs.map((log) => {
                  const description = describeHistoryEntry(log, unitNames);
                  return (
                    <li key={log.audit_id} className="space-y-1 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <ActionBadge log={log} />
                        {description && <SafeAuditText text={description} className="text-sm" />}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {auditActorLabel(log)}
                        {log.created_at && (
                          <>
                            {" · "}
                            <time dateTime={log.created_at} className="tabular-nums">
                              {formatPhilippineDate(new Date(log.created_at), "MMM d, yyyy h:mm a")}
                            </time>
                          </>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {fetched.length > BOOKING_HISTORY_LIMIT && (
              <p className="text-muted-foreground pt-2 text-xs">
                Showing the {BOOKING_HISTORY_LIMIT} newest changes.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </ListCard>
    </section>
  );
}
