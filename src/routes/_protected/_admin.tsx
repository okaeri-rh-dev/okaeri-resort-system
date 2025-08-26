/**
 * Admin-only layout route
 * Implements role-based access control for administrative pages
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireRole } from "@/lib/router-guards";

export const Route = createFileRoute("/_protected/_admin")({
  beforeLoad: async ({ location, context }) => {
    // Require admin role - this will automatically redirect if user lacks admin role
    const authResult = await requireRole(["admin", "owner"], location, {
      redirectTo: "/unauthorized",
      preserveRedirect: true,
    });

    return {
      user: authResult.user,
      authChecked: authResult.authChecked,
      isAdminArea: true,
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
              Admin Access Required
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              You need administrator privileges to access this area.
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
                onClick={() => (window.location.href = "/_protected/dashboard")}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },

  component: AdminLayout,
});

function AdminLayout() {
  const { user } = Route.useRouteContext();

  return (
    <div>
      {/* Admin area indicator */}
      <div className="mb-4 rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
        <div className="flex items-center">
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 0h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
          <strong>Admin Area:</strong> You have administrative privileges as{" "}
          <strong>{user.role}</strong>.
        </div>
      </div>

      <Outlet />
    </div>
  );
}
