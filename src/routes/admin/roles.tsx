import { createFileRoute, redirect } from "@tanstack/react-router";

import { RoleManagementPage } from "@/components/admin/RoleManagementPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuditRole, getUserAuditRole } from "@/lib/audit-roles";
import { logger } from "@/lib/logger";

export const Route = createFileRoute("/admin/roles")({
  beforeLoad: async () => {
    const userRole = await getUserAuditRole();

    if (userRole !== AuditRole.ADMIN) {
      logger.warn("Unauthorized access attempt to roles page", {
        userRole,
        attemptedRoute: "/admin/roles",
      });

      throw redirect({
        to: "/admin/dashboard",
        search: {
          error: "unauthorized",
          message: "Only administrators can manage user roles",
        },
      });
    }

    logger.info("Admin accessing roles page", { userRole });
  },

  component: RolesPage,
});

function RolesPage() {
  return (
    <ErrorBoundary level="page">
      <RoleManagementPage />
    </ErrorBoundary>
  );
}
