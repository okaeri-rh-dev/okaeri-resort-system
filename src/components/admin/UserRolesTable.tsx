// src/components/admin/UserRolesTable.tsx

import { useCallback, useMemo, useState } from "react";

import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { History, MoreHorizontal, Search, UserX } from "lucide-react";

import { RoleChangeHistory } from "@/components/admin/RoleChangeHistory";
import {
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ListCard,
  ListCardRow,
  StatusBadge,
  TableEmptyState,
  TableSkeleton,
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

  // TanStack needs a stable `data` array: a new one each render loops through its page-index reset.
  const filteredRoles = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return (roles ?? []).filter(
      (role) =>
        role.email.toLowerCase().includes(query) ||
        role.role.toLowerCase().includes(query) ||
        (role.notes && role.notes.toLowerCase().includes(query))
    );
  }, [roles, searchQuery]);

  const handleViewHistory = useCallback((role: AppRole) => {
    setSelectedRole(role);
    setShowHistory(true);
  }, []);

  const roleMenu = useCallback(
    (role: AppRole) => (
      <RoleActionsMenu
        role={role}
        onViewHistory={handleViewHistory}
        onUpdateRole={onUpdateRole}
        onDeactivateRole={onDeactivateRole}
      />
    ),
    [handleViewHistory, onUpdateRole, onDeactivateRole]
  );

  // TanStack renders each `cell` as a component, so new cell functions remount the cells and close
  // an open row menu.
  const columns = useMemo<ColumnDef<AppRole>[]>(
    () => [
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => <UserEmail role={row.original} />,
      },
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
        cell: ({ row }) => roleMenu(row.original),
        meta: { pinned: true },
      },
    ],
    [roleMenu]
  );

  const table = useReactTable({
    data: filteredRoles,
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
                {roleMenu(row.original)}
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
              />
            ) : (
              <TableEmptyState title="No user roles assigned yet" />
            )
          }
        />
      )}

      {/* Results count */}
      {filteredRoles.length > 0 && (
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

interface RoleActionsMenuProps {
  role: AppRole;
  onViewHistory: (role: AppRole) => void;
  onUpdateRole: (role: AppRole) => void;
  onDeactivateRole: (role: AppRole) => void;
}

function RoleActionsMenu({
  role,
  onViewHistory,
  onUpdateRole,
  onDeactivateRole,
}: RoleActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onViewHistory(role)}>
          <History aria-hidden="true" />
          View Change History
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdateRole(role)}>Update Role</DropdownMenuItem>
        {role.is_active && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeactivateRole(role)}
              className="text-destructive focus:text-destructive"
            >
              <UserX aria-hidden="true" />
              Deactivate
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
