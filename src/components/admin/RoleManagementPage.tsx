// src/components/admin/RoleManagementPage.tsx

import { useState } from "react";

import { format } from "date-fns";
import { Clock, Loader2, Shield, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePendingUsers, type PendingUser } from "@/hooks/usePendingUsers";
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
  const [prefilledUser, setPrefilledUser] = useState<PendingUser | undefined>(undefined);

  const { data: pendingUsers, isLoading: isLoadingPending } = usePendingUsers();

  const handleUpdateRole = (role: AppRole) => {
    setSelectedRole(role);
    setShowUpdateDialog(true);
  };

  const handleDeactivateRole = (role: AppRole) => {
    setSelectedRole(role);
    setShowDeactivateDialog(true);
  };

  const handleGrantRoleForUser = (user: PendingUser) => {
    setPrefilledUser(user);
    setShowGrantDialog(true);
  };

  const handleOpenGrantDialog = () => {
    setPrefilledUser(undefined);
    setShowGrantDialog(true);
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
        <Button onClick={handleOpenGrantDialog}>
          <UserPlus className="mr-2 h-4 w-4" />
          Grant Role
        </Button>
      </div>

      {/* Pending Approval Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Pending Approval
              </CardTitle>
              {pendingUsers && pendingUsers.length > 0 && (
                <Badge variant="secondary">{pendingUsers.length}</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            Users who have signed up but haven't been assigned a role yet
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPending ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : !pendingUsers || pendingUsers.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No users awaiting approval.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Signed Up</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(user.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {user.email_confirmed_at ? (
                        <Badge variant="outline" className="border-green-500/50 text-green-700">
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500/50 text-amber-700">
                          Unverified
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => handleGrantRoleForUser(user)}>
                        <UserPlus className="mr-1 h-3 w-3" />
                        Grant Role
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
      <GrantRoleDialog
        open={showGrantDialog}
        onOpenChange={setShowGrantDialog}
        prefilledUser={prefilledUser}
      />
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
