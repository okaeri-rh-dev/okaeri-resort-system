import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotFoundPage } from "@/components/NotFoundPage";
import { UpdateToast } from "@/components/pwa/UpdateToast";
import { Toaster } from "@/components/ui/sonner";

export interface RouterContext {
  queryClient: QueryClient;
  isAuthenticated: boolean;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => (
    <ErrorBoundary level="app">
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-red-600">Application Error</h1>
          <p className="mb-4 text-gray-600">Something went wrong with the application.</p>
          <pre className="max-w-md overflow-auto rounded bg-gray-100 p-4 text-left text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Reload Application
          </button>
        </div>
      </div>
    </ErrorBoundary>
  ),
});

function RootComponent() {
  return (
    <ErrorBoundary level="app">
      <div className="min-h-screen">
        <Outlet />
        <Toaster />
        <UpdateToast />
        {/* Not under browser automation: the floating button covers the bottom bar and rail */}
        {import.meta.env.DEV && !navigator.webdriver && <TanStackRouterDevtools />}
      </div>
    </ErrorBoundary>
  );
}
