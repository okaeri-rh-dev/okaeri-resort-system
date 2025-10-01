# 🎨 Phase 3: UI & Visualization

**Duration:** Week 3-4 (12-16 hours)  
**Status:** Not Started  
**Prerequisites:** Phase 1 and Phase 2 complete

---

## 🎯 Phase Objectives

Build an intuitive, mobile-first admin interface for viewing, filtering, and analyzing audit logs. The UI should make complex audit data accessible to non-technical family members while providing power users with advanced analysis tools.

**Key Outcomes:**

- ✅ Audit logs page with data table
- ✅ Advanced filtering (user, date, action, table)
- ✅ Before/after diff viewer
- ✅ Timeline visualization
- ✅ Export to CSV functionality
- ✅ Mobile-responsive design
- ✅ Fast performance (<500ms page load)

---

## 📋 Task Breakdown

### Task 3.1: React Hooks for Data Fetching (3 hours)

**Priority:** Critical  
**Dependencies:** Phase 2

Build React hooks for querying audit logs using React Query.

**File:** `src/lib/audit/hooks.ts`

````typescript
/**
 * React Hooks for Audit Logs
 *
 * Provides hooks for querying and managing audit logs using React Query.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  AuditLog,
  AuditLogFilters,
  AuditLogQueryResult,
  AuditStats,
  AuditDiff,
} from "./types";

// ============================================
// QUERY KEYS
// ============================================

export const auditQueryKeys = {
  all: ["audit-logs"] as const,
  lists: () => [...auditQueryKeys.all, "list"] as const,
  list: (filters: AuditLogFilters) => [...auditQueryKeys.lists(), filters] as const,
  trail: (tableName: string, recordId: string) =>
    [...auditQueryKeys.all, "trail", tableName, recordId] as const,
  stats: (filters: AuditLogFilters) => [...auditQueryKeys.all, "stats", filters] as const,
  diff: (auditId: string) => [...auditQueryKeys.all, "diff", auditId] as const,
};

// ============================================
// FETCH FUNCTIONS
// ============================================

/**
 * Fetch audit logs with filters
 */
async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogQueryResult> {
  let query = supabase.from("audit_logs").select("*", { count: "exact" });

  // Apply filters
  if (filters.tableName) {
    if (Array.isArray(filters.tableName)) {
      query = query.in("table_name", filters.tableName);
    } else {
      query = query.eq("table_name", filters.tableName);
    }
  }

  if (filters.recordId) {
    query = query.eq("record_id", filters.recordId);
  }

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.action) {
    if (Array.isArray(filters.action)) {
      query = query.in("action", filters.action);
    } else {
      query = query.eq("action", filters.action);
    }
  }

  if (filters.category) {
    if (Array.isArray(filters.category)) {
      query = query.in("category", filters.category);
    } else {
      query = query.eq("category", filters.category);
    }
  }

  if (filters.severity) {
    if (Array.isArray(filters.severity)) {
      query = query.in("severity", filters.severity);
    } else {
      query = query.eq("severity", filters.severity);
    }
  }

  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate.toISOString());
  }

  if (filters.endDate) {
    query = query.lte("created_at", filters.endDate.toISOString());
  }

  // Sorting
  const sortBy = filters.sortBy || "created_at";
  const sortOrder = filters.sortOrder || "desc";
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  // Pagination
  const limit = Math.min(filters.limit || 50, 500);
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return {
    logs: data || [],
    total: count || 0,
    hasMore: (count || 0) > offset + limit,
  };
}

/**
 * Fetch audit trail for a specific record
 */
