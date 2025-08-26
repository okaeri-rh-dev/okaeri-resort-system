import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { useAuthStore } from "@/stores/authStore";
import { LoginPage } from "@/pages/LoginPage";
import { RouteErrorBoundary, RouteLoadingFallback, validateSearchParams } from "@/lib/route-utils";
import { LoginSearchSchema, type LoginSearchParams } from "@/types/route-params";

export const Route = createFileRoute("/login")({
  validateSearch: LoginSearchSchema,

  beforeLoad: async ({ search }) => {
    // Validate search parameters
    const searchParams = validateSearchParams(LoginSearchSchema, search);

    // Redirect to dashboard if already authenticated
    const { isAuthenticated } = useAuthStore.getState();
    if (isAuthenticated) {
      const redirectTo = searchParams.redirect || "/dashboard";
      throw redirect({
        to: redirectTo,
      });
    }

    return { searchParams };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Login Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading login..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading login page..." />}>
      <LoginPage />
    </Suspense>
  ),
});
