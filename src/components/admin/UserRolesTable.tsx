// src/components/admin/UserRolesTable.tsx

import { useState } from "react";

import { MoreHorizontal, Search, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllRoles } from "@/hooks/useRoleManagement";
import { getRoleBadgeColor, getRoleDisplayName, type AppRole } from "@/lib/audit-roles";
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

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              <>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : filteredRoles && filteredRoles.length > 0 ? (
              filteredRoles.map((role) => (
                <TableRow key={role.user_id}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{role.email}</div>
                      {role.notes && (
                        <div className="text-muted-foreground text-xs">{role.notes}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={role.role} />
                  </TableCell>
                  <TableCell>
                    {role.is_active ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-500/10 text-gray-600">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(new Date(role.granted_at))}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onUpdateRole(role)}>
                          Update Role
                        </DropdownMenuItem>
                        {role.is_active && (
                          <DropdownMenuItem
                            onClick={() => onDeactivateRole(role)}
                            className="text-destructive"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  {searchQuery ? (
                    <div className="text-muted-foreground">
                      No roles found matching "{searchQuery}"
                    </div>
                  ) : (
                    <div className="text-muted-foreground">No user roles assigned yet</div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Results count */}
      {filteredRoles && filteredRoles.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Showing {filteredRoles.length} {filteredRoles.length === 1 ? "user" : "users"}
        </p>
      )}
    </div>
  );
}

// ============================================
// ROLE BADGE COMPONENT
// ============================================

function RoleBadge({ role }: { role: string }) {
  const badgeColor = getRoleBadgeColor(role as any);
  const displayName = getRoleDisplayName(role as any);

  // Convert bg-color to text-color for badge text
  const textColor = badgeColor.replace("bg-", "text-");

  return (
    <Badge variant="outline" className={`${badgeColor} bg-opacity-10 ${textColor} font-medium`}>
      {displayName}
    </Badge>
  );
}
