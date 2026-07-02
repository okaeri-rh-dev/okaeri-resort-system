import { createFileRoute, redirect } from "@tanstack/react-router";

import { PendingApprovalPage } from "@/components/auth/PendingApprovalPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const Route = createFileRoute("/pending-approval")({
  beforeLoad: async ({ context }) => {
    // If not authenticated, redirect to login
    if (!context.isAuthenticated) {
      throw redirect({ to: "/login" });
    }

    // If user already has a role, redirect to dashboard
    const { getUserAuditRole } = await import("@/lib/audit-roles");
    const role = await getUserAuditRole();
    if (role !== null) {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  component: PendingApprovalRoute,
});

function PendingApprovalRoute() {
  return (
    <ErrorBoundary level="page">
      <PendingApprovalPage loginPath="/login" />
    </ErrorBoundary>
  );
}
