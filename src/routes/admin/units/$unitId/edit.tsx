import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
import { requireManager } from "@/lib/route-guards";
import { unitDetailQuery } from "@/stores/useUnitStore";

// Lazy load the edit page component
const UnitEditPage = lazy(() =>
  import("@/components/units/UnitEdit").then((m) => ({
    default: m.UnitEditPage,
  }))
);

export const Route = createFileRoute("/admin/units/$unitId/edit")({
  // Before load - check owner permission
  beforeLoad: async () => {
    await requireManager();
  },

  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { unitId } = params;
    const { queryClient } = context;

    const unit = await queryClient.ensureQueryData(unitDetailQuery(unitId));

    return {
      unit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-destructive mb-4 text-2xl font-bold">Failed to Load Cabin Editor</h1>
          <p className="text-muted-foreground mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="text-muted-foreground mb-4 text-sm">
              Please contact your administrator if you need access to edit units.
            </p>
          ) : null}
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
          The unit you are trying to edit does not exist or has been removed.
        </p>
        <Button onClick={() => window.history.back()}>Go Back to Cabins</Button>
      </div>
    </div>
  ),

  // Pending component while data is loading
  pendingComponent: () => <DetailPageSkeleton />,

  // Main component
  component: UnitEditComponent,
});

function UnitEditComponent() {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <UnitEditPage />
      </Suspense>
    </ErrorBoundary>
  );
}
