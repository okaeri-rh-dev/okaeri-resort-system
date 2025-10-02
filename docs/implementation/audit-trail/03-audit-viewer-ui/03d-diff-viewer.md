# Phase 3d: Diff Viewer Dialog

## Purpose

This document covers the `AuditDiffViewer` dialog component that displays before/after changes for audit logs in a side-by-side comparison with highlighted differences. This helps owners understand exactly what changed in a record.

**UX Pattern**: Modal dialog with split view (before → after), color-coded changes.

## Diff Viewer Component

### File Location

Create `src/components/audit/AuditDiffViewer.tsx`:

```typescript
// src/components/audit/AuditDiffViewer.tsx

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AuditLog } from "../../../database.types";
import { TABLE_DISPLAY_NAMES, ACTION_DISPLAY_NAMES } from "@/lib/audit-constants";
import { ArrowRight, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { SafeAuditText } from "./SafeAuditText";

// ============================================
// MAIN DIFF VIEWER COMPONENT
// ============================================

interface AuditDiffViewerProps {
  log: AuditLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditDiffViewer({ log, open, onOpenChange }: AuditDiffViewerProps) {
  if (!log) return null;

  const hasData = log.old_data || log.new_data;
  const changedFields = log.changed_fields || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
          <DialogDescription>
            {TABLE_DISPLAY_NAMES[log.table_name] || log.table_name} •{" "}
            {ACTION_DISPLAY_NAMES[log.action as keyof typeof ACTION_DISPLAY_NAMES]} •{" "}
            {format(new Date(log.created_at), "PPpp")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metadata Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">User</div>
              <div className="text-sm">{log.user_email || "System"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Action</div>
              <ActionBadge action={log.action} />
            </div>
            {log.record_id && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Record ID</div>
                <div className="text-xs font-mono truncate">{log.record_id}</div>
              </div>
            )}
            {log.ip_address && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">IP Address</div>
                <div className="text-sm font-mono">{log.ip_address}</div>
              </div>
            )}
          </div>

          {/* Description (from column, not metadata) - XSS protected via SafeAuditText */}
          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">Description</div>
            <SafeAuditText
              text={log.description}
              className="text-sm bg-muted p-3 rounded-md block"
            />
          </div>

          <Separator />

          {/* Changed Fields Summary - Only show for DB triggers with actual changes */}
          {log.source === 'db' && changedFields.length > 0 && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Changed Fields ({changedFields.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {changedFields.map((field) => (
                  <Badge key={field} variant="outline">
                    {field}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Before/After Comparison */}
          {hasData ? (
            <DiffComparison
              oldData={log.old_data}
              newData={log.new_data}
              changedFields={changedFields}
              action={log.action}
            />
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">No data changes recorded for this log entry</span>
            </div>
          )}

          {/* Additional Metadata */}
          {log.metadata && typeof log.metadata === "object" && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Additional Metadata
              </div>
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// DIFF COMPARISON COMPONENT
// ============================================

interface DiffComparisonProps {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[];
  action: string;
}

function DiffComparison({ oldData, newData, changedFields, action }: DiffComparisonProps) {
  // For INSERT, only show new data
  if (action === "INSERT" && newData) {
    return (
      <div>
        <div className="text-sm font-medium text-muted-foreground mb-2">New Record Data</div>
        <Card>
          <CardContent className="pt-6">
            <DataDisplay data={newData} highlightFields={[]} variant="created" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // For DELETE, only show old data
  if (action === "DELETE" && oldData) {
    return (
      <div>
        <div className="text-sm font-medium text-muted-foreground mb-2">Deleted Record Data</div>
        <Card>
          <CardContent className="pt-6">
            <DataDisplay data={oldData} highlightFields={[]} variant="deleted" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // For UPDATE, show side-by-side comparison
  if (action === "UPDATE" && oldData && newData) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {/* Before */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              Before
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataDisplay
              data={oldData}
              highlightFields={changedFields}
              variant="before"
              comparisonData={newData}
            />
          </CardContent>
        </Card>

        {/* After */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              After
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataDisplay
              data={newData}
              highlightFields={changedFields}
              variant="after"
              comparisonData={oldData}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

// ============================================
// DATA DISPLAY COMPONENT
// ============================================

interface DataDisplayProps {
  data: Record<string, unknown>;
  highlightFields: string[];
  variant: "before" | "after" | "created" | "deleted";
  comparisonData?: Record<string, unknown>; // For detecting redacted diffs
}

function DataDisplay({ data, highlightFields, variant, comparisonData }: DataDisplayProps) {
  const entries = Object.entries(data);

  // Sort: changed fields first, then alphabetically
  entries.sort((a, b) => {
    const aChanged = highlightFields.includes(a[0]);
    const bChanged = highlightFields.includes(b[0]);

    if (aChanged && !bChanged) return -1;
    if (!aChanged && bChanged) return 1;
    return a[0].localeCompare(b[0]);
  });

  return (
    <div className="space-y-3">
      {entries.map(([key, value]) => {
        const isChanged = highlightFields.includes(key);
        const highlightClass = isChanged
          ? variant === "before"
            ? "bg-red-50 dark:bg-red-950/20 border-l-2 border-red-500 pl-3"
            : variant === "after"
            ? "bg-green-50 dark:bg-green-950/20 border-l-2 border-green-500 pl-3"
            : ""
          : "";

        // Check if both old and new are redacted (confusing diff)
        const isRedactedDiff =
          comparisonData &&
          value === "[REDACTED]" &&
          comparisonData[key] === "[REDACTED]";

        return (
          <div key={key} className={`py-2 ${highlightClass}`}>
            <div className="text-xs font-medium text-muted-foreground mb-1">
              {formatFieldName(key)}
              {isChanged && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Changed
                </Badge>
              )}
            </div>
            <div className="text-sm">
              {isRedactedDiff ? (
                <span className="text-muted-foreground italic">
                  Sensitive field changed (value redacted)
                </span>
              ) : (
                <ValueDisplay value={value} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// VALUE DISPLAY COMPONENT
// ============================================

function ValueDisplay({ value }: { value: unknown }) {
  // Null/undefined
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }

  // Boolean
  if (typeof value === "boolean") {
    return <Badge variant={value ? "default" : "secondary"}>{String(value)}</Badge>;
  }

  // Number
  if (typeof value === "number") {
    return <span className="font-mono">{value.toLocaleString()}</span>;
  }

  // Date string (ISO 8601)
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    try {
      return <span className="font-mono">{format(new Date(value), "PPpp")}</span>;
    } catch {
      return <span>{value}</span>;
    }
  }

  // String
  if (typeof value === "string") {
    // Redacted fields
    if (value === "[REDACTED]") {
      return (
        <Badge variant="destructive" className="font-mono text-xs">
          [REDACTED]
        </Badge>
      );
    }

    // Long strings - truncate with expand
    if (value.length > 100) {
      return (
        <details className="cursor-pointer">
          <summary className="text-muted-foreground">
            {value.substring(0, 100)}... (click to expand)
          </summary>
          <div className="mt-2 text-sm">{value}</div>
        </details>
      );
    }

    return <span>{value}</span>;
  }

  // Object/Array - show as formatted JSON
  if (typeof value === "object") {
    return (
      <details className="cursor-pointer">
        <summary className="text-muted-foreground">Object/Array (click to expand)</summary>
        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
          {JSON.stringify(value, null, 2)}
        </pre>
      </details>
    );
  }

  // Fallback
  return <span>{String(value)}</span>;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format field names for display
 * Converts snake_case to Title Case
 */
function formatFieldName(fieldName: string): string {
  return fieldName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Action badge component (reused from table)
 */
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
```

