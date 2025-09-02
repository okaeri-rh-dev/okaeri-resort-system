/**
 * Dashboard Route - TanStack Router
 * Phase 1.2 GREEN Implementation
 *
 * Basic dashboard page for testing redirect logic
 */

import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";

function Dashboard() {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back, {user?.name || user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            Sign out
          </Button>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-xl font-semibold">Phase 1.2 GREEN - Basic Routing</h2>
          <p className="text-muted-foreground">
            You have successfully logged in and been redirected to the dashboard. This confirms that
            basic routing and authentication flow is working.
          </p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_protected/dashboard")({
  component: Dashboard,
});
