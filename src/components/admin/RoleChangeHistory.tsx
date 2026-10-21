// src/components/admin/RoleChangeHistory.tsx

import { Link } from "@tanstack/react-router";
import { ArrowRight, ExternalLink, History } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Skeleton,
  StatusBadge,
} from "@/components/patterns";
import { useRoleHistory } from "@/hooks/useRoleManagement";
import { auditActorLabel } from "@/lib/audit-display";
import { getRoleDisplayName } from "@/lib/audit-roles";
import { formatDate } from "@/lib/utils";
import type { AuditLog } from "@/types/audit.types";

// ============================================
// TYPES
// ============================================

interface RoleChangeHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userEmail: string;
}

interface RoleChangeData {
  role?: string;
  is_active?: boolean;
  notes?: string;
  granted_by?: string;
}

// ============================================
// COMPONENT
// ============================================

export function RoleChangeHistory({
  open,
  onOpenChange,
  userId,
  userEmail,
}: RoleChangeHistoryProps) {
  const { data: history, isLoading, error } = useRoleHistory(userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Role Change History
          </DialogTitle>
          <DialogDescription>
            Complete audit trail for <span className="font-medium break-all">{userEmail}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {isLoading ? (
            // Loading state
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-l-2 pb-4 pl-4">
                  <Skeleton className="mb-2 h-4 w-32" />
                  <Skeleton className="mb-1 h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ))}
            </div>
          ) : error ? (
            // Error state
            <div className="border-destructive bg-destructive/10 rounded-lg border p-4">
              <p className="text-destructive font-medium">Failed to load role history</p>
              <p className="text-muted-foreground text-sm">{String(error)}</p>
            </div>
          ) : !history || history.length === 0 ? (
            // Empty state
            <div className="text-muted-foreground py-8 text-center">
              <History className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="font-medium">No role changes recorded</p>
              <p className="text-sm">Role modifications will appear here once changes are made.</p>
            </div>
          ) : (
            // History timeline
            <div className="pt-1 pl-3.5">
              {history.map((entry, index) => (
                <RoleChangeEntry
                  key={entry.audit_id}
                  entry={entry}
                  isLast={index === history.length - 1}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Link to full audit trail */}
        {history && history.length > 0 && (
          <div className="border-t pt-4">
            <Link
              to="/admin/audit-logs"
              search={{ entity_type: "app_role", recordId: userId || undefined }}
              className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
            >
              View full audit trail
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// HISTORY ENTRY COMPONENT
// ============================================

function RoleChangeEntry({ entry, isLast }: { entry: AuditLog; isLast: boolean }) {
  const oldData = entry.old_data as RoleChangeData | null;
  const newData = entry.new_data as RoleChangeData | null;

  // Determine what changed
  const action = entry.action;
  const timestamp = entry.created_at;
  const userEmail = auditActorLabel(entry);

  // Extract role changes
  const oldRole = oldData?.role;
  const newRole = newData?.role;
  const oldActive = oldData?.is_active;
  const newActive = newData?.is_active;
  const notes = newData?.notes || entry.description;

  // Determine change type
  let changeDescription: React.ReactNode;
  let changeType: "create" | "update" | "deactivate" | "delete";

  if (action === "INSERT") {
    changeType = "create";
    changeDescription = (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Role granted:</span>
        <RoleBadgeInline role={newRole ?? "none"} />
      </div>
    );
  } else if (action === "DELETE") {
    changeType = "delete";
    changeDescription = (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Role removed:</span>
        <RoleBadgeInline role={oldRole ?? "none"} />
      </div>
    );
  } else if (oldActive && !newActive) {
    changeType = "deactivate";
    changeDescription = (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Role deactivated:</span>
        <RoleBadgeInline role={oldRole ?? "none"} />
      </div>
    );
  } else if (oldRole && newRole && oldRole !== newRole) {
    changeType = "update";
    changeDescription = (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Role changed:</span>
        <RoleBadgeInline role={oldRole} />
        <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
        <RoleBadgeInline role={newRole} />
      </div>
    );
  } else {
    changeType = "update";
    changeDescription = (
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Role updated</span>
        {newRole && <RoleBadgeInline role={newRole} />}
      </div>
    );
  }

  // Timeline styling
  const borderColor = isLast ? "border-transparent" : "border-border";
  const dotColor = {
    create: "bg-success-foreground",
    update: "bg-info-foreground",
    deactivate: "bg-warning-foreground",
    delete: "bg-danger-foreground",
  }[changeType];

  return (
    <div className={`relative border-l-2 ${borderColor} pb-6 pl-6`}>
      {/* Timeline dot */}
      <div
        className={`absolute top-0 left-0 h-4 w-4 -translate-x-[9px] rounded-full ${dotColor} ring-background ring-4`}
      />

      {/* Timestamp */}
      <p className="text-muted-foreground mb-1 text-xs tabular-nums">
        {timestamp ? formatDate(new Date(timestamp)) : "Unknown date"}
      </p>

      {/* Change description */}
      <div className="mb-2">{changeDescription}</div>

      {/* Changed by */}
      <p className="text-muted-foreground text-xs">
        by <span className="font-medium">{userEmail}</span>
      </p>

      {/* Notes */}
      {notes && (
        <div className="bg-muted/50 mt-2 rounded-md border p-2">
          <p className="text-muted-foreground text-xs italic">"{notes}"</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// INLINE ROLE BADGE
// ============================================

function RoleBadgeInline({ role }: { role: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayName = getRoleDisplayName(role as any);

  return <StatusBadge tone="neutral">{displayName}</StatusBadge>;
}
