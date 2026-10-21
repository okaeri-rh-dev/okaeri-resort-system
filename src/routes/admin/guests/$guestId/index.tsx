import { lazy, Suspense } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
import { recentRecordAuditLogsQuery } from "@/lib/audit-hooks";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { guestDetailQuery } from "@/stores/useGuestStore";

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

    const guestPromise = queryClient.ensureQueryData(guestDetailQuery(guestId));

    // Check if user has permission to view audit logs
    const canViewAudit = await hasAuditRole(AuditRole.MANAGER);

    // Prefetch audit logs only if user has permission
    const auditLogsPromise = canViewAudit
      ? queryClient.ensureQueryData(recentRecordAuditLogsQuery("guests", guestId))
      : Promise.resolve([]);

    const [, auditLogs] = await Promise.all([guestPromise, auditLogsPromise]);

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
          <h1 className="text-destructive mb-4 text-2xl font-bold">Failed to Load Guest</h1>
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
        <h1 className="text-foreground mb-4 text-2xl font-bold">Guest Not Found</h1>
        <p className="text-muted-foreground mb-4">
          The guest you are looking for does not exist or has been removed.
        </p>
        <Button onClick={() => window.history.back()}>Go Back to Guests</Button>
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
  const { data: guest } = useSuspenseQuery(guestDetailQuery(guestId));

  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <GuestDetailPage guest={guest} guestId={guestId} />
      </Suspense>
    </ErrorBoundary>
  );
}
