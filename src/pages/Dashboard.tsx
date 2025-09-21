import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { BookingsTable } from "@/components/bookings/BookingsTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBookings } from "@/stores";
import { format, addDays } from "date-fns";

export function Dashboard() {
  const { data: bookings, isLoading } = useBookings();

  // Get upcoming check-ins and check-outs
  const today = new Date();
  const tomorrow = addDays(today, 1);

  const upcomingCheckIns =
    bookings?.filter((b) => {
      const checkIn = new Date(b.check_in);
      return (
        format(checkIn, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd") &&
        b.booking_status === "Confirmed"
      );
    }) || [];

  const upcomingCheckOuts =
    bookings?.filter((b) => {
      const checkOut = new Date(b.check_out);
      return (
        format(checkOut, "yyyy-MM-dd") === format(tomorrow, "yyyy-MM-dd") &&
        b.booking_status === "CheckedIn"
      );
    }) || [];

  const recentBookings = bookings?.slice(0, 5) || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Okaeri Resort Management System</p>
      </div>

      {/* Stats Cards */}
      <DashboardStats />

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
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
                          {booking.unit?.unit_name} • {booking.num_guests} guests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          ₱{booking.total_amount.toLocaleString()}
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
                          {booking.unit?.unit_name} • {booking.num_guests} guests
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          ₱{booking.total_amount.toLocaleString()}
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
                      <p className="text-sm font-medium">{booking.unit?.unit_name}</p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          booking.booking_status === "Confirmed"
                            ? "bg-green-100 text-green-800"
                            : booking.booking_status === "Pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : booking.booking_status === "CheckedIn"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {booking.booking_status}
                      </span>
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
