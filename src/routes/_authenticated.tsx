import { createFileRoute, redirect, Outlet, useRouter } from "@tanstack/react-router";
import { MainLayout } from "@/layouts/MainLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
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
      <MainLayout currentPath="/">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-4">There was a problem with your authentication.</p>
            <div className="space-x-4">
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Try Again
              </button>
              <button
                onClick={() => {
                  auth.signOut();
                  window.location.href = "/login";
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
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
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  return (
    <ErrorBoundary level="page">
      <MainLayout currentPath={currentPath}>
        <Outlet />
      </MainLayout>
    </ErrorBoundary>
  );
}
