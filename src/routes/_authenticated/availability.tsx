import { lazy, Suspense, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBookings } from "@/stores/useBookingStore";

// Lazy load heavy components
const UnitsTable = lazy(() =>
  import("@/components/units/UnitsTable").then((m) => ({ default: m.UnitsTable }))
);
const DashboardCalendar = lazy(() =>
  import("@/components/dashboard/DashboardCalendar").then((m) => ({ default: m.DashboardCalendar }))
);

const availabilitySearchSchema = z.object({
  view: z.string().optional(),
  date: z.string().optional(),
  unit: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/availability")({
  validateSearch: availabilitySearchSchema,
  component: AvailabilityPage,
});

function AvailabilityPage() {
  const [activeTab, setActiveTab] = useState("calendar");
  const { data: bookings, isLoading: isLoadingBookings } = useBookings();

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Availability</h1>
            <p className="text-muted-foreground">
              Manage unit availability and view booking calendar
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="calendar">Calendar View</TabsTrigger>
            <TabsTrigger value="units">Units Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="space-y-4">
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                }
              >
                <DashboardCalendar bookings={bookings} isLoading={isLoadingBookings} />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                }
              >
                <UnitsTable />
              </Suspense>
            </ErrorBoundary>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
