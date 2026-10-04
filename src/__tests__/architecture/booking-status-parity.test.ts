/**
 * The generated types give bookings.booking_status as `string`, so the CHECK
 * constraint is the only source of truth for its values. Code compared it to
 * values the CHECK rejects ("Completed", "pending") and silently matched
 * nothing. BOOKING_STATUSES narrows the column type; this keeps it equal to
 * the latest CHECK definition in the migrations.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { BOOKING_STATUSES } from "@/types";

const migrationsDir = join(__dirname, "..", "..", "..", "supabase", "migrations");

function latestBookingStatusCheckValues(): string[] {
  const definitions = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .flatMap((name) => readFileSync(join(migrationsDir, name), "utf8").split("\n"))
    .filter((line) => line.includes("bookings_booking_status_check") && line.includes("CHECK"));

  const latest = definitions.at(-1);
  if (!latest) throw new Error("bookings_booking_status_check not found in migrations");
  return [...latest.matchAll(/'([^']+)'::/g)].map((match) => match[1]);
}

describe("booking_status parity", () => {
  it("BOOKING_STATUSES equals the bookings_booking_status_check values", () => {
    expect([...BOOKING_STATUSES].sort()).toEqual(latestBookingStatusCheckValues().sort());
  });
});
