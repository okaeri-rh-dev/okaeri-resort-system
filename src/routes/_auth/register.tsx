/**
 * Register Route
 * Handles user registration with redirect logic for authenticated users
 */

import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { RegisterPage } from "@/pages/RegisterPage";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";

export const Route = createFileRoute("/_auth/register")({
  beforeLoad: async () => {
    // Auth layout already handles guest requirement
    return {
      isRegisterPage: true,
    };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} info={{ componentStack: "Register Route" }} />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading registration..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading registration page..." />}>
      <RegisterPage />
    </Suspense>
  ),
});
