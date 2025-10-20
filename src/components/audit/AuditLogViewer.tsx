// src/components/audit/AuditLogViewer.tsx

import React, { useState } from "react";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  ChevronRight as Next,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGINATION_DEFAULTS, TABLE_DISPLAY_NAMES } from "@/lib/audit-constants";
import { useAuditLogs } from "@/lib/audit-hooks";
import { useAuditStore } from "@/stores/useAuditStore";
import type { AuditLog, AuditLogQueryResult } from "@/types/audit.types";

import { ActionBadge } from "./ActionBadge";
import { AuditDiffViewer } from "./AuditDiffViewer";
import { SafeAuditText } from "./SafeAuditText";

// ============================================
// MAIN TABLE COMPONENT
// ============================================

export function AuditLogViewer() {
  const filters = useAuditStore((state) => state.filters);
  const setFilters = useAuditStore((state) => state.setFilters);
  const setSelectedLog = useAuditStore((state) => state.setSelectedLog);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [selectedLogForDiff, setSelectedLogForDiff] = useState<AuditLog | null>(null);

  const { data, isLoading, error } = useAuditLogs(filters);

  // Pagination handlers
  const currentPage = filters.offset
    ? Math.floor(filters.offset / (filters.limit || PAGINATION_DEFAULTS.PAGE_SIZE)) + 1
    : 1;

  const handlePageChange = (newPage: number) => {
    const limit = filters.limit || PAGINATION_DEFAULTS.PAGE_SIZE;
    setFilters({
      ...filters,
      offset: (newPage - 1) * limit,
    });
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (data && (data as unknown as AuditLogQueryResult).hasMore) {
      handlePageChange(currentPage + 1);
    }
  };

  // Row expansion toggle
  const toggleRow = (auditId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(auditId)) {
        newSet.delete(auditId);
      } else {
        newSet.add(auditId);
      }
      return newSet;
    });
  };

  // Open diff viewer dialog
  const openDiffViewer = (log: AuditLog) => {
    setSelectedLogForDiff(log);
    setSelectedLog(log);
    setDiffDialogOpen(true);
  };

  // Loading state
  if (isLoading) {
    return <TableSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Failed to load audit logs: {error.message}</AlertDescription>
      </Alert>
    );
  }

  // Empty state
  if (!data || (data as unknown as AuditLogQueryResult).data.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <p className="text-lg font-medium">No audit logs found</p>
        <p className="text-sm">Try adjusting your filters to see more results</p>
      </div>
    );
  }

  // Type-safe data access - TypeScript needs help narrowing the type
  const queryResult = data as unknown as AuditLogQueryResult;

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Expand</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Record ID</TableHead>
              <TableHead>Changed Fields</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queryResult.data.map((log) => (
              <AuditLogRow
                key={log.audit_id}
                log={log}
                isExpanded={expandedRows.has(log.audit_id)}
                onToggle={() => toggleRow(log.audit_id)}
                onViewDiff={() => openDiffViewer(log)}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Showing {queryResult.data.length} of {queryResult.totalCount} logs
          {queryResult.currentPage > 1 &&
            ` (Page ${queryResult.currentPage} of ${queryResult.totalPages})`}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>

          <span className="text-muted-foreground text-sm">
            Page {currentPage} of {queryResult.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!queryResult.hasMore}
          >
            Next
            <Next className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Diff Viewer Dialog */}
      <AuditDiffViewer
        log={selectedLogForDiff}
        open={diffDialogOpen}
        onOpenChange={setDiffDialogOpen}
      />
    </div>
  );
}

// ============================================
// TABLE ROW COMPONENT
// ============================================

interface AuditLogRowProps {
  log: AuditLog;
  isExpanded: boolean;
  onToggle: () => void;
  onViewDiff: () => void;
}

