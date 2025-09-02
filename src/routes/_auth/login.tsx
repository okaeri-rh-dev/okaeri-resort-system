/**
 * Login Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic login route rendering LoginPage
 */

import { createFileRoute } from "@tanstack/react-router";
import { LoginPage } from "@/features/auth/pages/LoginPage";

export const Route = createFileRoute("/_auth/login")({
  component: LoginPage,
});
