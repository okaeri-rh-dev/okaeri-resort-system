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
import { ActionBadge } from "./ActionBadge";
import { sanitizeText } from "@/lib/security/sanitize";

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

  // Type-guard the data first
  const oldData =
    log.old_data && typeof log.old_data === "object" && !Array.isArray(log.old_data)
      ? (log.old_data as Record<string, unknown>)
      : null;

  const newData =
    log.new_data && typeof log.new_data === "object" && !Array.isArray(log.new_data)
      ? (log.new_data as Record<string, unknown>)
      : null;

  // Check hasData based on type-guarded values
  const hasData = oldData || newData;
  const changedFields = log.changed_fields || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Log Details</DialogTitle>
          <DialogDescription>
            {TABLE_DISPLAY_NAMES[log.table_name as keyof typeof TABLE_DISPLAY_NAMES] ||
              log.table_name}{" "}
            • {ACTION_DISPLAY_NAMES[log.action as keyof typeof ACTION_DISPLAY_NAMES] || log.action}{" "}
            • {log.created_at ? format(new Date(log.created_at), "PPpp") : "Unknown time"}
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
            {log.ip_address !== null && log.ip_address !== undefined && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">IP Address</div>
                <div className="text-sm font-mono">{String(log.ip_address)}</div>
              </div>
            )}
          </div>

          {/* Description (from column, not metadata) - XSS protected via SafeAuditText */}
          {log.description && (
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">Description</div>
              <SafeAuditText
                text={log.description}
                className="text-sm bg-muted p-3 rounded-md block"
              />
            </div>
          )}

          <Separator />

          {/* Changed Fields Summary - Only show for DB triggers with actual changes */}
          {log.source === "db" && changedFields.length > 0 && (
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
              oldData={oldData}
              newData={newData}
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
              {/* XSS-Safe: JSON.stringify automatically escapes <, >, & as Unicode (\u003C, \u003E, \u0026).
                  Rendered in <pre> tag, not interpreted as HTML. More flexible than per-field SafeAuditText. */}
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
          comparisonData && value === "[REDACTED]" && comparisonData[key] === "[REDACTED]";

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
      // Date parsing failed, treat as regular string (sanitize below)
      return <span>{sanitizeText(value)}</span>;
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
    // XSS Protection: Sanitize all string values (defense-in-depth even if sanitized at input)
    const sanitizedValue = sanitizeText(value);

    if (sanitizedValue.length > 100) {
      return (
        <details className="cursor-pointer">
          <summary className="text-muted-foreground">
            {sanitizedValue.substring(0, 100)}... (click to expand)
          </summary>
          <div className="mt-2 text-sm">{sanitizedValue}</div>
        </details>
      );
    }

    return <span>{sanitizedValue}</span>;
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

  // Fallback - sanitize unknown types converted to strings
  return <span>{sanitizeText(String(value))}</span>;
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
 * Action badge component - Now imported from shared ActionBadge.tsx
 */
