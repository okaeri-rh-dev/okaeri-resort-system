// src/components/audit/AuditStatsPanel.tsx

import { Activity, Database, FileText, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTION_DISPLAY_NAMES, TABLE_DISPLAY_NAMES } from "@/lib/audit-constants";
import type { AuditLogStats } from "@/types/audit.types";

// ============================================
// TYPES
// ============================================

interface AuditStatsPanelProps {
  /** Audit statistics from useAuditStats hook */
  stats?: AuditLogStats;
  /** Loading state */
  isLoading: boolean;
}

// ============================================
// COMPONENT
// ============================================

/**
 * AuditStatsPanel - Displays 4-card summary of audit log statistics
 *
 * Shows:
 * - Total log count
 * - Most active table (by log count)
 * - Most common action (by count)
 * - Top user (by action count)
 *
 * @example
 * ```tsx
 * const { data: stats, isLoading } = useAuditStats();
 * <AuditStatsPanel stats={stats} isLoading={isLoading} />
 * ```
 */
export function AuditStatsPanel({ stats, isLoading }: AuditStatsPanelProps) {
  // Loading state - show skeleton cards
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // No stats available - hide panel
  if (!stats) return null;

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {/* Total Logs */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Total Logs</p>
              <p className="text-2xl font-bold">{stats.totalLogs.toLocaleString()}</p>
            </div>
            <FileText className="text-muted-foreground h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Most Active Table */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Most Active Table</p>
              <p className="text-2xl font-bold">{getMostActiveTable(stats.byTable)}</p>
              <p className="text-muted-foreground text-xs">
                {getMostActiveTableCount(stats.byTable)} logs
              </p>
            </div>
            <Database className="text-muted-foreground h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Most Common Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Most Common Action</p>
              <p className="text-2xl font-bold">{getMostCommonAction(stats.byAction)}</p>
              <p className="text-muted-foreground text-xs">
                {getMostCommonActionCount(stats.byAction)} times
              </p>
            </div>
            <Activity className="text-muted-foreground h-8 w-8" />
          </div>
        </CardContent>
      </Card>

      {/* Top User */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm font-medium">Most Active User</p>
              <p
                className="max-w-[150px] truncate text-lg font-bold"
                title={getTopUserEmail(stats.byUser)}
              >
                {getTopUserEmail(stats.byUser)}
              </p>
              <p className="text-muted-foreground text-xs">
                {getTopUserCount(stats.byUser)} actions
              </p>
            </div>
            <Users className="text-muted-foreground h-8 w-8" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the most active table name (display name)
 */
function getMostActiveTable(byTable: Record<string, number>): string {
  const entries = Object.entries(byTable);
  if (entries.length === 0) return "N/A";

  const [tableName] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));

  return TABLE_DISPLAY_NAMES[tableName as keyof typeof TABLE_DISPLAY_NAMES] || tableName;
}

/**
 * Get the count for most active table
 */
function getMostActiveTableCount(byTable: Record<string, number>): number {
  const entries = Object.entries(byTable);
  if (entries.length === 0) return 0;

  const [, count] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));
  return count;
}

/**
 * Get the most common action (display name)
 */
function getMostCommonAction(byAction: Record<string, number>): string {
  const entries = Object.entries(byAction);
  if (entries.length === 0) return "N/A";

  const [action] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));

  return ACTION_DISPLAY_NAMES[action as keyof typeof ACTION_DISPLAY_NAMES] || action;
}

/**
 * Get the count for most common action
 */
function getMostCommonActionCount(byAction: Record<string, number>): number {
  const entries = Object.entries(byAction);
  if (entries.length === 0) return 0;

  const [, count] = entries.reduce((max, curr) => (curr[1] > max[1] ? curr : max));
  return count;
}

/**
 * Get the top user email
 */
function getTopUserEmail(byUser: Array<{ email: string; count: number }>): string {
  if (!byUser || byUser.length === 0) return "N/A";
  return byUser[0].email;
}

/**
 * Get the top user action count
 */
function getTopUserCount(byUser: Array<{ email: string; count: number }>): number {
  if (!byUser || byUser.length === 0) return 0;
  return byUser[0].count;
}
