import { useState } from "react";

import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { hatchedFill } from "@/components/calendar/availability-fill";
import { Button, Skeleton } from "@/components/patterns";
import { useAvailabilityTimeline, type TimelineStayRow } from "@/hooks/useAvailabilityTimeline";
import type { Block } from "@/hooks/useBlocks";
import {
  tapFreeNight,
  timelineCell,
  type TimelineNight,
  type TimelineRange,
} from "@/lib/availability-timeline";
import { shortNight } from "@/lib/blocks";
import { manilaDayOf } from "@/lib/bookings/stay";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database.types";

import { LoadErrorCallout } from "./LoadErrorCallout";

const TIMELINE_NIGHTS = 14;
const STEP_NIGHTS = 7;

type Unit = Pick<Tables<"units">, "unit_id" | "unit_name">;

interface AvailabilityTimelineProps {
  units: Unit[];
  /** The Manila date (yyyy-MM-dd) */
  today: string;
  /** The first night shown (yyyy-MM-dd) */
  startNight: string;
  onStartNightChange: (night: string) => void;
  /** Managers open blocks and pick free nights; staff only look */
  canManage: boolean;
  onOpenBlock: (block: Block) => void;
  onPickRange: (range: TimelineRange) => void;
}

const nightAfter = (night: string, nights: number) =>
  format(addDays(parseISO(night), nights), "yyyy-MM-dd");

const cellClassName = "flex size-full items-center justify-center rounded-sm";

export function AvailabilityTimeline({
  units,
  today,
  startNight,
  onStartNightChange,
  canManage,
  onOpenBlock,
  onPickRange,
}: AvailabilityTimelineProps) {
  const nights = Array.from({ length: TIMELINE_NIGHTS }, (_, index) =>
    nightAfter(startNight, index)
  );
  const lastNight = nights[nights.length - 1];
  const { stays, blocks, isLoading, error, refetch } = useAvailabilityTimeline(
    startNight,
    lastNight
  );
  const [pending, setPending] = useState<TimelineNight | null>(null);

  const rows = [
    { unitId: null, label: "Whole resort" },
    ...units.map((unit) => ({ unitId: unit.unit_id, label: unit.unit_name })),
  ];
  const rowLabel = (unitId: string | null) =>
    rows.find((row) => row.unitId === unitId)?.label ?? "Cabin";

  const tapFree = (tapped: TimelineNight) => {
    const next = tapFreeNight(pending, tapped);
    if ("pending" in next) {
      setPending(next.pending);
      return;
    }
    setPending(null);
    onPickRange(next.range);
  };

  const renderCell = (unitId: string | null, label: string, night: string) => {
    if (isLoading) return <Skeleton className="size-full rounded-sm" />;
    const cell = timelineCell<TimelineStayRow, Block>(unitId, night, { blocks, stays });
    const nightLabel = `${label}, ${shortNight(night)}`;

    if (cell.kind === "blocked") {
      const { block } = cell;
      const blockedLabel = `${nightLabel}: blocked, ${block.reason}`;
      return canManage ? (
        <button
          type="button"
          title={block.reason}
          aria-label={`${blockedLabel}. Open block`}
          onClick={() => onOpenBlock(block)}
          className={cn(
            cellClassName,
            hatchedFill,
            "hover:ring-primary focus-visible:ring-ring transition-shadow duration-150 hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
          )}
        />
      ) : (
        <div title={block.reason} className={cn(cellClassName, hatchedFill)}>
          <span className="sr-only">{blockedLabel}</span>
        </div>
      );
    }

    if (cell.kind === "booked") {
      const { stay } = cell;
      const reference = stay.booking?.booking_reference ?? "Booking";
      const guestName = stay.booking?.guest_name ?? "";
      const isCheckInNight = manilaDayOf(stay.check_in) === night;
      return (
        <div
          title={`${reference} · ${guestName}`}
          className={cn(cellClassName, "bg-info text-info-foreground font-medium")}
        >
          <span aria-hidden="true">{isCheckInNight ? guestName.charAt(0) : ""}</span>
          <span className="sr-only">{`${nightLabel}: booked, ${reference} ${guestName}`}</span>
        </div>
      );
    }

    if (!canManage || night < today) {
      return (
        <div className={cn(cellClassName, "border")}>
          <span className="sr-only">{`${nightLabel}: free`}</span>
        </div>
      );
    }

    const isPending = pending?.unitId === unitId && pending.night === night;
    return (
      <button
        type="button"
        aria-label={`${nightLabel}: free. ${pending?.unitId === unitId ? "Pick as the last night" : "Pick as the first night"}`}
        aria-pressed={isPending}
        onClick={() => tapFree({ unitId, night })}
        className={cn(
          cellClassName,
          "focus-visible:ring-ring transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none",
          isPending ? "bg-primary text-primary-foreground" : "hover:bg-accent border"
        )}
      />
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="coarse:min-w-11"
          aria-label="Earlier nights"
          onClick={() => onStartNightChange(nightAfter(startNight, -STEP_NIGHTS))}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="coarse:min-w-11"
          aria-label="Later nights"
          onClick={() => onStartNightChange(nightAfter(startNight, STEP_NIGHTS))}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          onClick={() => onStartNightChange(today)}
          disabled={startNight === today}
        >
          Today
        </Button>
        <p className="text-sm font-medium tabular-nums">
          {shortNight(startNight)} – {shortNight(lastNight)}
        </p>
      </div>

      {canManage && (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          {pending ? (
            <>
              {`${rowLabel(pending.unitId)}, first night ${shortNight(pending.night)}. Tap the last night in the same row. `}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => setPending(null)}
              >
                Clear
              </Button>
            </>
          ) : (
            "Tap two free nights in one row to block them. Tap a blocked night to open it."
          )}
        </p>
      )}

      {error ? (
        <LoadErrorCallout
          title="Could not load bookings and blocks"
          onRetry={() => void refetch()}
        />
      ) : (
        <div className="bg-card overflow-x-auto rounded-lg border">
          <table className="w-full min-w-max border-collapse text-xs">
            <caption className="sr-only">
              Bookings and blocked dates per cabin, {shortNight(startNight)} to{" "}
              {shortNight(lastNight)}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="bg-card sticky left-0 z-10 w-28 p-2 text-left font-medium"
                >
                  Cabin
                </th>
                {nights.map((night) => (
                  <th
                    key={night}
                    scope="col"
                    aria-current={night === today ? "date" : undefined}
                    className={cn(
                      "w-11 p-1 text-center font-normal tabular-nums",
                      night < today && "text-muted-foreground",
                      night === today && "text-primary font-semibold"
                    )}
                  >
                    <span className="block">{format(parseISO(night), "EEE")}</span>
                    <span className="block">{format(parseISO(night), "d")}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.unitId ?? "whole-resort"} className="border-t">
                  <th
                    scope="row"
                    className="bg-card sticky left-0 z-10 max-w-28 truncate p-2 text-left font-medium"
                  >
                    {row.label}
                  </th>
                  {nights.map((night) => (
                    <td key={night} className="h-11 p-0.5">
                      {renderCell(row.unitId, row.label, night)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ul className="text-muted-foreground flex flex-wrap gap-4 text-xs" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span className="bg-info inline-block size-4 rounded-sm" aria-hidden="true" />
          Booked
        </li>
        <li className="flex items-center gap-2">
          <span className={cn("inline-block size-4 rounded-sm", hatchedFill)} aria-hidden="true" />
          Blocked
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block size-4 rounded-sm border" aria-hidden="true" />
          Free
        </li>
      </ul>
    </div>
  );
}
