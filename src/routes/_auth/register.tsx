/**
 * Register Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic register route rendering RegisterPage
 */

import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";

export const Route = createFileRoute("/_auth/register")({
  component: RegisterPage,
});
