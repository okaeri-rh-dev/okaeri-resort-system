import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/patterns";
import { MainLayout } from "@/layouts/MainLayout";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context, location }) => {
    // Check if user is authenticated
    // This runs for ALL /admin/* routes
    if (!context.isAuthenticated) {
      throw redirect({
        to: "/admin/login",
        search: {
          // Store the attempted URL to redirect back after login
          redirect: location.href,
        },
      });
    }

    // Check if user has a role assigned
    const { getUserAuditRole } = await import("@/lib/audit-roles");
    const role = await getUserAuditRole();
    if (role === null) {
      throw redirect({ to: "/admin/pending-approval" });
    }

    return { userRole: role };
  },
  component: AdminLayout,
  errorComponent: ({ reset }) => (
    <ErrorBoundary level="app">
      <MainLayout>
        <div className="flex min-h-96 items-center justify-center">
          <div className="text-center">
            <h2 className="text-destructive mb-4 text-xl font-semibold">Authentication Error</h2>
            <p className="text-muted-foreground mb-4">
              There was a problem with your authentication.
            </p>
            <div className="flex justify-center gap-4">
              <Button onClick={reset}>Try Again</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void auth.signOut().finally(() => {
                    window.location.href = "/admin/login";
                  });
                }}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    </ErrorBoundary>
  ),
});

function AdminLayout() {
  return (
    <ErrorBoundary level="page">
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ErrorBoundary>
  );
}
