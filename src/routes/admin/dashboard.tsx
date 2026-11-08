import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PageLoader } from "@/components/patterns";
import { dashboardSearchSchema } from "@/lib/dashboard";
import { requireStaff } from "@/lib/route-guards";

// Lazy load the Dashboard component
const Dashboard = lazy(() =>
  import("@/components/dashboard/Dashboard").then((m) => ({ default: m.Dashboard }))
);

export const Route = createFileRoute("/admin/dashboard")({
  validateSearch: dashboardSearchSchema,
  beforeLoad: async () => {
    await requireStaff();
  },
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <ErrorBoundary level="component">
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
