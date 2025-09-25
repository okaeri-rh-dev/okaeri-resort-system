import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

// Lazy load component for better performance
const GuestsTable = lazy(() =>
  import("@/components/guests/GuestsTable").then((m) => ({ default: m.GuestsTable }))
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
            <GuestsTable />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
