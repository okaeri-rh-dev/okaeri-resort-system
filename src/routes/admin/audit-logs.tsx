// src/routes/_authenticated/audit-logs.tsx

import { createFileRoute, redirect } from "@tanstack/react-router";

import { AuditFilters } from "@/components/audit/AuditFilters";
import { AuditLogViewer } from "@/components/audit/AuditLogViewer";
import { AuditStatsPanel } from "@/components/audit/AuditStatsPanel";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/patterns";
import { useAuditStats } from "@/lib/audit-hooks";
import { isCurrentUserOwner } from "@/lib/audit-logger";
import { useAuditStore } from "@/stores/useAuditStore";

// ============================================
// ROUTE DEFINITION
// ============================================

export const Route = createFileRoute("/admin/audit-logs")({
  component: AuditLogsPage,

  // Route loader - check access before rendering
  beforeLoad: async () => {
    // Check if user is owner/manager
    const isOwner = await isCurrentUserOwner();

    if (!isOwner) {
      // Redirect to dashboard if not authorized
      throw redirect({
        to: "/admin/dashboard",
        search: {
          error: "unauthorized",
          message: "You do not have permission to access audit logs",
        } as Record<string, string>,
      });
    }
  },
});

// ============================================
// PAGE COMPONENT
// ============================================

function AuditLogsPage() {
  const filters = useAuditStore((state) => state.filters);
  const showFilters = useAuditStore((state) => state.showFilters);
  const toggleFilters = useAuditStore((state) => state.toggleFilters);

  const { data: stats, isLoading: statsLoading } = useAuditStats(filters);

  return (
    <ErrorBoundary level="page">
      <div className="container mx-auto space-y-6 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Trail</h1>
            <p className="text-muted-foreground">View system changes and user activity logs</p>
          </div>

          <button
            onClick={toggleFilters}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {showFilters ? "Hide" : "Show"} Filters
          </button>
        </div>

        {/* Statistics Panel */}
        <AuditStatsPanel stats={stats} isLoading={statsLoading} />

        {/* Filters Section */}
        {showFilters && (
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter audit logs by date, user, table, or action</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditFilters />
            </CardContent>
          </Card>
        )}

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>
              {filters.tableName
                ? `Showing logs for ${filters.tableName}`
                : "Showing all system logs"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuditLogViewer />
          </CardContent>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
