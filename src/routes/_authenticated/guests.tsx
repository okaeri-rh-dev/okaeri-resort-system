import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import type { Guest } from "@/types";

// Lazy load components for better performance
const GuestsTable = lazy(() =>
  import("@/components/guests/GuestsTable").then((m) => ({ default: m.GuestsTable }))
);
const GuestDetailModal = lazy(() =>
  import("@/components/guests/GuestDetailModal").then((m) => ({ default: m.GuestDetailModal }))
);
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { z } from "zod";

const guestsSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/guests")({
  validateSearch: guestsSearchSchema,
  component: GuestsPage,
});

function GuestsPage() {
  const [viewingGuest, setViewingGuest] = useState<Guest | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);

  const handleViewGuest = (guest: Guest) => {
    setViewingGuest(guest);
    setShowViewDialog(true);
  };

  const handleEditGuest = (guest: Guest) => {
    // Future: Implement edit functionality
    console.log("Edit guest:", guest);
  };

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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            }
          >
            <GuestsTable onViewGuest={handleViewGuest} onEditGuest={handleEditGuest} />
          </Suspense>
        </ErrorBoundary>

        {/* View Guest Detail Dialog */}
        <Suspense fallback={null}>
          <GuestDetailModal
            guest={viewingGuest}
            open={showViewDialog}
            onOpenChange={(open) => {
              setShowViewDialog(open);
              if (!open) setViewingGuest(null);
            }}
          />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
