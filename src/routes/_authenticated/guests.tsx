import { createFileRoute } from "@tanstack/react-router";
import { GuestsTable } from "@/components/guests/GuestsTable";
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
          <GuestsTable />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
