/**
 * Reset Password Route
 * Handles password reset with token validation and redirect logic for authenticated users
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { z } from "zod";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { RouteErrorBoundary, RouteLoadingFallback } from "@/lib/route-utils";

// Search params validation schema
const ResetPasswordSearchSchema = z.object({
  token: z.string().min(1, "Reset token is required").optional(),
});

export type ResetPasswordSearchParams = z.infer<typeof ResetPasswordSearchSchema>;

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: ResetPasswordSearchSchema,

  beforeLoad: async ({ search }) => {
    // Auth layout already handles guest requirement

    // If no token is provided, redirect to forgot password
    if (!search.token) {
      throw redirect({
        to: "/_auth/forgot-password",
        search: {
          error: "Invalid or missing reset token",
        },
      });
    }

    return { searchParams: search };
  },

  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary
      error={error}
      reset={reset}
      info={{ componentStack: "Reset Password Route" }}
    />
  ),

  pendingComponent: () => <RouteLoadingFallback message="Loading password reset..." />,

  component: () => (
    <Suspense fallback={<RouteLoadingFallback message="Loading password reset page..." />}>
      <ResetPasswordPage />
    </Suspense>
  ),
});
