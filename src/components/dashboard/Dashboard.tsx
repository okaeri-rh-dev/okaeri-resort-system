import { useCallback, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
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
  const navigate = useNavigate();
  const { day: selectedDay } = useSearch({ strict: false });
  const today = manilaDayOf(new Date());
  const [month, setMonth] = useState(() => startOfMonth(parseISO(selectedDay ?? today)));

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: bookingKeys.all });
    queryClient.invalidateQueries({ queryKey: unitKeys.all });
    queryClient.invalidateQueries({ queryKey: guestKeys.all });
  }, [queryClient]);

  // The pane adds no history entry. The calendar follows a day picked in another month (an outside
  // day, or the day buttons)
  const selectDay = useCallback(
    (day: ManilaDay | undefined) => {
      navigate({ to: ".", search: day ? { day } : {}, replace: true });
      if (day) setMonth(startOfMonth(parseISO(day)));
    },
    [navigate]
  );

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
      {selectedDay && (
        <DayPanel
          bookings={allBookings}
          isLoading={isLoading}
          day={selectedDay}
          today={today}
          onSelectDay={selectDay}
          onClose={() => selectDay(undefined)}
        />
      )}
    </div>
  );
}
