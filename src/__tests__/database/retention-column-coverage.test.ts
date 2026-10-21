/**
 * Guest retention fails safe: every column of the tables anonymize_guest touches must be
 * on its clear-list or its keep-list. A new column fails here until someone classifies it
 * (and, if personal, clears it in supabase/migrations/20261021000000_guest_retention.sql).
 *
 * @vitest-environment node
 */

import { beforeAll, describe, expect, it } from "vitest";

import { psqlAvailable, runPsql } from "../setup/psql";
import { shouldRunDatabaseTests } from "../setup/test-db";

const COLUMNS: Record<string, { clear: string[]; keep: string[] }> = {
  guests: {
    clear: ["guest_name", "email", "phone_number"],
    keep: [
      "guest_id",
      "total_bookings",
      "total_spent",
      "created_at",
      "updated_at",
      "anonymized_at",
    ],
  },
  bookings: {
    clear: [
      "guest_name",
      "email",
      "contact_number",
      "special_requests",
      "internal_notes",
      "payment_proof_url",
    ],
    keep: [
      "booking_id",
      "booking_reference",
      "guest_id",
      "booking_status",
      "payment_status",
      "payment_method",
      "check_in",
      "check_out",
      "num_guests",
      "base_amount",
      "discount_amount",
      "discount_percent",
      "downpayment_required",
      "tax_amount",
      "total_amount",
      "total_surcharges",
      "pricing_metadata",
      "pricing_snapshot",
      "is_guest_booking",
      "is_multi_unit",
      "is_walk_in",
      "requested_unit_count",
      "unit_assignment_status",
      "unit_count",
      "upload_status",
      "upload_expires_at",
      "created_at",
      "updated_at",
      "anonymized_at",
    ],
  },
  booking_units: {
    clear: ["guest_names", "unit_notes"],
    keep: [
      "booking_unit_id",
      "booking_id",
      "unit_id",
      "unit_price",
      "weekend_surcharge",
      "extra_person_charge",
      "subtotal",
      "assigned_guests",
      "created_at",
      "updated_at",
    ],
  },
  payments: {
    clear: ["notes", "proof_url"],
    keep: [
      "payment_id",
      "booking_id",
      "account_id",
      "amount",
      "payment_date",
      "payment_method",
      "status",
      "created_at",
    ],
  },
  guest_assignments: {
    clear: ["room_preferences"],
    keep: ["assignment_id", "booking_unit_id", "guest_id", "is_primary", "created_at"],
  },
};

describe("guest retention column coverage", () => {
  let canRun = false;

  beforeAll(async () => {
    canRun = (await shouldRunDatabaseTests()) && psqlAvailable();
  });

  it.each(Object.keys(COLUMNS))("classifies every column of %s", (table) => {
    if (!canRun) return;
    const columns = runPsql(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY 1;
    `);
    const { clear, keep } = COLUMNS[table];
    const classified = [...clear, ...keep];

    expect(columns.filter((column) => !classified.includes(column))).toEqual([]);
    expect(classified.filter((column) => !columns.includes(column))).toEqual([]);
  });
});