function AuditLogRow({ log, isExpanded, onToggle, onViewDiff }: AuditLogRowProps) {
  const hasChanges = (log.old_data && log.new_data) || log.changed_fields;

  return (
    <>
      {/* Main Row */}
      <TableRow>
        {/* Expand Button */}
        <TableCell>
          <Button variant="ghost" size="sm" onClick={onToggle} className="h-8 w-8 p-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </TableCell>

        {/* Timestamp */}
        <TableCell className="font-mono text-sm">
          <div>{log.created_at && new Date(log.created_at).toLocaleString()}</div>
          <div className="text-muted-foreground text-xs">
            {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </div>
        </TableCell>

        {/* User */}
        <TableCell>
          <div className="text-sm">{log.user_email || "System"}</div>
          {log.user_id && (
            <div className="text-muted-foreground max-w-[150px] truncate text-xs">
              {log.user_id}
            </div>
          )}
        </TableCell>

        {/* Table Name */}
        <TableCell>
          <Badge variant="outline">
            {TABLE_DISPLAY_NAMES[log.table_name as keyof typeof TABLE_DISPLAY_NAMES] ||
              log.table_name}
          </Badge>
        </TableCell>

        {/* Action */}
        <TableCell>
          <ActionBadge action={log.action} />
        </TableCell>

        {/* Source */}
        <TableCell>
          <SourceBadge source={log.source} />
        </TableCell>

        {/* Record ID */}
        <TableCell className="max-w-[120px] truncate font-mono text-xs">
          {log.record_id || "—"}
        </TableCell>

        {/* Changed Fields */}
        <TableCell>
          {log.changed_fields && log.changed_fields.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {log.changed_fields.slice(0, 3).map((field) => (
                <Badge key={field} variant="secondary" className="text-xs">
                  {field}
                </Badge>
              ))}
              {log.changed_fields.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{log.changed_fields.length - 3} more
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell>
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={onViewDiff}>
              <Eye className="mr-1 h-4 w-4" />
              View
            </Button>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded Row (Details) */}
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={9} className="bg-muted/50">
            <ExpandedRowDetails log={log} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ============================================
// EXPANDED ROW DETAILS
// ============================================

function ExpandedRowDetails({ log }: { log: AuditLog }): React.ReactElement {
  const category = log.category ? String(log.category) : null;
  const severity = log.severity ? String(log.severity) : null;

  return (
    <div className="space-y-3 p-4">
      {/* Description (from Layer 2 logs) - XSS protected via SafeAuditText */}
      <div>
        <div className="mb-1 text-sm font-medium">Description</div>
        <SafeAuditText text={log.description} className="text-muted-foreground text-sm" />
      </div>

      <div className="flex gap-4">
        {category && (
          <div>
            <div className="mb-1 text-sm font-medium">Category</div>
            <Badge>{category}</Badge>
          </div>
        )}
        {severity && (
          <div>
            <div className="mb-1 text-sm font-medium">Severity</div>
            <SeverityBadge severity={severity} />
          </div>
        )}
      </div>

      {/* IP Address */}
      {log.ip_address != null && (
        <div>
          <div className="mb-1 text-sm font-medium">IP Address</div>
          <div className="text-muted-foreground font-mono text-sm">{String(log.ip_address)}</div>
        </div>
      )}

      {/* Additional Metadata */}
      {log.metadata && typeof log.metadata === "object" && (
        <div>
          <div className="mb-1 text-sm font-medium">Additional Metadata</div>
          {/* XSS-Safe: JSON.stringify automatically escapes <, >, & as Unicode (\u003C, \u003E, \u0026).
              Rendered in <pre> tag, not interpreted as HTML. More flexible than per-field SafeAuditText. */}
          <pre className="bg-background overflow-x-auto rounded border p-2 text-xs">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================
// BADGE COMPONENTS (moved to shared ActionBadge.tsx)
// ============================================

function SourceBadge({ source }: { source: string }) {
  const isDbSource = source === "db";

  return (
    <Badge variant={isDbSource ? "outline" : "secondary"} className={isDbSource ? "font-mono" : ""}>
      {isDbSource ? "DB Trigger" : "App Event"}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }): React.ReactElement {
  const colors: Record<string, string> = {
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    debug: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  };

  return (
    <Badge className={colors[severity.toLowerCase()] || ""}>
      {severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()}
    </Badge>
  );
}

// ============================================
// LOADING SKELETON
// ============================================

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
