import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { unitKeys } from "@/lib/query-keys";
import { requireManager } from "@/lib/route-guards";
import { db, supabase } from "@/lib/supabase";
import { unitDetailQuery } from "@/stores/useUnitStore";

// Lazy load the detail page component
const UnitDetailPage = lazy(() =>
  import("@/components/units/UnitDetail").then((m) => ({
    default: m.UnitDetailPage,
  }))
);

export const Route = createFileRoute("/admin/units/$unitId/")({
  // Check owner permission before loading data
  beforeLoad: async () => {
    await requireManager();
  },

  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { unitId } = params;
    const { queryClient } = context;

    const unitPromise = queryClient.ensureQueryData(unitDetailQuery(unitId));

    // Prefetch related bookings for this unit
    const bookingsPromise = queryClient.ensureQueryData({
      queryKey: ["bookings", "unit", unitId],
      queryFn: async () => {
        const { data, error } = await db.bookings.byUnit(unitId);

        if (error) {
          console.error("[Unit Detail] Failed to fetch bookings:", error);
          return [];
        }

        return data || [];
      },
      staleTime: 30000, // 30 seconds
    });

    // Calculate revenue statistics
    const revenueStatsPromise = queryClient.ensureQueryData({
      queryKey: unitKeys.revenueStats(unitId),
      queryFn: async () => {
        const { data, error } = await supabase
          .from("booking_units")
          .select(
            `
            unit_id,
            subtotal,
            booking:bookings!inner(
              booking_id,
              booking_status,
              total_amount
            )
          `
          )
          .eq("unit_id", unitId)
          .neq("booking.booking_status", "Cancelled");

        if (error) {
          console.error("[Unit Detail] Failed to fetch revenue stats:", error);
          return {
            total_bookings: 0,
            total_revenue: 0,
            average_booking_value: 0,
          };
        }

        // Count unique bookings (in case a booking has multiple units)
        const uniqueBookingIds = new Set(data?.map((bu) => bu.booking.booking_id) || []);
        const total_bookings = uniqueBookingIds.size;

        // Sum revenue from all booking_units for this unit
        const total_revenue =
          data?.reduce((sum, bu) => sum + (bu.booking.total_amount || 0), 0) || 0;
        const average_booking_value = total_bookings > 0 ? total_revenue / total_bookings : 0;

        return {
          total_bookings,
          total_revenue,
          average_booking_value,
        };
      },
      staleTime: 60000, // 1 minute
    });

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("units", unitId))
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [, bookings, revenueStats, auditLogs] = await Promise.all([
      unitPromise,
      bookingsPromise,
      revenueStatsPromise,
      auditLogsPromise,
    ]);

    return {
      bookings,
      revenueStats,
      auditLogs,
      canViewAudit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Unit</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.history.back()}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    </ErrorBoundary>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Cabin Not Found</h1>
        <p className="mb-4 text-gray-600">
          The unit you are looking for does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go Back to Cabins
        </button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: UnitDetailComponent,
});

function UnitDetailComponent() {
  const { unitId } = Route.useParams();
  const { data: unit } = useSuspenseQuery(unitDetailQuery(unitId));

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <UnitDetailPage unit={unit} unitId={unitId} />
      </Suspense>
    </ErrorBoundary>
  );
}
