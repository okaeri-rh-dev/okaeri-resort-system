import { lazy, Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db, supabase } from "@/lib/supabase";

// Lazy load the detail page component
const GuestDetailPage = lazy(() =>
  import("@/components/guests/GuestDetail").then((m) => ({
    default: m.GuestDetailPage,
  }))
);

export const Route = createFileRoute("/admin/guests/$guestId/")({
  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { guestId } = params;
    const { queryClient } = context;

    // Prefetch guest data with related bookings
    const guestPromise = queryClient.ensureQueryData({
      queryKey: ["guest", guestId],
      queryFn: async () => {
        const { data, error } = await db.guests.byId(guestId);

        if (error) {
          console.error("[Guest Detail] Failed to fetch guest:", error);
          throw new Error(`Failed to load guest: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Prefetch all bookings by this guest
    const bookingsPromise = queryClient.ensureQueryData({
      queryKey: ["bookings", "guest", guestId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("bookings")
          .select(
            `
            *,
            unit:units(unit_name, unit_code)
          `
          )
          .eq("guest_id", guestId)
          .order("check_in", { ascending: false });

        if (error) {
          console.error("[Guest Detail] Failed to fetch bookings:", error);
          return [];
        }

        return data || [];
      },
      staleTime: 30000, // 30 seconds
    });

    // Calculate guest statistics
    const guestStatsPromise = queryClient.ensureQueryData({
      queryKey: ["guest", guestId, "stats"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("bookings")
          .select("total_amount, booking_status")
          .eq("guest_id", guestId)
          .neq("booking_status", "Cancelled");

        if (error) {
          console.error("[Guest Detail] Failed to fetch guest stats:", error);
          return {
            total_bookings: 0,
            total_spent: 0,
            average_booking_value: 0,
          };
        }

        const total_bookings = data?.length || 0;
        const total_spent =
          data?.reduce((sum, booking) => sum + (booking.total_amount || 0), 0) || 0;
        const average_booking_value = total_bookings > 0 ? total_spent / total_bookings : 0;

        return {
          total_bookings,
          total_spent,
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
          queryKey: ["auditLogs", "guest", guestId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from("audit_logs")
              .select("*")
              .eq("table_name", "guests")
              .eq("record_id", guestId)
              .order("created_at", { ascending: false })
              .limit(50);

            if (error) {
              console.error("[Guest Detail] Failed to fetch audit logs:", error);
              return [];
            }

            return data || [];
          },
          staleTime: 60000, // 1 minute
        })
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [guestData, bookings, guestStats, auditLogs] = await Promise.all([
      guestPromise,
      bookingsPromise,
      guestStatsPromise,
      auditLogsPromise,
    ]);

    // Transform null to undefined for TypeScript compatibility
    const guest = {
      ...guestData,
      total_spent: guestData.total_spent ?? undefined,
      total_bookings: guestData.total_bookings ?? undefined,
    } as typeof guestData & {
      total_spent?: number;
      total_bookings?: number;
    };

    return {
      guest,
      bookings,
      guestStats,
      auditLogs,
      canViewAudit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Guest</h1>
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
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Guest Not Found</h1>
        <p className="mb-4 text-gray-600">
          The guest you are looking for does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Go Back to Guests
        </button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: GuestDetailComponent,
});

function GuestDetailComponent() {
  const { guestId } = Route.useParams();
  const { guest } = Route.useLoaderData();

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <GuestDetailPage guest={guest} guestId={guestId} />
      </Suspense>
    </ErrorBoundary>
  );
}
