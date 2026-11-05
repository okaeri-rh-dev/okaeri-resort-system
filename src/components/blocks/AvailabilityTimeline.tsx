import { useState, type ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { addDays, format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { hatchedFill } from "@/components/calendar/availability-fill";
import { Button, Popover, PopoverContent, PopoverTrigger, Skeleton } from "@/components/patterns";
import { useAvailabilityTimeline, type TimelineStayRow } from "@/hooks/useAvailabilityTimeline";
import type { Block } from "@/hooks/useBlocks";
import {
  tapFreeNight,
  timelineCell,
  type TimelineNight,
  type TimelineRange,
} from "@/lib/availability-timeline";
import { blockNightsLabel, shortNight, stayLabel } from "@/lib/blocks";
import { manilaDayOf } from "@/lib/bookings/stay";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database.types";

import { WholeResortBadge } from "./BlockList";
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

  const [crossedTakenNight, setCrossedTakenNight] = useState(false);

  const tapFree = (tapped: TimelineNight) => {
    const next = tapFreeNight(pending, tapped, { blocks, stays });
    if ("pending" in next) {
      setCrossedTakenNight(pending?.unitId === tapped.unitId);
      setPending(next.pending);
      return;
    }
    setPending(null);
    setCrossedTakenNight(false);
    onPickRange(next.range);
  };
  const clearPending = () => {
    setPending(null);
    setCrossedTakenNight(false);
  };

  const renderCell = (unitId: string | null, label: string, night: string) => {
    if (isLoading) return <Skeleton className="size-full rounded-sm" />;
    const cell = timelineCell<TimelineStayRow, Block>(unitId, night, { blocks, stays });
    const nightLabel = `${label}, ${shortNight(night)}`;

    if (cell.kind === "blocked") {
      const { block } = cell;
      return (
        <CellDetails
          label={`${nightLabel}: blocked, ${block.reason}. Show details`}
          className={hatchedFill}
        >
          <p className="font-medium">Blocked</p>
          <p>{block.unit_id === null ? <WholeResortBadge /> : rowLabel(block.unit_id)}</p>
          <p className="tabular-nums">{blockNightsLabel(block.start_date, block.end_date)}</p>
          <p className="text-muted-foreground break-words">{block.reason}</p>
          {canManage ? (
            <Button size="sm" className="w-full" onClick={() => onOpenBlock(block)}>
              Open block
            </Button>
          ) : (
            <p className="text-muted-foreground">Ask a manager to change blocked dates.</p>
          )}
        </CellDetails>
      );
    }

    if (cell.kind === "booked") {
      const { stay } = cell;
      const reference = stay.booking?.booking_reference ?? "Booking";
      const guestName = stay.booking?.guest_name ?? "";
      const isCheckInNight = manilaDayOf(stay.check_in) === night;
      return (
        <CellDetails
          label={`${nightLabel}: booked, ${reference} ${guestName}. Show details`}
          className="bg-info text-info-foreground font-medium"
          content={isCheckInNight ? guestName.charAt(0) : undefined}
        >
          <p className="font-medium">Booked</p>
          <p className="break-words">{guestName}</p>
          <p className="text-muted-foreground">
            {reference} · {stay.booking_status}
          </p>
          <p className="tabular-nums">{stayLabel(stay.check_in, stay.check_out)}</p>
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/admin/bookings/$bookingId" params={{ bookingId: stay.booking_id }}>
              Open booking
            </Link>
          </Button>
        </CellDetails>
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
              {crossedTakenNight && "Those nights include a booked or blocked night. "}
              {`${rowLabel(pending.unitId)}, first night ${shortNight(pending.night)}. Tap the last night in the same row. `}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={clearPending}>
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

/** A booked or blocked cell; tapping it shows the details, which a hover hint can't on touch. */
function CellDetails({
  label,
  className,
  content,
  children,
}: {
  label: string;
  className: string;
  content?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            cellClassName,
            className,
            "hover:ring-primary focus-visible:ring-ring transition-shadow duration-150 hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          {content && <span aria-hidden="true">{content}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 text-sm">{children}</PopoverContent>
    </Popover>
  );
}
