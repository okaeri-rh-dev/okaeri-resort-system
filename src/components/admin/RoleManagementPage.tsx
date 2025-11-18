// src/components/admin/RoleManagementPage.tsx

import { useState } from "react";

import { Shield, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type AppRole } from "@/lib/audit-roles";

import { GrantRoleDialog } from "./GrantRoleDialog";
import { RoleStatistics } from "./RoleStatistics";
import { DeactivateRoleDialog, UpdateRoleDialog } from "./UpdateRoleDialog";
import { UserRolesTable } from "./UserRolesTable";

// ============================================
// COMPONENT
// ============================================

export function RoleManagementPage() {
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);

  const handleUpdateRole = (role: AppRole) => {
    setSelectedRole(role);
    setShowUpdateDialog(true);
  };

  const handleDeactivateRole = (role: AppRole) => {
    setSelectedRole(role);
    setShowDeactivateDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Shield className="h-8 w-8" />
            User Roles
          </h1>
          <p className="text-muted-foreground mt-1">Manage system access and permissions</p>
        </div>
        <Button onClick={() => setShowGrantDialog(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Grant Role
        </Button>
      </div>

      {/* Statistics Cards */}
      <RoleStatistics />

      {/* User Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            View and manage role assignments for all users in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserRolesTable onUpdateRole={handleUpdateRole} onDeactivateRole={handleDeactivateRole} />
        </CardContent>
      </Card>

      {/* Dialogs */}
      <GrantRoleDialog open={showGrantDialog} onOpenChange={setShowGrantDialog} />
      <UpdateRoleDialog
        role={selectedRole}
        open={showUpdateDialog}
        onOpenChange={setShowUpdateDialog}
      />
      <DeactivateRoleDialog
        role={selectedRole}
        open={showDeactivateDialog}
        onOpenChange={setShowDeactivateDialog}
      />
    </div>
  );
}