async function fetchAuditTrail(tableName: string, recordId: string): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("table_name", tableName)
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch audit trail: ${error.message}`);
  }

  return data || [];
}

/**
 * Fetch audit statistics
 */
async function fetchAuditStats(filters: AuditLogFilters = {}): Promise<AuditStats> {
  // Base query
  let query = supabase.from("audit_logs").select("*");

  // Apply date filters
  if (filters.startDate) {
    query = query.gte("created_at", filters.startDate.toISOString());
  }
  if (filters.endDate) {
    query = query.lte("created_at", filters.endDate.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch audit stats: ${error.message}`);
  }

  const logs = data || [];

  // Calculate statistics
  const changesByTable: Record<string, number> = {};
  const changesByUser: Record<string, number> = {};
  const changesByAction: Record<string, number> = {};
  const recentActivity: Map<string, number> = new Map();

  logs.forEach((log) => {
    // By table
    changesByTable[log.table_name] = (changesByTable[log.table_name] || 0) + 1;

    // By user
    const userKey = log.user_email || "System";
    changesByUser[userKey] = (changesByUser[userKey] || 0) + 1;

    // By action
    const actionKey = log.action || "unknown";
    changesByAction[actionKey] = (changesByAction[actionKey] || 0) + 1;

    // Recent activity (by day)
    const date = new Date(log.created_at).toISOString().split("T")[0];
    recentActivity.set(date, (recentActivity.get(date) || 0) + 1);
  });

  return {
    totalChanges: logs.length,
    changesByTable,
    changesByUser,
    changesByAction,
    recentActivity: Array.from(recentActivity.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/**
 * Calculate diff between old and new data
 */
function calculateDiff(auditLog: AuditLog): AuditDiff {
  const changes: AuditDiff["changes"] = [];

  const oldData = (auditLog.old_data as Record<string, unknown>) || {};
  const newData = (auditLog.new_data as Record<string, unknown>) || {};

  // Find all unique fields
  const allFields = new Set([...Object.keys(oldData), ...Object.keys(newData)]);

  allFields.forEach((field) => {
    const oldValue = oldData[field];
    const newValue = newData[field];

    // Skip metadata fields
    if (["created_at", "updated_at"].includes(field)) {
      return;
    }

    if (!(field in oldData)) {
      // Field was added
      changes.push({ field, oldValue: null, newValue, type: "added" });
    } else if (!(field in newData)) {
      // Field was deleted
      changes.push({ field, oldValue, newValue: null, type: "deleted" });
    } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      // Field was modified
      changes.push({ field, oldValue, newValue, type: "modified" });
    }
  });

  return {
    changes,
    totalChanges: changes.length,
  };
}

// ============================================
// REACT HOOKS
// ============================================

/**
 * Hook to fetch audit logs with filters
 *
 * @example
 * ```typescript
 * const { data, isLoading, error } = useAuditLogs({
 *   tableName: 'bookings',
 *   startDate: new Date('2025-01-01'),
 *   limit: 50,
 * });
 * ```
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: auditQueryKeys.list(filters),
    queryFn: () => fetchAuditLogs(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch audit trail for a specific record
 *
 * @example
 * ```typescript
 * const { data: trail, isLoading } = useAuditTrail('bookings', bookingId);
 * ```
 */
export function useAuditTrail(tableName: string, recordId: string) {
  return useQuery({
    queryKey: auditQueryKeys.trail(tableName, recordId),
    queryFn: () => fetchAuditTrail(tableName, recordId),
    enabled: !!tableName && !!recordId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch audit statistics
 *
 * @example
 * ```typescript
 * const { data: stats } = useAuditStats({
 *   startDate: new Date('2025-01-01'),
 *   endDate: new Date('2025-01-31'),
 * });
 * ```
 */
export function useAuditStats(filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: auditQueryKeys.stats(filters),
    queryFn: () => fetchAuditStats(filters),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to calculate diff for an audit log
 *
 * @example
 * ```typescript
 * const diff = useAuditDiff(auditLog);
 * ```
 */
export function useAuditDiff(auditLog?: AuditLog): AuditDiff | null {
  if (!auditLog) return null;
  return calculateDiff(auditLog);
}

/**
 * Hook to export audit logs to CSV
 */
export function useExportAuditLogs() {
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => {
      // Fetch all logs matching filters (up to 10,000)
      const result = await fetchAuditLogs({ ...filters, limit: 10000, offset: 0 });

      // Convert to CSV
      const headers = [
        "Timestamp",
        "Table",
        "Action",
        "User",
        "Description",
        "Category",
        "Severity",
      ];

      const rows = result.logs.map((log) => [
        new Date(log.created_at).toLocaleString(),
        log.table_name,
        log.action,
        log.user_email || "System",
        log.description || "",
        log.category || "",
        log.severity || "",
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      // Download file
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      return result.logs.length;
    },
  });
}

// ============================================
// INVALIDATION HELPER
// ============================================

/**
 * Hook to invalidate audit log queries
 */
export function useInvalidateAuditLogs() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: auditQueryKeys.all });
  };
}
````

---

### Task 3.2: Audit Logs Page (4 hours)

**Priority:** Critical  
**Dependencies:** Task 3.1

Build the main audit logs viewing page.

**File:** `src/pages/audit-logs/index.tsx`

```typescript
/**
 * Audit Logs Page
 *
 * Main page for viewing and analyzing audit logs.
 * Admin/Owner only access.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Filter } from 'lucide-react';
import { useAuditLogs, useAuditStats, useExportAuditLogs } from '@/lib/audit/hooks';
import type { AuditLogFilters } from '@/lib/audit/types';
import { AuditLogViewer } from '@/components/audit/AuditLogViewer';
import { AuditFilters } from '@/components/audit/AuditFilters';
import { AuditStatsPanel } from '@/components/audit/AuditStatsPanel';

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    limit: 50,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });

  const [showFilters, setShowFilters] = useState(false);

  // Fetch audit logs
  const {
    data: logsResult,
    isLoading,
    error,
    refetch
  } = useAuditLogs(filters);

  // Fetch statistics
  const { data: stats } = useAuditStats({
    startDate: filters.startDate,
    endDate: filters.endDate,
  });

  // Export mutation
  const exportMutation = useExportAuditLogs();

  // Handlers
  const handleFilterChange = (newFilters: Partial<AuditLogFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExport = () => {
    exportMutation.mutate(filters);
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Audit Logs</h1>
          <p className="text-muted-foreground mt-1">
            View and analyze all system changes
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exportMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Statistics Panel */}
      {stats && (
        <AuditStatsPanel stats={stats} />
      )}

      {/* Filters Panel (Collapsible) */}
      {showFilters && (
        <Card className="p-4">
          <AuditFilters
            filters={filters}
            onChange={handleFilterChange}
          />
        </Card>
      )}

      {/* Main Audit Log Table */}
      <Card>
        {error && (
          <div className="p-4 text-destructive">
            Error loading audit logs: {error.message}
          </div>
        )}

        {!error && (
          <AuditLogViewer
            logs={logsResult?.logs || []}
            total={logsResult?.total || 0}
            hasMore={logsResult?.hasMore || false}
            isLoading={isLoading}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}
      </Card>
    </div>
  );
}
```

---

### Task 3.3: Audit Log Table Component (3 hours)

**Priority:** Critical  
**Dependencies:** Task 3.1

Build the data table component for displaying audit logs.

**File:** `src/components/audit/AuditLogViewer.tsx`

```typescript
/**
 * Audit Log Viewer Component
 *
 * Displays audit logs in a table format with sorting and pagination.
 */

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { format } from 'date-fns';
import type { AuditLog, AuditLogFilters } from '@/lib/audit/types';
import {
  SEVERITY_COLORS,
  CATEGORY_COLORS,
  ACTION_LABELS,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
} from '@/lib/audit/constants';
import { useState } from 'react';
import { AuditLogDialog } from './AuditLogDialog';

interface AuditLogViewerProps {
  logs: AuditLog[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  filters: AuditLogFilters;
  onFilterChange: (filters: Partial<AuditLogFilters>) => void;
}

export function AuditLogViewer({
  logs,
  total,
  hasMore,
  isLoading,
  filters,
  onFilterChange,
}: AuditLogViewerProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const currentPage = Math.floor((filters.offset || 0) / (filters.limit || 50)) + 1;
  const totalPages = Math.ceil(total / (filters.limit || 50));

  const handlePrevPage = () => {
    const newOffset = Math.max(0, (filters.offset || 0) - (filters.limit || 50));
    onFilterChange({ offset: newOffset });
  };

  const handleNextPage = () => {
    if (hasMore) {
      const newOffset = (filters.offset || 0) + (filters.limit || 50);
      onFilterChange({ offset: newOffset });
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading audit logs...
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No audit logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.audit_id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                  </TableCell>

                  <TableCell>
                    {log.user_email || (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline">{log.action}</Badge>
                  </TableCell>

                  <TableCell>
                    <code className="text-sm">{log.table_name}</code>
                  </TableCell>

                  <TableCell>
                    {log.category && (
                      <Badge className={CATEGORY_COLORS[log.category]}>
                        {CATEGORY_LABELS[log.category] || log.category}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell>
                    {log.severity && (
                      <Badge className={SEVERITY_COLORS[log.severity]}>
                        {SEVERITY_LABELS[log.severity]}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="max-w-md truncate">
                    {log.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-muted-foreground">
          Showing {Math.min((filters.offset || 0) + 1, total)} to{' '}
          {Math.min((filters.offset || 0) + logs.length, total)} of {total} results
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={isLoading || (filters.offset || 0) === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={isLoading || !hasMore}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Detail Dialog */}
      {selectedLog && (
        <AuditLogDialog
          log={selectedLog}
          open={!!selectedLog}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </>
  );
}
```

_[Continue with remaining components...]_

---

## ✅ Phase 3 Completion Checklist

### React Hooks

- [ ] `useAuditLogs()` hook working
- [ ] `useAuditTrail()` hook working
- [ ] `useAuditStats()` hook working
- [ ] `useExportAuditLogs()` hook working

### Pages

- [ ] Audit logs page created
- [ ] Route added to router
- [ ] Admin access control working

### Components

- [ ] `AuditLogViewer` table component
- [ ] `AuditFilters` filter controls
- [ ] `AuditDiffViewer` diff visualization
- [ ] `AuditTimeline` timeline view
- [ ] `AuditStatsPanel` statistics display

### Mobile Responsiveness

- [ ] Table scrolls horizontally on mobile
- [ ] Filters collapse on mobile
- [ ] Touch-friendly buttons and controls

### Performance

- [ ] Page loads in <500ms
- [ ] Table renders 50 rows smoothly
- [ ] Filters update without lag

---

## 🔗 Next Steps

- ✅ Phase 3 Complete
- ⏭️ Proceed to [Phase 4: Security & Optimization](./AUDIT_PHASE_4_SECURITY.md)

---

_Phase 3 makes audit data accessible and actionable through intuitive UI._
