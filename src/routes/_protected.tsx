import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { requireAuth } from "@/lib/router-guards";

/**
 * Protected route layout with enhanced security
 * Implements comprehensive authentication guards using reusable router-guards
 */
export const Route = createFileRoute("/_protected")({
  beforeLoad: async ({ location }) => {
    // Use the comprehensive auth guard
    const authResult = await requireAuth(location, {
      redirectTo: "/login",
      preserveRedirect: true,
      loadProjects: true,
      enableSessionMonitoring: true,
    });

    // Return context for child routes
    return {
      user: authResult.user,
      authChecked: authResult.authChecked,
    };
  },

  errorComponent: ({ error, reset }) => {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <svg
                className="h-6 w-6 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Access Denied
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You don't have permission to access this page.
            </p>
            {error.message && (
              <p className="mt-2 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error.message}
              </p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={reset}
                className="bg-ocean-600 hover:bg-ocean-700 focus:ring-ocean-500 flex-1 rounded-md px-4 py-2 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-gray-800"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = "/login")}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },

  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
}
