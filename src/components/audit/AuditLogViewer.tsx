// src/components/audit/AuditLogViewer.tsx

import React, { useState } from "react";

import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, ChevronRight as Next } from "lucide-react";

import { Button, Callout, Skeleton, StatusBadge, type StatusTone } from "@/components/patterns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGINATION_DEFAULTS, TABLE_DISPLAY_NAMES } from "@/lib/audit-constants";
import { auditActorLabel } from "@/lib/audit-display";
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
    return <Callout tone="danger">Failed to load audit logs: {error.message}</Callout>;
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Hide details" : "Show details"}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </TableCell>

        {/* Timestamp */}
        <TableCell className="text-sm tabular-nums">
          <div>{log.created_at && new Date(log.created_at).toLocaleString()}</div>
          <div className="text-muted-foreground text-xs">
            {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </div>
        </TableCell>

        {/* User */}
        <TableCell>
          <div className="text-sm">{auditActorLabel(log)}</div>
          {log.user_id && (
            <div className="text-muted-foreground max-w-[150px] truncate text-xs">
              {log.user_id}
            </div>
          )}
        </TableCell>

        {/* Table Name */}
        <TableCell>
          <StatusBadge tone="neutral">
            {TABLE_DISPLAY_NAMES[log.table_name as keyof typeof TABLE_DISPLAY_NAMES] ||
              log.table_name}
          </StatusBadge>
        </TableCell>

        {/* Action */}
        <TableCell>
          <ActionBadge log={log} />
        </TableCell>

        {/* Source */}
        <TableCell>
          <SourceBadge source={log.source} />
        </TableCell>

        {/* Record ID */}
        <TableCell className="max-w-[120px] truncate text-xs">{log.record_id || "—"}</TableCell>

        {/* Changed Fields */}
        <TableCell>
          {log.changed_fields && log.changed_fields.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {log.changed_fields.slice(0, 3).map((field) => (
                <StatusBadge key={field} tone="neutral">
                  {field}
                </StatusBadge>
              ))}
              {log.changed_fields.length > 3 && (
                <StatusBadge tone="neutral">+{log.changed_fields.length - 3} more</StatusBadge>
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
              <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
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
            <StatusBadge tone="neutral">{category}</StatusBadge>
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
          <div className="text-muted-foreground text-sm tabular-nums">{String(log.ip_address)}</div>
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
  return <StatusBadge tone="neutral">{source === "db" ? "DB Trigger" : "App Event"}</StatusBadge>;
}

const tonesBySeverity: Record<string, StatusTone> = {
  info: "info",
  warning: "warning",
  error: "danger",
  critical: "danger",
  debug: "neutral",
};

function SeverityBadge({ severity }: { severity: string }): React.ReactElement {
  return (
    <StatusBadge tone={tonesBySeverity[severity.toLowerCase()] ?? "neutral"}>
      {severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase()}
    </StatusBadge>
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
