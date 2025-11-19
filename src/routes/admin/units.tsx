import { lazy, Suspense, useState } from "react";

import { createFileRoute, Outlet, useMatches, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PricingInfoCard } from "@/components/pricing/PricingInfoCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Unit } from "@/types";

// Lazy load components for better performance
const UnitsTable = lazy(() =>
  import("@/components/units/UnitsTable").then((m) => ({ default: m.UnitsTable }))
);
const UnitForm = lazy(() =>
  import("@/components/units/UnitForm").then((m) => ({ default: m.UnitForm }))
);

const unitsSearchSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute("/admin/units")({
  validateSearch: unitsSearchSchema,
  component: UnitsPage,
});

function UnitsPage() {
  const navigate = useNavigate();
  const matches = useMatches();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Navigate to dedicated detail and edit routes instead of using modals
  const handleViewUnit = (unit: Unit) => {
    navigate({ to: "/admin/units/$unitId", params: { unitId: unit.unit_id } });
  };

  const handleEditUnit = (unit: Unit) => {
    navigate({ to: "/admin/units/$unitId/edit", params: { unitId: unit.unit_id } });
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
  };

  // Check if we have any child routes active (unit detail, pricing, etc.)
  // If matches.length > 2, we have: root -> _authenticated -> units -> [child route]
  const hasChildRoute = matches.length > 3;

  // If we're viewing any child route, render the outlet
  if (hasChildRoute) {
    return (
      <ErrorBoundary level="page">
        <Outlet />
      </ErrorBoundary>
    );
  }

  // Otherwise, render the units table page

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cabins</h1>
            <p className="text-muted-foreground">Manage resort cabins and availability</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>Add Cabin</Button>
        </div>

        {/* Pricing Configuration Card */}
        <ErrorBoundary level="component">
          <PricingInfoCard onEdit={() => navigate({ to: "/admin/units/pricing" })} />
        </ErrorBoundary>

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              </div>
            }
          >
            <UnitsTable onViewUnit={handleViewUnit} onEditUnit={handleEditUnit} />
          </Suspense>
        </ErrorBoundary>

        {/* Create Unit Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Cabin</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
                  </div>
                }
              >
                <UnitForm
                  onSuccess={handleCreateSuccess}
                  onCancel={() => setShowCreateDialog(false)}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
