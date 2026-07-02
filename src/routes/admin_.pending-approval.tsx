import { createFileRoute, redirect } from "@tanstack/react-router";

import { PendingApprovalPage } from "@/components/auth/PendingApprovalPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/admin_/pending-approval")({
  beforeLoad: async ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/admin/login" });
    }
    const { getUserAuditRole } = await import("@/lib/audit-roles");
    const role = await getUserAuditRole();
    if (role !== null) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: AdminPendingApprovalRoute,
});

function AdminPendingApprovalRoute() {
  return (
    <ErrorBoundary level="page">
      <PendingApprovalPage />
    </ErrorBoundary>
  );
}
