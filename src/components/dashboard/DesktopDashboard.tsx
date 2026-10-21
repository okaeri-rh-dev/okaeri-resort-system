import { useMemo } from "react";

import { addDays, format } from "date-fns";

import { BookingsTable } from "@/components/bookings/BookingsTable";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking } from "@/types";

interface DesktopDashboardProps {
  bookings: Booking[] | undefined;
  isLoading: boolean;
  dataUpdatedAt: number;
  isFetching: boolean;
  onRefresh: () => void;
}

export function DesktopDashboard({
  bookings,
  isLoading,
  dataUpdatedAt,
  isFetching,
  onRefresh,
}: DesktopDashboardProps) {
  // Get upcoming check-ins and check-outs with memoization
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const upcomingCheckIns = useMemo(() => {
    if (!bookings) return [];

    const tomorrowFormatted = format(tomorrow, "yyyy-MM-dd");
    return bookings.filter((b) => {
      const checkIn = new Date(b.check_in);
      return (
        format(checkIn, "yyyy-MM-dd") === tomorrowFormatted && b.booking_status === "Confirmed"
      );
    });
  }, [bookings, tomorrow]);

  const upcomingCheckOuts = useMemo(() => {
    if (!bookings) return [];

    const tomorrowFormatted = format(tomorrow, "yyyy-MM-dd");
    return bookings.filter((b) => {
      const checkOut = new Date(b.check_out);
      return (
        format(checkOut, "yyyy-MM-dd") === tomorrowFormatted && b.booking_status === "CheckedIn"
      );
    });
  }, [bookings, tomorrow]);

  const recentBookings = useMemo(() => {
    return bookings?.slice(0, 5) || [];
  }, [bookings]);

  return (
    <div className="@container space-y-6">
      {/* Page Header */}
      <DashboardHeader
        title="Dashboard"
        subtitle="Welcome to Okaeri Resort Management System"
        variant="desktop"
        dataUpdatedAt={dataUpdatedAt}
        isFetching={isFetching}
        onRefresh={onRefresh}
      />

      {/* Stats Cards */}
      <DashboardStats />

      {/* Booking Calendar */}
      <DashboardCalendar bookings={bookings} isLoading={isLoading} />

      {/* Main Content */}
      <div className="grid gap-6 @4xl:grid-cols-2">
        {/* Upcoming Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Tomorrow's Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="checkins" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="checkins">Check-ins ({upcomingCheckIns.length})</TabsTrigger>
                <TabsTrigger value="checkouts">Check-outs ({upcomingCheckOuts.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="checkins" className="mt-4 space-y-2">
                {upcomingCheckIns.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No check-ins tomorrow</p>
                ) : (
                  upcomingCheckIns.map((booking) => (
                    <div
                      key={booking.booking_id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{booking.guest_name}</p>
                        <p className="text-muted-foreground text-sm">
                          {booking.booking_units?.[0]?.unit?.unit_name || "N/A"} •{" "}
                          {booking.num_guests} guests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {formatCurrency(booking.total_amount)}
                        </p>
                        <p className="text-muted-foreground text-xs">{booking.payment_status}</p>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
              <TabsContent value="checkouts" className="mt-4 space-y-2">
                {upcomingCheckOuts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No check-outs tomorrow</p>
                ) : (
                  upcomingCheckOuts.map((booking) => (
                    <div
                      key={booking.booking_id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">{booking.guest_name}</p>
                        <p className="text-muted-foreground text-sm">
                          {booking.booking_units?.[0]?.unit?.unit_name || "N/A"} •{" "}
                          {booking.num_guests} guests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {formatCurrency(booking.total_amount)}
                        </p>
                        <p className="text-muted-foreground text-xs">{booking.payment_status}</p>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Loading...</p>
            ) : recentBookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent bookings</p>
            ) : (
              <div className="space-y-2">
                {recentBookings.map((booking) => (
                  <div
                    key={booking.booking_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{booking.guest_name}</p>
                      <p className="text-muted-foreground text-xs">
                        {format(new Date(booking.check_in), "MMM d")} -{" "}
                        {format(new Date(booking.check_out), "MMM d")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {booking.booking_units?.[0]?.unit?.unit_name || "N/A"}
                      </p>
                      <StatusBadge {...statusBadgeProps(booking.booking_status, "Pending")} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <BookingsTable />
        </CardContent>
      </Card>
    </div>
  );
}
