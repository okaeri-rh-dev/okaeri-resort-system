/**
 * Dashboard Route - TanStack Router
 * Phase 4.4 Week 1.2 - Financial Dashboard Components Implementation
 *
 * Professional Enterprise Financial Dashboard showcasing Report Engine integration
 */

import { createFileRoute } from "@tanstack/react-router";
import React from "react";
import { useAuthStore } from "@/stores/authStore";
import { useProjectStore } from "@/stores/projectStore";
import { Button } from "@/components/ui/button";
import FinancialDashboard from "@/components/dashboard/FinancialDashboard";

function Dashboard() {
  const { user, logout } = useAuthStore();
  const { currentProject } = useProjectStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleExport = (format: "excel" | "pdf" | "quickbooks") => {
    console.log(`Exporting dashboard data as ${format}`);
    // This would integrate with the Report Engine's export service
  };

  // If no project is selected, show project selection
  if (!currentProject) {
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

          <div className="rounded-lg border bg-yellow-50 p-6">
            <h2 className="mb-4 text-xl font-semibold text-yellow-800">Project Required</h2>
            <p className="text-yellow-700">
              Please select a project to view the financial dashboard. The dashboard requires a
              project context to load financial data from the Report Engine Service.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                {currentProject.name} Dashboard
              </h1>
              <p className="text-sm text-neutral-600">
                Welcome back, {user?.name || user?.email} • Project: {currentProject.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="container mx-auto px-4 py-6">
        <FinancialDashboard
          projectId={currentProject.id}
          autoRefresh={true}
          refreshInterval={5 * 60 * 1000} // 5 minutes
          onExport={handleExport}
          className="space-y-6"
        />
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_protected/dashboard")({
  component: Dashboard,
});
