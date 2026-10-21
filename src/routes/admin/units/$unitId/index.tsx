import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
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
          <h1 className="text-destructive mb-4 text-2xl font-bold">Failed to Load Cabin</h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          <Button onClick={() => window.history.back()}>Go Back</Button>
        </div>
      </div>
    </ErrorBoundary>
  ),

  // Not found component
  notFoundComponent: () => (
    <div className="container mx-auto py-8">
      <div className="text-center">
        <h1 className="text-foreground mb-4 text-2xl font-bold">Cabin Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The unit you are looking for does not exist or has been removed.
        </p>
        <Button onClick={() => window.history.back()}>Go Back to Cabins</Button>
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
