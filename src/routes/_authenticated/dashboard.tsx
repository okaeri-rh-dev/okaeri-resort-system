import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Dashboard } from "@/pages/Dashboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <ErrorBoundary level="component">
          <Dashboard />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
