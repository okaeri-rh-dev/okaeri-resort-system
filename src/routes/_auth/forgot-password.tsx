/**
 * Forgot Password Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic forgot password route rendering PasswordResetPage
 */

import { createFileRoute } from "@tanstack/react-router";
import { PasswordResetPage } from "@/features/auth/pages/PasswordResetPage";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: PasswordResetPage,
});
