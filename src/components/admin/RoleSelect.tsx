import type { ComponentProps } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/patterns";
import { AuditRole, getRoleDisplayName } from "@/lib/audit-roles";

const ROLE_SCOPES: Record<AuditRole, string> = {
  [AuditRole.ADMIN]: "Full system access",
  [AuditRole.OWNER]: "Business owner privileges",
  [AuditRole.MANAGER]: "Operations management",
  [AuditRole.STAFF]: "Basic access",
};

type RoleSelectProps = Omit<ComponentProps<typeof SelectTrigger>, "value" | "onChange"> & {
  value: AuditRole | undefined;
  onChange: (role: AuditRole) => void;
  placeholder: string;
};

/**
 * A role picker for a `FormField`: the field's id and ARIA props land on the trigger, so the
 * label names it and the message describes it.
 */
export function RoleSelect({ value, onChange, placeholder, ...triggerProps }: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={(role) => onChange(role as AuditRole)}>
      <SelectTrigger {...triggerProps}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.values(AuditRole).map((role) => (
          <SelectItem key={role} value={role}>
            {getRoleDisplayName(role)} - {ROLE_SCOPES[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
