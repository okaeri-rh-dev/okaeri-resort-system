import { lazy, Suspense } from "react";

import { createFileRoute } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { requireStaff } from "@/lib/route-guards";

// Lazy load the Dashboard component
const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));

export const Route = createFileRoute("/admin/dashboard")({
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
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            }
          >
            <Dashboard />
          </Suspense>
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}
