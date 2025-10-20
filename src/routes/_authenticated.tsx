import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MainLayout } from "@/layouts/MainLayout";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ context, location }) => {
    // Check if user is authenticated
    if (!context.isAuthenticated) {
      throw redirect({
        to: "/login",
        search: {
          // Store the attempted URL to redirect back after login
          redirect: location.href,
        },
      });
    }
  },
  component: AuthenticatedLayout,
  errorComponent: ({ reset }) => (
    <ErrorBoundary level="app">
      <MainLayout>
        <div className="flex min-h-96 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-4 text-xl font-semibold text-red-600">Authentication Error</h2>
            <p className="mb-4 text-gray-600">There was a problem with your authentication.</p>
            <div className="space-x-4">
              <button
                onClick={reset}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  auth.signOut();
                  window.location.href = "/login";
                }}
                className="rounded bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </MainLayout>
    </ErrorBoundary>
  ),
});

function AuthenticatedLayout() {
  return (
    <ErrorBoundary level="page">
      <MainLayout>
        <Outlet />
      </MainLayout>
    </ErrorBoundary>
  );
}
