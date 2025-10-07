import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db, supabase } from "@/lib/supabase";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Lazy load the detail page component
const UnitDetailPage = lazy(() =>
  import("@/components/units/UnitDetail").then((m) => ({
    default: m.UnitDetailPage,
  }))
);

export const Route = createFileRoute("/_authenticated/units/$unitId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { unitId } = params;
    const { queryClient } = context;

    // Prefetch unit data
    const unitPromise = queryClient.ensureQueryData({
      queryKey: ["unit", unitId],
      queryFn: async () => {
        const { data, error } = await db.units.byId(unitId);

        if (error) {
          console.error("[Unit Detail] Failed to fetch unit:", error);
          throw new Error(`Failed to load unit: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

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
      queryKey: ["unit", unitId, "revenue-stats"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("bookings")
          .select("total_amount, booking_status")
          .eq("unit_id", unitId)
          .neq("booking_status", "Cancelled");

        if (error) {
          console.error("[Unit Detail] Failed to fetch revenue stats:", error);
          return {
            total_bookings: 0,
            total_revenue: 0,
            average_booking_value: 0,
          };
        }

        const total_bookings = data?.length || 0;
        const total_revenue =
          data?.reduce((sum, booking) => sum + (booking.total_amount || 0), 0) || 0;
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
      ? queryClient.ensureQueryData({
          queryKey: ["auditLogs", "unit", unitId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("audit_logs")
              .select("*")
              .eq("table_name", "units")
              .eq("record_id", unitId)
              .order("created_at", { ascending: false })
              .limit(50);

            if (error) {
              console.error("[Unit Detail] Failed to fetch audit logs:", error);
              return [];
            }

            return data || [];
          },
          staleTime: 60000, // 1 minute
        })
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [unitData, bookings, revenueStats, auditLogs] = await Promise.all([
      unitPromise,
      bookingsPromise,
      revenueStatsPromise,
      auditLogsPromise,
    ]);

    // Cast amenities from Json to string[] for TypeScript compatibility
    const unit = {
      ...unitData,
      amenities: unitData.amenities as string[] | null,
    };

    return {
      unit,
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
          <h1 className="text-2xl font-bold text-red-600 mb-4">Failed to Load Unit</h1>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Unit Not Found</h1>
        <p className="text-gray-600 mb-4">
          The unit you are looking for does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go Back to Units
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
  const { unit } = Route.useLoaderData();

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <UnitDetailPage unit={unit} unitId={unitId} />
      </Suspense>
    </ErrorBoundary>
  );
}
