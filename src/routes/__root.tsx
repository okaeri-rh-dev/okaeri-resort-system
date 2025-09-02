/**
 * Root Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic root layout with minimal functionality
 */

import { createRootRoute, Outlet } from "@tanstack/react-router";
import React, { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";

function RootComponent() {
  const { initializeAuth } = useAuthStore();

  // Initialize auth on app start
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <>
      <div className="bg-background min-h-screen">
        <Outlet />
      </div>
    </>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
