// src/components/audit/ActionBadge.tsx

import { Badge } from "@/components/ui/badge";
import { ACTION_DISPLAY_NAMES } from "@/lib/audit-constants";

interface ActionBadgeProps {
  action: string;
}

/**
 * Badge component for displaying audit log action types
 * Shared across AuditLogViewer and AuditDiffViewer
 */
export function ActionBadge({ action }: ActionBadgeProps) {
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
