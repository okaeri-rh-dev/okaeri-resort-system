/**
 * app_roles.role is a CHECK-constrained varchar, generated as `string`.
 * APP_ROLE_NAMES narrows it, and requireRole lists and lookupUserRole are
 * typed from it; this keeps it equal to the latest CHECK in the migrations.
 */

import { describe, expect, it } from "vitest";

import { AuditRole } from "@/lib/audit-roles";
import { APP_ROLE_NAMES } from "@/types";

import { latestCheckConstraintValues } from "./check-constraint";

describe("app_roles.role parity", () => {
  it("APP_ROLE_NAMES equals the app_roles_role_check values", () => {
    expect([...APP_ROLE_NAMES].sort()).toEqual(
      latestCheckConstraintValues("app_roles_role_check").sort()
    );
  });

  it("AuditRole has the same values as APP_ROLE_NAMES", () => {
    expect(Object.values(AuditRole).sort()).toEqual([...APP_ROLE_NAMES].sort());
  });
});
