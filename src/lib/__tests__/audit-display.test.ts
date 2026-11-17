import { describe, expect, it } from "vitest";

import type { AuditLog } from "@/types/audit.types";

import { auditActorLabel, hideDerivedHistoryRows, isAnonymized } from "../audit-display";

const ANONYMIZED = { anonymized_at: "2028-01-02T03:00:00Z" };

describe("isAnonymized", () => {
  it("is true only when metadata carries anonymized_at", () => {
    expect(isAnonymized({ metadata: ANONYMIZED })).toBe(true);
    expect(isAnonymized({ metadata: { ip: "10.0.0.1" } })).toBe(false);
    expect(isAnonymized({ metadata: null })).toBe(false);
    expect(isAnonymized({ metadata: ["anonymized_at"] })).toBe(false);
  });
});

describe("auditActorLabel", () => {
  it("shows the email when present", () => {
    expect(auditActorLabel({ user_email: "a@b.com", user_id: "u1", metadata: null })).toBe(
      "a@b.com"
    );
  });

  it("marks anonymized staff rows", () => {
    expect(auditActorLabel({ user_email: null, user_id: "u1", metadata: ANONYMIZED })).toBe(
      "Staff (details removed)"
    );
  });

  it("falls back to System otherwise", () => {
    expect(auditActorLabel({ user_email: null, user_id: null, metadata: ANONYMIZED })).toBe(
      "System"
    );
    expect(auditActorLabel({ user_email: null, user_id: "u1", metadata: null })).toBe("System");
  });
});

const SAVE = "2026-11-17T02:00:00.000+00:00";
const EARLIER = "2026-11-16T02:00:00.000+00:00";

function row(
  description: string,
  overrides: Partial<AuditLog> & Pick<AuditLog, "table_name" | "action">
): AuditLog {
  return {
    audit_id: description,
    category: null,
    changed_fields: null,
    correlation_id: null,
    created_at: SAVE,
    description,
    event_type: null,
    ip_address: null,
    metadata: null,
    new_data: null,
    old_data: null,
    record_id: "booking-1",
    record_pk: null,
    severity: null,
    source: "trigger",
    user_agent: null,
    user_email: null,
    user_id: null,
    user_role: null,
    ...overrides,
  };
}

function totalRow(description: string, from: number, to: number, fields?: string[]) {
  return row(description, {
    table_name: "bookings",
    action: "UPDATE",
    changed_fields: fields ?? ["total_amount", "base_amount", "updated_at"],
    old_data: { total_amount: from },
    new_data: { total_amount: to },
  });
}

function priceRow(description: string) {
  return row(description, {
    table_name: "booking_units",
    action: "UPDATE",
    changed_fields: ["unit_price", "subtotal", "updated_at"],
  });
}

const cabinAdded = row("Cabin 2 added", { table_name: "booking_units", action: "INSERT" });
const cabinRemoved = row("Cabin 1 removed", { table_name: "booking_units", action: "DELETE" });

const shown = (logs: AuditLog[]) => hideDerivedHistoryRows(logs).map((log) => log.description);

describe("hideDerivedHistoryRows", () => {
  it("keeps only the added and removed cabins of a swap that keeps the total", () => {
    const logs = [
      cabinAdded,
      totalRow("count after add", 1000, 1000, ["unit_count", "is_multi_unit", "updated_at"]),
      cabinRemoved,
      totalRow("total drops", 1000, 0),
      priceRow("Cabin 2 split"),
      totalRow("total restored", 0, 1000),
    ];

    expect(shown(logs)).toEqual(["Cabin 2 added", "Cabin 1 removed"]);
  });

  it("hides the payment status that follows the total down and back in a swap", () => {
    const statusRow = (description: string, total: number) =>
      row(description, {
        table_name: "bookings",
        action: "UPDATE",
        changed_fields: ["payment_status", "updated_at"],
        old_data: { total_amount: total },
        new_data: { total_amount: total },
      });
    const logs = [
      cabinRemoved,
      totalRow("total drops", 1000, 0),
      statusRow("status Paid", 0),
      priceRow("Cabin 2 split"),
      totalRow("total restored", 0, 1000),
      statusRow("status Partial", 1000),
    ];

    expect(shown(logs)).toEqual(["Cabin 1 removed"]);
  });

  it("keeps every row of a recompute swap, which moves the total", () => {
    const logs = [
      cabinAdded,
      totalRow("count after add", 1000, 1000, ["unit_count", "updated_at"]),
      cabinRemoved,
      totalRow("total drops", 1000, 0),
      priceRow("Cabin 2 priced"),
      totalRow("total recomputed", 0, 1400),
    ];

    expect(shown(logs)).toEqual([
      "Cabin 2 added",
      "count after add",
      "Cabin 1 removed",
      "total drops",
      "Cabin 2 priced",
      "total recomputed",
    ]);
  });

  it("keeps a bookings row that also changes a real field", () => {
    const logs = [
      cabinAdded,
      totalRow("dates moved", 1000, 1000, ["check_in", "num_guests", "updated_at"]),
    ];

    expect(shown(logs)).toEqual(["Cabin 2 added", "dates moved"]);
  });

  it("keeps a derived bookings row with no cabin row at the same moment", () => {
    expect(shown([totalRow("total edited directly", 1000, 1200)])).toEqual([
      "total edited directly",
    ]);
  });

  it("keeps the total and price rows of a set_booking_total change", () => {
    const logs = [
      priceRow("Cabin 1 split"),
      totalRow("total after cabin 1", 1000, 1500),
      priceRow("Cabin 2 split"),
      totalRow("total after cabin 2", 1500, 1800),
    ];

    expect(shown(logs)).toEqual([
      "Cabin 1 split",
      "total after cabin 1",
      "Cabin 2 split",
      "total after cabin 2",
    ]);
  });

  it("keeps a cabin row that changes more than its price", () => {
    const guestsChanged = row("Cabin 1 guests", {
      table_name: "booking_units",
      action: "UPDATE",
      changed_fields: ["assigned_guests", "updated_at"],
    });

    expect(shown([guestsChanged, totalRow("count", 1000, 1000, ["num_guests"])])).toEqual([
      "Cabin 1 guests",
    ]);
  });

  it("judges each transaction on its own moment", () => {
    const earlierTotal = { ...totalRow("earlier total", 800, 1000), created_at: EARLIER };

    expect(shown([cabinAdded, earlierTotal])).toEqual(["Cabin 2 added", "earlier total"]);
  });
});
