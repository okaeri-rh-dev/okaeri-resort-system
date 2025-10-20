import { lazy, Suspense, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";
import { Building, Settings, Shield, User } from "lucide-react";
import { z } from "zod";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Unit } from "@/types";

// Lazy load heavy components
const UnitsTable = lazy(() =>
  import("@/components/units/UnitsTable").then((m) => ({ default: m.UnitsTable }))
);
const UnitForm = lazy(() =>
  import("@/components/units/UnitForm").then((m) => ({ default: m.UnitForm }))
);

const settingsSearchSchema = z.object({
  tab: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: settingsSearchSchema,
  component: SettingsPage,
});

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setShowUnitForm(true);
  };

  const handleViewUnit = (unit: Unit) => {
    // Future: Could open a detailed view
    console.log("View unit:", unit);
  };

  return (
    <ErrorBoundary level="page">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage system settings and resort configuration</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="units" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Units
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resort Information</CardTitle>
                <CardDescription>Basic information about your resort</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Resort Name</label>
                    <p className="text-muted-foreground text-sm">Okaeri Resort</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Location</label>
                    <p className="text-muted-foreground text-sm">Not configured</p>
                  </div>
                </div>
                <Button variant="outline">Edit Resort Information</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Accommodation Units</h3>
                <p className="text-muted-foreground text-sm">Manage your resort units and rooms</p>
              </div>
              <Button onClick={() => setShowUnitForm(true)}>Add New Unit</Button>
            </div>

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
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Profile</CardTitle>
                <CardDescription>Manage your personal account settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Name</label>
                  <p className="text-muted-foreground text-sm">Not configured</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <p className="text-muted-foreground text-sm">Not configured</p>
                </div>
                <Button variant="outline">Edit Profile</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage security and access control</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <p className="text-muted-foreground text-sm">Last changed: Never</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Two-Factor Authentication</label>
                  <p className="text-muted-foreground text-sm">Disabled</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">Change Password</Button>
                  <Button variant="outline">Enable 2FA</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Unit Form Dialog */}
        <Dialog open={showUnitForm} onOpenChange={setShowUnitForm}>
          <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingUnit ? "Edit Unit" : "Add New Unit"}</DialogTitle>
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
                  unit={editingUnit || undefined}
                  onSuccess={() => {
                    setShowUnitForm(false);
                    setEditingUnit(null);
                  }}
                  onCancel={() => {
                    setShowUnitForm(false);
                    setEditingUnit(null);
                  }}
                />
              </Suspense>
            </ErrorBoundary>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
