// src/components/audit/ActionBadge.tsx

import { StatusBadge, type StatusTone } from "@/components/patterns";
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
    return <StatusBadge tone="neutral">{appActionLabel(log.metadata)}</StatusBadge>;
  }

  const tones: Record<string, StatusTone> = {
    INSERT: "success",
    UPDATE: "info",
    DELETE: "danger",
  };

  return (
    <StatusBadge tone={tones[log.action] ?? "neutral"}>
      {ACTION_DISPLAY_NAMES[log.action as keyof typeof ACTION_DISPLAY_NAMES] || log.action}
    </StatusBadge>
  );
}
