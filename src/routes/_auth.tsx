/**
 * Authentication layout route for login, register, and related pages
 * Redirects authenticated users to dashboard and provides consistent auth UI
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { requireGuest } from "@/lib/router-guards";
import { AuthLayout } from "@/layouts/AuthLayout";
import { Suspense } from "react";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ location }) => {
    // Redirect authenticated users away from auth pages
    await requireGuest(location, "/dashboard");

    return {
      isAuthPage: true,
    };
  },

  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || "/dashboard",
      reason: search.reason as string | undefined,
      token: search.token as string | undefined, // For email verification, password reset
      error: search.error as string | undefined,
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
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.268 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
              Authentication Error
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Something went wrong with the authentication process.
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
                onClick={() => (window.location.href = "/")}
                className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-800"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },

  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="border-ocean-600 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
          Checking authentication status...
        </p>
      </div>
    </div>
  ),

  component: AuthLayoutComponent,
});

function AuthLayoutComponent() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <div className="border-ocean-600 mx-auto h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Loading authentication page...
            </p>
          </div>
        </div>
      }
    >
      <AuthLayout>
        <Outlet />
      </AuthLayout>
    </Suspense>
  );
}
