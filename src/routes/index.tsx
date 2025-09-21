/**
 * Index Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Root index route with basic redirect logic
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/authStore";
import { ROUTES } from "@/constants/routes";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // Simple redirect logic based on auth status
    const { isAuthenticated } = useAuthStore.getState();

    if (isAuthenticated) {
      // If authenticated, redirect to dashboard
      throw redirect({
        to: ROUTES.dashboard,
      });
    } else {
      // If not authenticated, redirect to login
      throw redirect({
        to: ROUTES.login,
      });
    }
  },
});
