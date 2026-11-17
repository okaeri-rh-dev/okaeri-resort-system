import { describe, expect, it } from "vitest";

import { AuditRole } from "@/lib/audit-roles";

import { bookingEditRules } from "../operations";

const rules = (
  booking_status: Parameters<typeof bookingEditRules>[0]["booking_status"],
  role: AuditRole
) => bookingEditRules({ booking_status }, role);

describe("bookingEditRules", () => {
  it.each([
    ["Pending", AuditRole.STAFF, { guest: true, stay: true, notes: true }],
    ["Confirmed", AuditRole.STAFF, { guest: true, stay: true, notes: true }],
    ["CheckedIn", AuditRole.STAFF, { guest: true, stay: false, notes: true }],
    ["CheckedIn", AuditRole.MANAGER, { guest: true, stay: true, notes: true }],
    ["CheckedOut", AuditRole.OWNER, { guest: true, stay: false, notes: true }],
    ["Cancelled", AuditRole.ADMIN, { guest: false, stay: false, notes: true }],
  ] as const)("a %s booking gives %s these sections", (status, role, sections) => {
    expect(rules(status, role).sections).toEqual(sections);
  });

  it("leaves nothing editable on an anonymized booking", () => {
    expect(
      bookingEditRules(
        { booking_status: "Confirmed", anonymized_at: "2026-11-01T00:00:00Z" },
        AuditRole.ADMIN
      ).sections
    ).toEqual({ guest: false, stay: false, notes: false });
  });

  it("locks a Confirmed booking's dates for staff only", () => {
    expect(rules("Confirmed", AuditRole.STAFF).datesLocked).toBe(true);
    expect(rules("Confirmed", AuditRole.MANAGER).datesLocked).toBe(false);
  });

  it("locks the check-in day once the guest has checked in", () => {
    expect(rules("CheckedIn", AuditRole.MANAGER).checkInLocked).toBe(true);
    expect(rules("Confirmed", AuditRole.MANAGER).checkInLocked).toBe(false);
  });

  it("allows only the internal note on a Cancelled booking", () => {
    expect(rules("Cancelled", AuditRole.MANAGER).internalNoteOnly).toBe(true);
    expect(rules("CheckedOut", AuditRole.MANAGER).internalNoteOnly).toBe(false);
  });
});
