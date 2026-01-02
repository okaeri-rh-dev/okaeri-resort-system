import { lazy, Suspense } from "react";

import { createFileRoute, notFound } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { db } from "@/lib/supabase";

// Lazy load the edit page component
const UnitEditPage = lazy(() =>
  import("@/components/units/UnitEdit").then((m) => ({
    default: m.UnitEditPage,
  }))
);

export const Route = createFileRoute("/admin/units/$unitId/edit")({
  // Before load - check permissions
  beforeLoad: async () => {
    // Check if user has permission to edit units (Manager or higher)
    const canEdit = await hasAuditRole(AuditRole.MANAGER);

    if (!canEdit) {
      throw new Error("You do not have permission to edit units. Manager role required.");
    }
  },

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
          console.error("[Unit Edit] Failed to fetch unit:", error);
          throw new Error(`Failed to load unit: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Wait for data to be loaded
    const [unit] = await Promise.all([unitPromise]);

    return {
      unit,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Unit Editor</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="mb-4 text-sm text-gray-500">
              Please contact your administrator if you need access to edit units.
            </p>
          ) : null}
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
          The unit you are trying to edit does not exist or has been removed.
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
