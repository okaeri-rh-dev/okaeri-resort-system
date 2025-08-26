import { createRootRoute, Outlet } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ErrorBoundary } from "react-error-boundary";
import { queryClient } from "@/lib/query-client";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useEffect } from "react";
import type { ReactNode } from "react";

/**
 * Root route context providing authentication and project state
 */
interface RootContext {
  auth: ReturnType<typeof useAuthStore.getState>;
  project: ReturnType<typeof useProjectStore.getState>;
}

/**
 * Error fallback component for route-level errors
 */
function RouteErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
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
            Application Error
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Something went wrong while loading the application.
          </p>
          {error.message && (
            <p className="mt-2 rounded bg-red-50 p-2 font-mono text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error.message}
            </p>
          )}
          <div className="mt-6">
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="bg-ocean-600 hover:bg-ocean-700 focus:ring-ocean-500 w-full rounded-md px-4 py-2 text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Root layout component with theme management and notifications
 */
function RootLayoutComponent({ children }: { children: ReactNode }) {
  const theme = useUIStore((state) => state.theme);
  const notifications = useUIStore((state) => state.notifications);
  const removeNotification = useUIStore((state) => state.removeNotification);
  const globalLoading = useUIStore((state) => state.globalLoading);
  const loadingMessage = useUIStore((state) => state.loadingMessage);

  useEffect(() => {
    // Apply theme class to html element
    const root = document.documentElement;
    if (
      theme === "dark" ||
      (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main content */}
      {children}

      {/* Toast notifications */}
      {notifications.length > 0 && (
        <div className="pointer-events-none fixed right-0 bottom-0 z-50 flex flex-col gap-2 p-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`pointer-events-auto flex max-w-md min-w-[300px] items-start gap-3 rounded-lg p-4 shadow-lg ${notification.type === "success" ? "bg-green-50 text-green-900 dark:bg-green-900 dark:text-green-100" : ""} ${notification.type === "error" ? "bg-red-50 text-red-900 dark:bg-red-900 dark:text-red-100" : ""} ${notification.type === "warning" ? "bg-yellow-50 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100" : ""} ${notification.type === "info" ? "bg-blue-50 text-blue-900 dark:bg-blue-900 dark:text-blue-100" : ""} `}
            >
              <div className="flex-1">
                <p className="font-semibold">{notification.title}</p>
                {notification.message && (
                  <p className="mt-1 text-sm opacity-90">{notification.message}</p>
                )}
                {notification.action && (
                  <button
                    onClick={notification.action.onClick}
                    className="mt-2 text-sm font-medium underline hover:no-underline"
                  >
                    {notification.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => removeNotification(notification.id)}
                className="shrink-0 text-current opacity-60 hover:opacity-100"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Global loading indicator */}
      {globalLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <div className="flex flex-col items-center">
              <div className="border-ocean-600 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent" />
              {loadingMessage && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">{loadingMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,

  validateSearch: (search: Record<string, unknown>) => {
    // Optional global search parameter validation
    return {
      theme: search.theme as string | undefined,
      lang: search.lang as string | undefined,
      debug: Boolean(search.debug),
    };
  },

  beforeLoad: ({ search }) => {
    // Apply global settings from search parameters
    if (search?.theme && ["light", "dark", "system"].includes(search.theme)) {
      useUIStore.getState().setTheme(search.theme as "light" | "dark" | "system");
    }

    return {
      auth: useAuthStore.getState(),
      project: useProjectStore.getState(),
      globalSearch: search,
    } as RootContext & { globalSearch: any };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorFallback error={error} resetErrorBoundary={reset} />
  ),
});

function RootComponent() {
  return (
    <ErrorBoundary FallbackComponent={RouteErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <RootLayoutComponent>
          <Outlet />
        </RootLayoutComponent>
        {/* React Query Devtools - only in development */}
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
