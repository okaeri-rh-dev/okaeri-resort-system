import { createFileRoute, useNavigate, Outlet, useParams } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";

// Lazy load components for better performance
const UnitsTable = lazy(() =>
  import("@/components/units/UnitsTable").then((m) => ({ default: m.UnitsTable }))
);
const UnitForm = lazy(() =>
  import("@/components/units/UnitForm").then((m) => ({ default: m.UnitForm }))
);
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { z } from "zod";
import type { Unit } from "@/types";

const unitsSearchSchema = z.object({
  status: z.string().optional(),
  type: z.string().optional(),
  search: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/units")({
  validateSearch: unitsSearchSchema,
  component: UnitsPage,
});

function UnitsPage() {
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const isDetailView = !!(params as any).unitId;
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Navigate to dedicated detail and edit routes instead of using modals
  const handleViewUnit = (unit: Unit) => {
    navigate({ to: "/units/$unitId", params: { unitId: unit.unit_id } });
  };

  const handleEditUnit = (unit: Unit) => {
    navigate({ to: "/units/$unitId/edit", params: { unitId: unit.unit_id } });
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
  };

  // If we're viewing a specific unit detail, render the child route
  if (isDetailView) {
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

        <ErrorBoundary level="component">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            }
          >
            <UnitsTable onViewUnit={handleViewUnit} onEditUnit={handleEditUnit} />
          </Suspense>
        </ErrorBoundary>

        {/* Create Unit Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Cabin</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <Suspense
                fallback={
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                }
              >
                <UnitForm onSuccess={handleCreateSuccess} />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
