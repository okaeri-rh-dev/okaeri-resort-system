// src/components/admin/UserRolesTable.tsx

import { useState } from "react";

import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";

import { RoleChangeHistory } from "@/components/admin/RoleChangeHistory";
import {
  ActionMenu,
  DataTable,
  Input,
  ListCard,
  ListCardRow,
  StatusBadge,
  TableEmptyState,
  TableSkeleton,
  type ActionMenuAction,
} from "@/components/patterns";
import { useAllRoles } from "@/hooks/useRoleManagement";
import { getRoleDisplayName, type AppRole } from "@/lib/audit-roles";
import { formatDate } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface UserRolesTableProps {
  onUpdateRole: (role: AppRole) => void;
  onDeactivateRole: (role: AppRole) => void;
}

// ============================================
// COMPONENT
// ============================================

export function UserRolesTable({ onUpdateRole, onDeactivateRole }: UserRolesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(null);
  const { data: roles, isLoading, error } = useAllRoles();

  // Filter roles based on search query
  const filteredRoles = roles?.filter((role) => {
    const query = searchQuery.toLowerCase();
    return (
      role.email.toLowerCase().includes(query) ||
      role.role.toLowerCase().includes(query) ||
      (role.notes && role.notes.toLowerCase().includes(query))
    );
  });

  // Handle viewing role history
  const handleViewHistory = (role: AppRole) => {
    setSelectedRole(role);
    setShowHistory(true);
  };

  const roleActions = (role: AppRole): ActionMenuAction[] => [
    { label: "View Change History", onClick: () => handleViewHistory(role) },
    { label: "Update Role", onClick: () => onUpdateRole(role) },
    ...(role.is_active
      ? [
          {
            label: "Deactivate",
            onClick: () => onDeactivateRole(role),
            variant: "destructive" as const,
          },
        ]
      : []),
  ];

  const columns: ColumnDef<AppRole>[] = [
    { accessorKey: "email", header: "Email", cell: ({ row }) => <UserEmail role={row.original} /> },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => <ActiveBadge isActive={row.original.is_active} />,
    },
    {
      accessorKey: "granted_at",
      header: "Granted",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(new Date(row.original.granted_at))}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <ActionMenu
          actions={roleActions(row.original)}
          label={`Open menu for ${row.original.email}`}
        />
      ),
      meta: { pinned: true },
    },
  ];

  const table = useReactTable({
    data: filteredRoles ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (role) => role.user_id,
  });

  if (error) {
    return (
      <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
        <p className="text-destructive font-medium">Failed to load user roles</p>
        <p className="text-muted-foreground text-sm">{String(error)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by email, role, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} columns={5} label="Loading user roles" />
      ) : (
        <DataTable
          table={table}
          label="User roles"
          renderCard={(row) => (
            <ListCard>
              <div className="flex items-start justify-between gap-2">
                <UserEmail role={row.original} />
                <ActionMenu
                  actions={roleActions(row.original)}
                  label={`Open menu for ${row.original.email}`}
                />
              </div>
              <ListCardRow label="Role" value={<RoleBadge role={row.original.role} />} />
              <ListCardRow
                label="Status"
                value={<ActiveBadge isActive={row.original.is_active} />}
              />
              <ListCardRow label="Granted" value={formatDate(new Date(row.original.granted_at))} />
            </ListCard>
          )}
          emptyState={
            searchQuery ? (
              <TableEmptyState
                variant="no-results"
                title={`No roles found matching "${searchQuery}"`}
                description="Try a different email, role or note."
              />
            ) : (
              <TableEmptyState
                title="No user roles assigned yet"
                description="Grant a role to give someone access."
              />
            )
          }
        />
      )}

      {/* Results count */}
      {filteredRoles && filteredRoles.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Showing {filteredRoles.length} {filteredRoles.length === 1 ? "user" : "users"}
        </p>
      )}

      {/* Role Change History Dialog */}
      <RoleChangeHistory
        open={showHistory}
        onOpenChange={setShowHistory}
        userId={selectedRole?.user_id || null}
        userEmail={selectedRole?.email || ""}
      />
    </div>
  );
}

// ============================================
// ROLE BADGE COMPONENT
// ============================================

function RoleBadge({ role }: { role: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayName = getRoleDisplayName(role as any);

  return <StatusBadge tone="neutral">{displayName}</StatusBadge>;
}

function UserEmail({ role }: { role: AppRole }) {
  return (
    <div className="min-w-0 font-medium">
      <div className="break-words">{role.email}</div>
      {role.notes && (
        <div className="text-muted-foreground text-xs font-normal break-words">{role.notes}</div>
      )}
    </div>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <StatusBadge tone="success">Active</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Inactive</StatusBadge>
  );
}
