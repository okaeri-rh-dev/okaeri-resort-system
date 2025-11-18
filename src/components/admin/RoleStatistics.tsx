// src/components/admin/RoleStatistics.tsx

import { Shield, ShieldAlert, ShieldCheck, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRoleStats } from "@/hooks/useRoleManagement";
import { AuditRole, getRoleBadgeColor, getRoleDisplayName } from "@/lib/audit-roles";

// ============================================
// COMPONENT
// ============================================

export function RoleStatistics() {
  const { data: stats, isLoading, error } = useRoleStats();

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Failed to load statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{String(error)}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const roleCards = [
    {
      role: AuditRole.ADMIN,
      count: stats.admin,
      icon: ShieldAlert,
      description: "Full system access",
    },
    {
      role: AuditRole.OWNER,
      count: stats.owner,
      icon: Shield,
      description: "Business owner privileges",
    },
    {
      role: AuditRole.MANAGER,
      count: stats.manager,
      icon: ShieldCheck,
      description: "Operations management",
    },
    {
      role: AuditRole.STAFF,
      count: stats.staff,
      icon: Users,
      description: "Basic access",
    },
  ];

  const totalUsers = stats.admin + stats.owner + stats.manager + stats.staff;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {roleCards.map(({ role, count, icon: Icon, description }) => {
        const badgeColor = getRoleBadgeColor(role);
        const displayName = getRoleDisplayName(role);

        return (
          <Card key={role}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{displayName}</CardTitle>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${badgeColor} bg-opacity-10`}
              >
                <Icon className={`h-4 w-4 ${badgeColor.replace("bg-", "text-")}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
              <p className="text-muted-foreground text-xs">
                {description}
                {totalUsers > 0 && (
                  <span className="text-primary ml-2">
                    ({((count / totalUsers) * 100).toFixed(0)}%)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
