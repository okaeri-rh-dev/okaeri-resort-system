import { createFileRoute, notFound } from "@tanstack/react-router";
import { db } from "@/lib/supabase";
import { hasAuditRole, AuditRole } from "@/lib/audit-roles";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DetailPageSkeleton } from "@/components/entity-detail/DetailPageSkeleton";
import { lazy, Suspense } from "react";

// Lazy load the edit page component
const GuestEditPage = lazy(() =>
  import("@/components/guests/GuestEdit").then((m) => ({
    default: m.GuestEditPage,
  }))
);

export const Route = createFileRoute("/_authenticated/guests/$guestId/edit")({
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

    // Prefetch guest data
    const guestPromise = queryClient.ensureQueryData({
      queryKey: ["guest", guestId],
      queryFn: async () => {
        const { data, error } = await db.guests.byId(guestId);

        if (error) {
          console.error("[Guest Edit] Failed to fetch guest:", error);
          throw new Error(`Failed to load guest: ${error.message}`);
        }

        if (!data) {
          throw notFound();
        }

        return data;
      },
      staleTime: 30000, // 30 seconds
    });

    // Wait for data to be loaded
    const [guest] = await Promise.all([guestPromise]);

    return {
      guest,
    };
  },

  // Error component for failed data loading
  errorComponent: ({ error }) => (
    <ErrorBoundary level="page">
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Failed to Load Guest Editor</h1>
          <p className="text-gray-600 mb-4">
            {error instanceof Error ? error.message : "An unexpected error occurred"}
          </p>
          {error instanceof Error && error.message.includes("permission") ? (
            <p className="text-sm text-gray-500 mb-4">
              Please contact your administrator if you need access to edit guests.
            </p>
          ) : null}
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
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Guest Not Found</h1>
        <p className="text-gray-600 mb-4">
          The guest you are trying to edit does not exist or has been removed.
        </p>
        <button
          onClick={() => window.history.back()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
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
