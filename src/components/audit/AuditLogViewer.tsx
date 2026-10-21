// src/components/audit/AuditLogViewer.tsx

import React, { useState } from "react";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
} from "@tanstack/react-table";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Eye, ChevronRight as Next } from "lucide-react";

import {
  Button,
  Callout,
  DataTable,
  ListCard,
  ListCardRow,
  Skeleton,
  StatusBadge,
  type StatusTone,
} from "@/components/patterns";
import { PAGINATION_DEFAULTS, TABLE_DISPLAY_NAMES } from "@/lib/audit-constants";
import { auditActorLabel } from "@/lib/audit-display";
import { useAuditLogs } from "@/lib/audit-hooks";
import { cn } from "@/lib/utils";
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

  const [expanded, setExpanded] = useState<ExpandedState>({});
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

  // Open diff viewer dialog
  const openDiffViewer = (log: AuditLog) => {
    setSelectedLogForDiff(log);
    setSelectedLog(log);
    setDiffDialogOpen(true);
  };

  const columns: ColumnDef<AuditLog>[] = [
    {
      id: "expand",
      header: () => <span className="sr-only">Expand</span>,
      cell: ({ row }) => (
        <ExpandButton isExpanded={row.getIsExpanded()} onToggle={row.getToggleExpandedHandler()} />
      ),
      size: 48,
    },
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => <LogTime log={row.original} />,
    },
    { id: "user", header: "User", cell: ({ row }) => <LogActor log={row.original} /> },
    {
      accessorKey: "table_name",
      header: "Table",
      cell: ({ row }) => <TableBadge log={row.original} />,
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <ActionBadge log={row.original} />,
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: ({ row }) => <SourceBadge source={row.original.source} />,
    },
    {
      accessorKey: "record_id",
      header: "Record ID",
      cell: ({ row }) => <RecordId log={row.original} className="max-w-32" />,
    },
    {
      id: "changed_fields",
      header: "Changed Fields",
      cell: ({ row }) => <ChangedFields log={row.original} />,
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <ViewDiffButton log={row.original} onViewDiff={openDiffViewer} />,
      meta: { pinned: true },
    },
  ];

  const table = useReactTable({
    data: (data as unknown as AuditLogQueryResult | undefined)?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (log) => log.audit_id,
    getRowCanExpand: () => true,
    state: { expanded },
    onExpandedChange: setExpanded,
  });

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
      <DataTable
        table={table}
        label="Audit logs"
        renderExpandedRow={(row) => <ExpandedRowDetails log={row.original} />}
        renderCard={(row) => (
          <ListCard>
            <div className="flex items-start justify-between gap-2">
              <LogTime log={row.original} />
              <ActionBadge log={row.original} />
            </div>
            <ListCardRow label="User" value={<LogActor log={row.original} />} />
            <ListCardRow label="Table" value={<TableBadge log={row.original} />} />
            <ListCardRow label="Source" value={<SourceBadge source={row.original.source} />} />
            <ListCardRow label="Record ID" value={<RecordId log={row.original} />} />
            <ListCardRow
              label="Changed"
              value={<ChangedFields log={row.original} className="justify-end" />}
            />
            <div className="flex items-center justify-between gap-2">
              <ExpandButton
                isExpanded={row.getIsExpanded()}
                onToggle={row.getToggleExpandedHandler()}
              />
              <ViewDiffButton log={row.original} onViewDiff={openDiffViewer} />
            </div>
            {row.getIsExpanded() && (
              <div className="bg-muted/50 rounded-md">
                <ExpandedRowDetails log={row.original} />
              </div>
            )}
          </ListCard>
        )}
      />

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
// ROW PARTS
// ============================================

function ExpandButton({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  return (
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
  );
}

function LogTime({ log }: { log: AuditLog }) {
  return (
    <div className="text-sm tabular-nums">
      <div>{log.created_at && new Date(log.created_at).toLocaleString()}</div>
      <div className="text-muted-foreground text-xs">
        {log.created_at && formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
      </div>
    </div>
  );
}

function LogActor({ log }: { log: AuditLog }) {
  return (
    <div className="min-w-0">
      <div className="text-sm break-words">{auditActorLabel(log)}</div>
      {log.user_id && (
        <div className="text-muted-foreground max-w-40 truncate text-xs">{log.user_id}</div>
      )}
    </div>
  );
}

function TableBadge({ log }: { log: AuditLog }) {
  return (
    <StatusBadge tone="neutral">
      {TABLE_DISPLAY_NAMES[log.table_name as keyof typeof TABLE_DISPLAY_NAMES] || log.table_name}
    </StatusBadge>
  );
}

function RecordId({ log, className }: { log: AuditLog; className?: string }) {
  return <div className={cn("max-w-40 truncate text-xs", className)}>{log.record_id || "—"}</div>;
}

function ChangedFields({ log, className }: { log: AuditLog; className?: string }) {
  if (!log.changed_fields || log.changed_fields.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {log.changed_fields.slice(0, 3).map((field) => (
        <StatusBadge key={field} tone="neutral">
          {field}
        </StatusBadge>
      ))}
      {log.changed_fields.length > 3 && (
        <StatusBadge tone="neutral">+{log.changed_fields.length - 3} more</StatusBadge>
      )}
    </div>
  );
}

function ViewDiffButton({
  log,
  onViewDiff,
}: {
  log: AuditLog;
  onViewDiff: (log: AuditLog) => void;
}) {
  const hasChanges = (log.old_data && log.new_data) || log.changed_fields;
  if (!hasChanges) return null;

  return (
    <Button variant="ghost" size="sm" onClick={() => onViewDiff(log)}>
      <Eye className="mr-1 h-4 w-4" aria-hidden="true" />
      View
    </Button>
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
