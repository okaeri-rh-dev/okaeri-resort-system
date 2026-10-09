// src/components/audit/ActionBadge.tsx

import { Badge } from "@/components/ui/badge";
import { ACTION_DISPLAY_NAMES } from "@/lib/audit-constants";
import type { AuditLog } from "@/types/audit.types";

interface ActionBadgeProps {
  log: Pick<AuditLog, "action" | "source" | "metadata">;
}

// App rows are always stored as INSERT; what happened lives in metadata.action
function appActionLabel(metadata: AuditLog["metadata"]): string {
  const action =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata.action
      : undefined;
  if (typeof action !== "string" || action === "") return "Event";
  const words = action.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Badge component for displaying audit log action types
 * Shared across AuditLogViewer and AuditDiffViewer
 */
export function ActionBadge({ log }: ActionBadgeProps) {
  if (log.source === "app") {
    return <Badge variant="outline">{appActionLabel(log.metadata)}</Badge>;
  }

  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    INSERT: "default",
    UPDATE: "secondary",
    DELETE: "destructive",
  };

  return (
    <Badge variant={variants[log.action] || "outline"}>
      {ACTION_DISPLAY_NAMES[log.action as keyof typeof ACTION_DISPLAY_NAMES] || log.action}
    </Badge>
  );
}
