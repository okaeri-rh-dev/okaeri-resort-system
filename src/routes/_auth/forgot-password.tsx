/**
 * Forgot Password Route
 * Handles password reset requests with redirect logic for authenticated users
 */

import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";

export const Route = createFileRoute("/_auth/forgot-password")({
  beforeLoad: async () => {
    // Auth layout already handles guest requirement
    return {
      isForgotPasswordPage: true,
    };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Forgot Password Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading password recovery..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading password recovery page..." />}>
      <ForgotPasswordPage />
    </Suspense>
  ),
});