## Diff Viewer Features

### 1. Side-by-Side Comparison

For UPDATE operations:

- **Left panel** - Before state (red border for changed fields)
- **Right panel** - After state (green border for changed fields)
- Changed fields shown first, then alphabetically

### 2. Insert/Delete Views

- **INSERT** - Shows only new data (no before state)
- **DELETE** - Shows only old data (no after state)

### 3. Value Type Formatting

- **Dates** - Formatted as human-readable (e.g., "Jan 15, 2024, 10:30 AM")
- **Booleans** - Shown as badges (true/false)
- **Numbers** - Locale-formatted with commas
- **Null** - Shown as italic "null"
- **[REDACTED]** - Red badge for sensitive data
- **Long strings** - Collapsible with "click to expand"
- **Objects/Arrays** - Collapsible JSON view

### 4. Changed Field Highlighting

Changed fields get:

- Red background + border (before state)
- Green background + border (after state)
- "Changed" badge next to field name

### 5. Field Name Formatting

```typescript
// snake_case → Title Case
formatFieldName("booking_status"); // "Booking Status"
formatFieldName("guest_name"); // "Guest Name"
```

## Component Props

```typescript
interface AuditDiffViewerProps {
  log: AuditLog | null; // Audit log to display
  open: boolean; // Dialog open state
  onOpenChange: (open: boolean) => void; // Open state callback
}
```

