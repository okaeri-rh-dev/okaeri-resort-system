# Phase 3b: Table Component

## Purpose

This document covers the main `AuditLogViewer` table component that displays audit logs in a paginated, sortable table with row expansion for details and a dialog for viewing before/after changes.

**UI Pattern**: shadcn/ui Table + TanStack Table for sorting/pagination

## Main Table Component

### File Location

Create `src/components/audit/AuditLogViewer.tsx`:

```typescript
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
import { AuditDiffViewer } from "./AuditDiffViewer";
import type { AuditLog } from "../../../database.types";
import {
  TABLE_DISPLAY_NAMES,
  ACTION_DISPLAY_NAMES,
  PAGINATION_DEFAULTS,
} from "@/lib/audit-constants";
import { formatDistanceToNow } from "date-fns";
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
        <AlertDescription>
          Failed to load audit logs: {error.message}
        </AlertDescription>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {data.totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={!data.hasMore}
          >
            Next
            <Next className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Diff Viewer Dialog */}
      {selectedLogForDiff && (
        <AuditDiffViewer
          log={selectedLogForDiff}
          open={diffDialogOpen}
          onOpenChange={setDiffDialogOpen}
        />
      )}
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
            {TABLE_DISPLAY_NAMES[log.table_name] || log.table_name}
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
          <TableCell colSpan={8} className="bg-muted/50">
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
        <SafeAuditText
          text={log.description}
          className="text-sm text-muted-foreground"
        />
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
          <pre className="text-xs bg-background p-2 rounded border overflow-x-auto">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ============================================
// BADGE COMPONENTS
// ============================================

function ActionBadge({ action }: { action: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    INSERT: "default",
    UPDATE: "secondary",
    DELETE: "destructive",
  };

  return (
    <Badge variant={variants[action] || "outline"}>
      {ACTION_DISPLAY_NAMES[action as keyof typeof ACTION_DISPLAY_NAMES] || action}
    </Badge>
  );
}

function SourceBadge({ source }: { source: 'db' | 'app' }) {
  const isDbSource = source === 'db';

  return (
    <Badge
      variant={isDbSource ? "outline" : "secondary"}
      className={isDbSource ? "font-mono" : ""}
    >
      {isDbSource ? 'DB Trigger' : 'App Event'}
    </Badge>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <Badge className={colors[severity.toLowerCase()] || ""}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
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
```

## Component Features

### 1. Row Expansion

- Click chevron icon to expand/collapse row
- Expanded view shows full metadata, description, IP address
- State managed locally with `expandedRows` Set

### 2. Pagination

- Previous/Next buttons
- Current page indicator
- Total count display
- Disabled buttons at boundaries

### 3. Action Badges

- **INSERT** → Blue (default)
- **UPDATE** → Gray (secondary)
- **DELETE** → Red (destructive)

### 4. Source Badges (Dual-Layer Visibility)

- **DB Trigger** → Outline badge (Layer 1: automatic database triggers)
- **App Event** → Secondary badge (Layer 2: application-level business logs)

**★ Insight ─────────────────────────────────────**
Source badges make the dual-layer audit architecture visible to users. "DB Trigger" logs are automatic and comprehensive, while "App Event" logs provide business context for important operations like cancellations and refunds.
**─────────────────────────────────────────────────**

### 5. Severity Badges

- **INFO** → Blue
- **WARNING** → Yellow
- **CRITICAL** → Red

### 6. XSS Protection

All user-provided text (descriptions, metadata) is sanitized with DOMPurify before rendering to prevent XSS attacks. Sanitization happens at the UI layer, not during audit logging (separation of concerns).

### 7. Loading States

- Skeleton loader while fetching
- Error alert if query fails
- Empty state with helpful message

## Styling and Layout

### Desktop-First Design

The table is optimized for desktop viewing:

- Fixed column widths for consistent layout
- Truncated UUIDs and long text with ellipsis
- Font-mono for timestamps and IDs
- Responsive grid for small screens (future work)

### Table Column Widths

```typescript
// Column width strategy
Expand: 50px (icon button)
Timestamp: auto (with relative time)
User: auto (email + UUID)
Table: auto (badge)
Action: auto (badge)
Record ID: 120px max-width (truncated)
Changed Fields: auto (badge list)
Actions: 100px (View button)
```

## Integration with Diff Viewer

```typescript
// Click "View" button opens diff dialog
const openDiffViewer = (log: AuditLog) => {
  setSelectedLogForDiff(log);
  setSelectedLog(log); // Update store
  setDiffDialogOpen(true);
};

// Dialog component (covered in 03d)
<AuditDiffViewer
  log={selectedLogForDiff}
  open={diffDialogOpen}
  onOpenChange={setDiffDialogOpen}
/>
```

## Performance Considerations

### Pagination

- Limit default: 50 logs per page
- Prevents rendering thousands of rows
- Offset-based pagination (simple, effective for audit logs)

### Row Expansion State

- Local state (not persisted)
- Set data structure for O(1) lookups
- Clears when filters change

### Memo Optimization (Optional)

```typescript
// If performance issues arise, memoize row components
const AuditLogRow = React.memo(function AuditLogRow({ log, ... }) {
  // Component implementation
}, (prevProps, nextProps) => {
  return prevProps.log.audit_id === nextProps.log.audit_id
    && prevProps.isExpanded === nextProps.isExpanded;
});
```

## Accessibility

- **Keyboard Navigation**: Buttons are focusable
- **Screen Readers**: Semantic table structure
- **ARIA Labels**: Expand buttons have implicit labels
- **Color Contrast**: Badge colors meet WCAG AA standards

## Testing Checklist

- [ ] Table displays with mock data
- [ ] Pagination works (prev/next buttons)
- [ ] Row expansion toggles correctly
- [ ] "View" button opens diff dialog
- [ ] Loading state shows skeletons
- [ ] Empty state shows helpful message
- [ ] Error state shows alert
- [ ] Action badges use correct colors
- [ ] Timestamp shows relative time
- [ ] Changed fields show badges

## Next Steps

**Next**: [Phase 3c - Filters and Queries](./03c-filters-and-queries.md)

Phase 3c will create the `AuditFilters` component with date range pickers, dropdowns, quick action buttons, and CSV export.

---

**Table Component Checklist:**

- [ ] `AuditLogViewer.tsx` component created
- [ ] Row expansion working
- [ ] Pagination functional
- [ ] Badges styled correctly
- [ ] Loading/empty/error states implemented
- [ ] Integration with Zustand store verified
