import { useId, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, LogIn, LogOut, Moon } from "lucide-react";

import { hatchedFill } from "@/components/calendar/availability-fill";
import { Button, Card, CardContent } from "@/components/patterns";
import { blocksInNightsQuery } from "@/hooks/useAvailabilityTimeline";
import { useBlockCabins } from "@/hooks/useBlocks";
import { blockedNightLabel } from "@/lib/availability-timeline";
import { dayAfter, dayBefore, type ManilaDay } from "@/lib/bookings/stay";
import { movementsOn } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

import { BookingRow } from "./BookingRow";

interface DayPanelProps {
  bookings: Booking[];
  isLoading: boolean;
  day: ManilaDay;
  today: ManilaDay;
  onSelectDay: (day: ManilaDay) => void;
  className?: string;
}

export function DayPanel({
  bookings,
  isLoading,
  day,
  today,
  onSelectDay,
  className,
}: DayPanelProps) {
  const headingId = useId();
  const { checkIns, checkOuts, staying } = movementsOn(bookings, day);
  const { data: blocks } = useQuery(blocksInNightsQuery(day, day));
  const { cabinName } = useBlockCabins();
  const blockedLabel = blockedNightLabel(blocks ?? [], day, cabinName);
  const date = parseISO(day);

  return (
    <Card padding="sm" className={className}>
      <CardContent className="p-0">
        <section aria-labelledby={headingId} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id={headingId} className="font-display text-lg font-semibold">
              {day === today ? "Today" : format(date, "EEEE")}{" "}
              <span className="text-muted-foreground font-sans text-sm font-normal">
                {format(date, "MMM d")}
              </span>
            </h2>
            <span className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous day"
                onClick={() => onSelectDay(dayBefore(day))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next day"
                onClick={() => onSelectDay(dayAfter(day))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </span>
          </div>

          {blockedLabel && (
            <p className={cn("rounded-md border px-3 py-2 text-sm font-medium", hatchedFill)}>
              Blocked: {blockedLabel}
            </p>
          )}

          {isLoading ? (
            <p className="text-muted-foreground py-2 text-sm">Loading bookings…</p>
          ) : checkIns.length + checkOuts.length + staying.length === 0 ? (
            <p className="text-muted-foreground py-2 text-sm">No check-ins or check-outs.</p>
          ) : (
            <div className="space-y-3">
              <MovementGroup
                icon={<LogIn className="size-3.5" aria-hidden="true" />}
                label="Check-ins"
                bookings={checkIns}
              />
              <MovementGroup
                icon={<LogOut className="size-3.5" aria-hidden="true" />}
                label="Check-outs"
                bookings={checkOuts}
              />
              <MovementGroup
                icon={<Moon className="size-3.5" aria-hidden="true" />}
                label="Staying"
                bookings={staying}
              />
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function MovementGroup({
  icon,
  label,
  bookings,
}: {
  icon: ReactNode;
  label: string;
  bookings: Booking[];
}) {
  if (bookings.length === 0) return null;
  return (
    <div>
      <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        {icon}
        {label} ({bookings.length})
      </h3>
      <ul className="divide-border divide-y">
        {bookings.map((booking) => (
          <BookingRow key={booking.booking_id} booking={booking} />
        ))}
      </ul>
    </div>
  );
}
