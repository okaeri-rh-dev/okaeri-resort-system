import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UnitsTable } from "@/components/units/UnitsTable";
import { UnitForm } from "@/components/units/UnitForm";
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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleViewUnit = (unit: Unit) => {
    // Future: Could open a read-only view dialog
    console.log("View unit:", unit);
  };

  const handleEditUnit = (unit: Unit) => {
    setSelectedUnit(unit);
    setShowEditDialog(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setSelectedUnit(null);
  };

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Units</h1>
            <p className="text-muted-foreground">Manage resort units and availability</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>Add Unit</Button>
        </div>

        <ErrorBoundary level="component">
          <UnitsTable onViewUnit={handleViewUnit} onEditUnit={handleEditUnit} />
        </ErrorBoundary>

        {/* Create Unit Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Unit</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              <UnitForm onSuccess={handleCreateSuccess} />
            </ErrorBoundary>
          </DialogContent>
        </Dialog>

        {/* Edit Unit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Unit</DialogTitle>
            </DialogHeader>
            <ErrorBoundary level="component">
              {selectedUnit && <UnitForm unit={selectedUnit} onSuccess={handleEditSuccess} />}
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
