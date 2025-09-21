import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookings, useGuests, useUnits } from "@/stores";
import { Building2, Calendar, TrendingUp, Users } from "lucide-react";

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

  // Calculate basic Phase 1 statistics
  const calculateStats = (): StatCard[] => {
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
        title: "Available Units",
        value: `${availableUnits}/${totalUnits}`,
        description: "Units ready for booking",
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
  };

  const stats = isLoading ? [] : calculateStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className="text-muted-foreground h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-muted-foreground text-xs">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
