import { useCallback, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { parseISO, startOfMonth } from "date-fns";
import { ChevronRight } from "lucide-react";

import { useBlockCabins } from "@/hooks/useBlocks";
import { manilaDayOf, type ManilaDay } from "@/lib/bookings/stay";
import { monthNumbers, pendingCount } from "@/lib/dashboard";
import { bookingKeys, guestKeys, unitKeys } from "@/lib/query-keys";
import { useAllBookings } from "@/stores/useBookingStore";

import { DashboardCalendar } from "./DashboardCalendar";
import { DashboardHeader } from "./DashboardHeader";
import { DayPanel } from "./DayPanel";

export function Dashboard() {
  const { data: bookings, isLoading, dataUpdatedAt, isFetching } = useAllBookings();
  const { sortedUnits } = useBlockCabins();
  const queryClient = useQueryClient();
  const today = manilaDayOf(new Date());
  const [selectedDay, setSelectedDay] = useState<ManilaDay>(today);
  const [month, setMonth] = useState(() => startOfMonth(parseISO(today)));

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    queryClient.invalidateQueries({ queryKey: unitKeys.all });
    queryClient.invalidateQueries({ queryKey: guestKeys.all });
  }, [queryClient]);

  // The calendar follows a day picked in another month (an outside day, or the day buttons)
  const selectDay = useCallback((day: ManilaDay) => {
    setSelectedDay(day);
    setMonth(startOfMonth(parseISO(day)));
  }, []);

  const allBookings = useMemo(() => bookings ?? [], [bookings]);
  const numbers = monthNumbers(allBookings, month, sortedUnits.length);
  const waiting = pendingCount(allBookings);

  return (
    <div className="space-y-4">
      <DashboardHeader dataUpdatedAt={dataUpdatedAt} isFetching={isFetching} onRefresh={refresh} />

      {waiting > 0 && (
        <Link
          to="/admin/bookings/queue"
          className="bg-warning text-warning-foreground focus-visible:ring-ring coarse:min-h-11 flex items-center justify-between rounded-md px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {waiting} booking{waiting !== 1 ? "s" : ""} waiting for verification
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      )}

      {/* Beside the calendar once the pane has room: a supporting pane is 360px (DESIGN.md, Panes) */}
      <div className="@container">
        <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_22.5rem] @3xl:items-start @3xl:gap-6">
          <DashboardCalendar
            bookings={bookings}
            isLoading={isLoading}
            month={month}
            onMonthChange={setMonth}
            today={today}
            selectedDay={selectedDay}
            onSelectDay={selectDay}
            numbers={`${Math.round(numbers.occupancy * 100)}% occupancy · ${numbers.confirmedCount} confirmed`}
          />
          <DayPanel
            bookings={allBookings}
            isLoading={isLoading}
            day={selectedDay}
            today={today}
            onSelectDay={selectDay}
          />
        </div>
      </div>
    </div>
  );
}
