import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotFoundPage } from "@/components/NotFoundPage";
import { Button, Toaster } from "@/components/patterns";
import { UpdateToast } from "@/components/pwa/UpdateToast";

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
          <h1 className="text-destructive mb-4 text-2xl font-bold">Application Error</h1>
          <p className="text-muted-foreground mb-4">Something went wrong with the application.</p>
          <pre className="bg-muted max-w-md overflow-auto rounded p-4 text-left text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Reload Application
          </Button>
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
