import { useMemo } from "react";

import { Building2, Calendar, TrendingUp, Users } from "lucide-react";

import { DashboardStatsSkeleton } from "@/components/skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return <DashboardStatsSkeleton cardCount={4} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card
            key={index}
            className="kpi-card border border-neutral-200 shadow-sm transition-shadow hover:shadow-md"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm leading-tight font-medium text-neutral-700">
                {stat.title}
              </CardTitle>
              <div className="flex-shrink-0">
                <Icon className="text-muted-foreground h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="mb-1 font-mono text-2xl font-bold text-neutral-900 lg:text-3xl">
                {stat.value}
              </div>
              <p className="text-muted-foreground text-xs leading-tight">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
