import { SelectItem } from "@/components/patterns";
import { AuditRole, getRoleDisplayName } from "@/lib/audit-roles";

const ROLE_SCOPES: Record<AuditRole, string> = {
  [AuditRole.ADMIN]: "Full system access",
  [AuditRole.OWNER]: "Business owner privileges",
  [AuditRole.MANAGER]: "Operations management",
  [AuditRole.STAFF]: "Basic access",
};

/** The role choices, each with its scope, for a `SelectControl`. */
export function RoleOptions() {
  return Object.values(AuditRole).map((role) => (
    <SelectItem key={role} value={role}>
      {getRoleDisplayName(role)} - {ROLE_SCOPES[role]}
    </SelectItem>
  ));
}
