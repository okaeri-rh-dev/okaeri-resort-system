import { lazy, Suspense } from "react";

import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { requireManager } from "@/lib/route-guards";
import type { Guest } from "@/types";

// Lazy load components for better performance
const GuestsTable = lazy(() =>
  import("@/components/guests/GuestsTable").then((m) => ({ default: m.GuestsTable }))
);

const guestsSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/admin/guests")({
  beforeLoad: async () => {
    await requireManager();
  },
  validateSearch: guestsSearchSchema,
  component: GuestsPage,
});

function GuestsPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isDetailView = !!(params as any).guestId;

  // Navigate to dedicated detail and edit routes instead of using modals
  const handleViewGuest = (guest: Guest) => {
    navigate({ to: "/admin/guests/$guestId", params: { guestId: guest.guest_id } });
  };

  const handleEditGuest = (guest: Guest) => {
    navigate({ to: "/admin/guests/$guestId/edit", params: { guestId: guest.guest_id } });
  };

  // If we're viewing a specific guest detail, render the child route
  if (isDetailView) {
    return (
      <ErrorBoundary level="page">
        <Outlet />
      </ErrorBoundary>
    );
  }

  // Otherwise, render the guests table page
  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guests</h1>
          <p className="text-muted-foreground">View and manage guest information</p>
        </div>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            }
          >
            <GuestsTable onViewGuest={handleViewGuest} onEditGuest={handleEditGuest} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
