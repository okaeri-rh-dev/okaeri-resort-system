// src/components/audit/AuditLogViewer.tsx

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronRight as Next,
  Eye,
  AlertCircle,
} from "lucide-react";
import { useAuditLogs } from "@/lib/audit-hooks";
import { useAuditStore } from "@/stores/useAuditStore";
import type { AuditLog } from "../../../database.types";
import { TABLE_DISPLAY_NAMES, PAGINATION_DEFAULTS } from "@/lib/audit-constants";
import { formatDistanceToNow } from "date-fns";
import { SafeAuditText } from "./SafeAuditText";
import { AuditDiffViewer } from "./AuditDiffViewer";
import { ActionBadge } from "./ActionBadge";

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
    if (data && data.hasMore) {
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
  if (!data || data.data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No audit logs found</p>
        <p className="text-sm">Try adjusting your filters to see more results</p>
      </div>
    );
  }

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
            {data.data.map((log) => (
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
        <div className="text-sm text-muted-foreground">
          Showing {data.data.length} of {data.totalCount} logs
          {data.currentPage > 1 && ` (Page ${data.currentPage} of ${data.totalPages})`}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {data.totalPages}
          </span>

          <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!data.hasMore}>
            Next
            <Next className="h-4 w-4 ml-1" />
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
          <div>{new Date(log.created_at).toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
          </div>
        </TableCell>

        {/* User */}
        <TableCell>
          <div className="text-sm">{log.user_email || "System"}</div>
          {log.user_id && (
            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
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
        <TableCell className="font-mono text-xs truncate max-w-[120px]">
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
              <Eye className="h-4 w-4 mr-1" />
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

function ExpandedRowDetails({ log }: { log: AuditLog }) {
  return (
    <div className="space-y-3 p-4">
      {/* Description (from Layer 2 logs) - XSS protected via SafeAuditText */}
      <div>
        <div className="text-sm font-medium mb-1">Description</div>
        <SafeAuditText text={log.description} className="text-sm text-muted-foreground" />
      </div>

      {/* Category & Severity - Read from dedicated columns */}
      {(log.category || log.severity) && (
        <div className="flex gap-4">
          {log.category && (
            <div>
              <div className="text-sm font-medium mb-1">Category</div>
              <Badge>{log.category}</Badge>
            </div>
          )}
          {log.severity && (
            <div>
              <div className="text-sm font-medium mb-1">Severity</div>
              <SeverityBadge severity={log.severity} />
            </div>
          )}
        </div>
      )}

      {/* IP Address */}
      {log.ip_address && (
        <div>
          <div className="text-sm font-medium mb-1">IP Address</div>
          <div className="text-sm font-mono text-muted-foreground">{log.ip_address}</div>
        </div>
      )}

      {/* Additional Metadata */}
      {log.metadata && typeof log.metadata === "object" && (
        <div>
          <div className="text-sm font-medium mb-1">Additional Metadata</div>
          {/* XSS-Safe: JSON.stringify automatically escapes <, >, & as Unicode (\u003C, \u003E, \u0026).
              Rendered in <pre> tag, not interpreted as HTML. More flexible than per-field SafeAuditText. */}
          <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
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

function SourceBadge({ source }: { source: "db" | "app" }) {
  const isDbSource = source === "db";

  return (
    <Badge variant={isDbSource ? "outline" : "secondary"} className={isDbSource ? "font-mono" : ""}>
      {isDbSource ? "DB Trigger" : "App Event"}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
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
