/**
 * Auth Layout Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic layout for authentication pages
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";
import React from "react";

function AuthLayout() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Outlet />
    </div>
  );
}

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
});
