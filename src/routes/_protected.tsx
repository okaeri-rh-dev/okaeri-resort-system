/**
 * Protected Layout Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic protected layout with simple auth check
 */

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import React from "react";
import { useAuthStore } from "@/stores/authStore";

function ProtectedLayout() {
  return (
    <div className="bg-background min-h-screen">
      <Outlet />
    </div>
  );
}

export const Route = createFileRoute("/_protected")({
  beforeLoad: async () => {
    // Basic auth check - redirect to login if not authenticated
    const { isAuthenticated } = useAuthStore.getState();

    if (!isAuthenticated) {
      throw redirect({
        to: "/login",
      });
    }
  },
  component: ProtectedLayout,
});