## Usage Example

From the `AuditLogViewer` component:

```typescript
// State for diff viewer
const [diffDialogOpen, setDiffDialogOpen] = useState(false);
const [selectedLogForDiff, setSelectedLogForDiff] = useState<AuditLog | null>(null);

// Open diff viewer
const openDiffViewer = (log: AuditLog) => {
  setSelectedLogForDiff(log);
  setDiffDialogOpen(true);
};

// Render dialog
{selectedLogForDiff && (
  <AuditDiffViewer
    log={selectedLogForDiff}
    open={diffDialogOpen}
    onOpenChange={setDiffDialogOpen}
  />
)}

// Trigger button in table row
<Button onClick={() => openDiffViewer(log)}>
  <Eye className="h-4 w-4 mr-1" />
  View
</Button>
```

## Styling and Layout

### Dialog Size

```typescript
<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
```

- **Width**: Max 4xl (56rem / 896px)
- **Height**: Max 90vh (scrollable)
- **Responsive**: Stacks on mobile

### Color Coding

```typescript
// Before state (removed)
className="bg-red-50 dark:bg-red-950/20 border-l-2 border-red-500 pl-3"

// After state (added)
className="bg-green-50 dark:bg-green-950/20 border-l-2 border-green-500 pl-3"

// Redacted field
<Badge variant="destructive">[REDACTED]</Badge>
```

## Accessibility

- **Semantic HTML**: Proper heading hierarchy
- **ARIA Labels**: Dialog has proper role and labels
- **Keyboard Navigation**: Dialog closable with Escape key
- **Focus Management**: Focus returns to trigger on close
- **Color Independence**: Not solely reliant on color (uses borders + badges)

## Edge Cases Handled

### 1. No Data Changes

```typescript
// Shows message if neither old_data nor new_data exist
{!hasData && (
  <div className="flex items-center gap-2 text-muted-foreground">
    <AlertCircle className="h-4 w-4" />
    <span>No data changes recorded for this log entry</span>
  </div>
)}
```

### 2. Long Values

```typescript
// Truncate strings > 100 chars with expand
{value.length > 100 && (
  <details>
    <summary>{value.substring(0, 100)}... (click to expand)</summary>
    <div>{value}</div>
  </details>
)}
```

### 3. Redacted Fields

```typescript
// Special badge for [REDACTED] placeholder
{value === "[REDACTED]" && (
  <Badge variant="destructive">[REDACTED]</Badge>
)}
```

### 4. Complex Objects

```typescript
// Collapsible JSON view for objects/arrays
{typeof value === "object" && (
  <details>
    <summary>Object/Array (click to expand)</summary>
    <pre>{JSON.stringify(value, null, 2)}</pre>
  </details>
)}
```

## Testing Checklist

- [ ] Dialog opens when "View" button clicked
- [ ] UPDATE shows side-by-side comparison
- [ ] INSERT shows only new data
- [ ] DELETE shows only old data
- [ ] Changed fields highlighted correctly
- [ ] Date values formatted properly
- [ ] Redacted fields show red badge
- [ ] Long strings collapsible
- [ ] Objects/arrays show as JSON
- [ ] Dialog closes with Escape key
- [ ] Responsive on mobile (stacked layout)

## Next Steps

**Next**: [Phase 4 - Security Policies](../04-security-implementation/04-security-policies.md)

Phase 4 will cover RLS policies, access control, sensitive data handling, and manual archival procedures.

You've completed Phase 3 (Audit Viewer UI)! You now have:

- ✅ Audit logs page with routing
- ✅ Statistics panel
- ✅ Filterable table with pagination
- ✅ Filter controls with quick actions
- ✅ Diff viewer dialog with before/after comparison

The UI is complete and ready for security hardening!

---

**Diff Viewer Checklist:**

- [ ] `AuditDiffViewer.tsx` component created
- [ ] Side-by-side comparison working
- [ ] All value types formatted correctly
- [ ] Changed fields highlighted
- [ ] Redacted fields handled
- [ ] Long values collapsible
- [ ] Dialog responsive and accessible
