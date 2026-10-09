import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { requireManager } from "@/lib/route-guards";
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

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("units", unitId))
      : Promise.resolve([]);

    // Wait for all data to be loaded
    const [, auditLogs] = await Promise.all([unitPromise, auditLogsPromise]);

    return {
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
