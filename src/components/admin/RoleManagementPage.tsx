// src/components/admin/RoleManagementPage.tsx

import { useState } from "react";

import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Clock, Loader2, Shield, UserPlus } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  DataTable,
  ListCard,
  ListCardRow,
  StatusBadge,
} from "@/components/patterns";
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

  const grantRoleButton = (user: PendingUser) => (
    <Button size="sm" onClick={() => handleGrantRoleForUser(user)}>
      <UserPlus className="mr-1 h-3 w-3" aria-hidden="true" />
      Grant Role
    </Button>
  );

  const pendingColumns: ColumnDef<PendingUser>[] = [
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="font-medium break-words">{row.original.email}</span>,
    },
    { accessorKey: "full_name", header: "Name", cell: ({ row }) => row.original.full_name || "—" },
    {
      accessorKey: "created_at",
      header: "Signed Up",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatSignUpDate(row.original.created_at)}</span>
      ),
    },
    {
      accessorKey: "email_confirmed_at",
      header: "Email Verified",
      cell: ({ row }) => <EmailVerifiedBadge user={row.original} />,
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => grantRoleButton(row.original),
      meta: { align: "right" },
    },
  ];

  const pendingTable = useReactTable({
    data: pendingUsers ?? [],
    columns: pendingColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (user) => user.id,
  });

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
                <StatusBadge tone="neutral">{pendingUsers.length}</StatusBadge>
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
            <DataTable
              table={pendingTable}
              label="Users awaiting approval"
              renderCard={(row) => (
                <ListCard>
                  <div className="min-w-0">
                    <div className="font-medium break-words">{row.original.email}</div>
                    {row.original.full_name && (
                      <div className="text-muted-foreground text-sm break-words">
                        {row.original.full_name}
                      </div>
                    )}
                  </div>
                  <ListCardRow
                    label="Signed Up"
                    value={formatSignUpDate(row.original.created_at)}
                  />
                  <ListCardRow label="Email" value={<EmailVerifiedBadge user={row.original} />} />
                  {grantRoleButton(row.original)}
                </ListCard>
              )}
            />
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

const formatSignUpDate = (createdAt: string) => format(new Date(createdAt), "MMM d, yyyy");

function EmailVerifiedBadge({ user }: { user: PendingUser }) {
  return user.email_confirmed_at ? (
    <StatusBadge tone="success">Verified</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Unverified</StatusBadge>
  );
}
