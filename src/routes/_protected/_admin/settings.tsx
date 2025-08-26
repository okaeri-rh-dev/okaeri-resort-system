/**
 * Admin Settings Route
 * System-wide configuration and management for administrators
 */

import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";
import { requirePermissions } from "@/lib/router-guards";

export const Route = createFileRoute("/_protected/_admin/settings")({
  beforeLoad: async ({ location, context }) => {
    // Require specific permissions for system settings
    const authResult = await requirePermissions(
      [
        { resource: "system", action: "configure" },
        { resource: "users", action: "manage" },
      ],
      location,
      {
        redirectTo: "/unauthorized",
        preserveRedirect: true,
      }
    );

    return {
      user: authResult.user,
      authChecked: authResult.authChecked,
      isAdminSettings: true,
    };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Admin Settings Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading admin settings..." />,

  component: AdminSettingsComponent,
});

function AdminSettingsComponent() {
  const { user } = Route.useRouteContext();

  return (
    <Suspense fallback={<RouteLoadingFallback message="Loading admin settings..." />}>
      <div className="p-6">
        <h1 className="mb-6 text-3xl font-bold">System Administration</h1>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* User Management */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-xl font-semibold">User Management</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">Manage all users in the system</p>
            <button className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
              Manage Users
            </button>
          </div>

          {/* System Settings */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-xl font-semibold">System Configuration</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">Configure system-wide settings</p>
            <button className="mt-4 rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700">
              Open Settings
            </button>
          </div>

          {/* Audit Logs */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-xl font-semibold">Audit Logs</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              View system audit logs and security events
            </p>
            <button className="mt-4 rounded bg-purple-600 px-4 py-2 text-white transition-colors hover:bg-purple-700">
              View Logs
            </button>
          </div>

          {/* Database Management */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-xl font-semibold">Database Management</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Database maintenance and backup operations
            </p>
            <button className="mt-4 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700">
              Database Tools
            </button>
          </div>

          {/* Performance Monitoring */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-xl font-semibold">Performance Monitoring</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Monitor system performance and metrics
            </p>
            <button className="mt-4 rounded bg-yellow-600 px-4 py-2 text-white transition-colors hover:bg-yellow-700">
              View Metrics
            </button>
          </div>

          {/* Security Settings */}
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <h2 className="mb-2 text-xl font-semibold">Security Settings</h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              Configure security policies and access controls
            </p>
            <button className="mt-4 rounded bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700">
              Security Config
            </button>
          </div>
        </div>

        {/* Current Admin Info */}
        <div className="mt-8 rounded bg-gray-100 p-4 dark:bg-gray-700">
          <h3 className="font-semibold">Administrator Info:</h3>
          <p>Name: {user.name}</p>
          <p>Email: {user.email}</p>
          <p>Role: {user.role}</p>
          <p>Last Login: {new Date().toLocaleString()}</p>
        </div>
      </div>
    </Suspense>
  );
}
