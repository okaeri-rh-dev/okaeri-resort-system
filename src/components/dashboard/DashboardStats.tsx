import { useMemo } from "react";

import { Building2, Calendar, TrendingUp, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/patterns";
import { useBookings } from "@/stores/useBookingStore";
import { useGuests } from "@/stores/useGuestStore";
import { useUnits } from "@/stores/useUnitStore";

interface StatCard {
  title: string;
  value: string | number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DashboardStats() {
  const { data: units, isLoading: unitsLoading } = useUnits();
  const { data: bookings, isLoading: bookingsLoading } = useBookings();
  const { data: guests, isLoading: guestsLoading } = useGuests();

  const isLoading = unitsLoading || bookingsLoading || guestsLoading;

  // Calculate basic Phase 1 statistics with memoization
  const stats = useMemo((): StatCard[] => {
    if (isLoading) return [];

    // Available units (basic count)
    const availableUnits = units?.filter((u) => u.unit_status === "Available").length || 0;
    const totalUnits = units?.length || 0;

    // Active bookings (currently checked in)
    const activeBookings = bookings?.filter((b) => b.booking_status === "CheckedIn").length || 0;

    // Total bookings (not cancelled)
    const totalBookings = bookings?.filter((b) => b.booking_status !== "Cancelled").length || 0;

    // Total guests
    const totalGuests = guests?.length || 0;

    return [
      {
        title: "Available Cabins",
        value: `${availableUnits}/${totalUnits}`,
        description: "Cabins ready for booking",
        icon: Building2,
      },
      {
        title: "Active Bookings",
        value: activeBookings,
        description: "Currently checked in",
        icon: Calendar,
      },
      {
        title: "Total Bookings",
        value: totalBookings,
        description: "All time bookings",
        icon: TrendingUp,
      },
      {
        title: "Total Guests",
        value: totalGuests,
        description: "Registered guests",
        icon: Users,
      },
    ];
  }, [units, bookings, guests, isLoading]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading stats" className="@container">
        <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} padding="sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-0 pb-3">
                <CardTitle className="text-muted-foreground font-sans text-xs leading-tight font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
              </CardHeader>
              <CardContent className="p-0">
                <div className="font-display mb-1 text-3xl font-semibold tabular-nums">
                  {stat.value}
                </div>
                <p className="text-muted-foreground text-xs leading-tight">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
