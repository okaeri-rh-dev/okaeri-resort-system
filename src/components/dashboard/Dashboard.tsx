import { useCallback, useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { parseISO, startOfMonth } from "date-fns";
import { ChevronRight } from "lucide-react";

import { useBlockCabins } from "@/hooks/useBlocks";
import { useAllBookings } from "@/hooks/useBookings";
import { isNeedsAction } from "@/lib/bookings/list";
import { manilaDayOf, type ManilaDay } from "@/lib/bookings/stay";
import { monthNumbers } from "@/lib/dashboard";
import { allUnitsQuery } from "@/stores/useUnitStore";

import { DashboardCalendar } from "./DashboardCalendar";
import { DashboardHeader } from "./DashboardHeader";
import { DayPane } from "./DayPane";

export function Dashboard() {
  const {
    data: bookings,
    isLoading,
    dataUpdatedAt,
    isFetching,
    refetch: refetchBookings,
  } = useAllBookings();
  const { sortedUnits } = useBlockCabins();
  const { refetch: refetchUnits } = useQuery(allUnitsQuery());
  const navigate = useNavigate();
  const { day: selectedDay } = useSearch({ strict: false });
  const today = manilaDayOf(new Date());
  const [month, setMonth] = useState(() => startOfMonth(parseISO(selectedDay ?? today)));
  // The pane keeps showing the last day while it slides out
  const [paneDay, setPaneDay] = useState(selectedDay);
  if (selectedDay && selectedDay !== paneDay) setPaneDay(selectedDay);

  const refresh = useCallback(() => {
    void refetchBookings();
    void refetchUnits();
  }, [refetchBookings, refetchUnits]);

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
  const needsAction = allBookings.filter((booking) => isNeedsAction(booking, today)).length;

  return (
    <div className="space-y-4">
      <DashboardHeader dataUpdatedAt={dataUpdatedAt} isFetching={isFetching} onRefresh={refresh} />

      {needsAction > 0 && (
        <Link
          to="/admin/bookings"
          search={{ view: "needs-action" }}
          className="bg-warning text-warning-foreground focus-visible:ring-ring coarse:min-h-11 flex items-center justify-between rounded-md px-4 py-3 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          {needsAction === 1 ? "1 booking needs action" : `${needsAction} bookings need action`}
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
      {paneDay && (
        <DayPane
          bookings={allBookings}
          isLoading={isLoading}
          open={selectedDay !== undefined}
          day={paneDay}
          today={today}
          onSelectDay={selectDay}
          onClose={() => selectDay(undefined)}
        />
      )}
    </div>
  );
}
