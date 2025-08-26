import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { LoginPage } from "@/pages/LoginPage";
import { RouteErrorBoundary, RouteLoadingFallback, validateSearchParams } from "@/lib/route-utils";
import { LoginSearchSchema } from "@/types/route-params";

export const Route = createFileRoute("/_auth/login")({
  validateSearch: LoginSearchSchema,

  beforeLoad: async ({ search }) => {
    // Validate search parameters
    const searchParams = validateSearchParams(LoginSearchSchema, search);

    // Auth layout already handles guest requirement
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
