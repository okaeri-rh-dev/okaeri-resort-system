import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, hasAuditRole } from "@/lib/audit-roles";
import { guestDetailQuery } from "@/stores/useGuestStore";

// Lazy load the edit page component
const GuestEditPage = lazy(() =>
  import("@/components/guests/GuestEdit").then((m) => ({
    default: m.GuestEditPage,
  }))
);

export const Route = createFileRoute("/admin/guests/$guestId/edit")({
  // Before load - check permissions
  beforeLoad: async () => {
    // Check if user has permission to edit guests (Manager or higher)
    const canEdit = await hasAuditRole(AuditRole.MANAGER);

    if (!canEdit) {
      throw new Error("You do not have permission to edit guests. Manager role required.");
    }
  },

  // Loader function to prefetch all necessary data
  loader: async ({ params, context }) => {
    const { guestId } = params;
    const { queryClient } = context;

    const guest = await queryClient.ensureQueryData(guestDetailQuery(guestId));

    return {
      guest,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Failed to Load Guest Editor</h1>
          <p className="mb-4 text-gray-600">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="mb-4 text-sm text-gray-500">
              Please contact your administrator if you need access to edit guests.
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
        <h1 className="mb-4 text-2xl font-bold text-gray-800">Guest Not Found</h1>
        <p className="mb-4 text-gray-600">
          The guest you are trying to edit does not exist or has been removed.
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
  component: GuestEditComponent,
});

function GuestEditComponent() {
  return (
    <ErrorBoundary level="page">
      <Suspense fallback={<DetailPageSkeleton />}>
        <GuestEditPage />
      </Suspense>
    </ErrorBoundary>
  );
}
