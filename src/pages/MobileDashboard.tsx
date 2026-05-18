import { useMemo } from "react";

import { addDays, format } from "date-fns";

import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Booking } from "@/types";

interface MobileDashboardProps {
  bookings: Booking[] | undefined;
  isLoading: boolean;
}

export function MobileDashboard({ bookings, isLoading }: MobileDashboardProps) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const tomorrowKey = format(tomorrow, "yyyy-MM-dd");

  const upcomingCheckIns = useMemo(
    () =>
      bookings?.filter(
        (b) =>
          format(new Date(b.check_in), "yyyy-MM-dd") === tomorrowKey &&
          b.booking_status === "Confirmed"
      ) ?? [],
    [bookings, tomorrowKey]
  );

  const upcomingCheckOuts = useMemo(
    () =>
      bookings?.filter(
        (b) =>
          format(new Date(b.check_out), "yyyy-MM-dd") === tomorrowKey &&
          b.booking_status === "CheckedIn"
      ) ?? [],
    [bookings, tomorrowKey]
  );

  return (
    <div className="space-y-4 overflow-x-hidden">
      {/* Compact page header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
      </div>

      {/* Calendar (stacked header variant) */}
      <DashboardCalendar bookings={bookings} isLoading={isLoading} headerVariant="stacked" />

      {/* Tomorrow's Schedule */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tomorrow's Schedule</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Tabs defaultValue="checkins" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="checkins">Check-ins ({upcomingCheckIns.length})</TabsTrigger>
              <TabsTrigger value="checkouts">Check-outs ({upcomingCheckOuts.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="checkins" className="mt-2">
              {upcomingCheckIns.length === 0 ? (
                <p className="text-muted-foreground py-3 text-sm">No check-ins tomorrow</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingCheckIns.map((b) => (
                    <li
                      key={b.booking_id}
                      className="flex min-w-0 items-baseline gap-2 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{b.guest_name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        · {b.booking_units?.[0]?.unit?.unit_code ?? "—"} · {b.num_guests} guests · ₱
                        {b.total_amount.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="checkouts" className="mt-2">
              {upcomingCheckOuts.length === 0 ? (
                <p className="text-muted-foreground py-3 text-sm">No check-outs tomorrow</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {upcomingCheckOuts.map((b) => (
                    <li
                      key={b.booking_id}
                      className="flex min-w-0 items-baseline gap-2 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{b.guest_name}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        · {b.booking_units?.[0]?.unit?.unit_code ?? "—"} · {b.num_guests} guests
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
