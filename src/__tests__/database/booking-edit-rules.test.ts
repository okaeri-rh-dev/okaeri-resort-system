/**
 * The database allows the guest details, notes and total of a booking to change
 * only where its status allows (ADR 0007): Pending to CheckedOut allow guest
 * details and notes, the total is manager-only, Cancelled allows only the
 * internal note, and an anonymized booking allows nothing.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AppRoleName } from "@/types/app-role";
import type { BookingStatus } from "@/types/booking-status";
import type { Json } from "@/types/database.types";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestBooking,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let roleClients: RoleClients;
let shouldRun = false;

type Section = "guest" | "special request" | "internal note" | "total";

const EDITS: Record<Section, { changes: Json; total?: number }> = {
  guest: { changes: { guest_name: "Renamed Guest", contact_number: "09170000000" } },
  "special request": { changes: { special_requests: "Extra towels" } },
  "internal note": { changes: { internal_notes: "Called the guest" } },
  total: { changes: {}, total: 1234 },
};

const ROLES: AppRoleName[] = ["staff", "manager", "owner", "admin"];
const SECTIONS = Object.keys(EDITS) as Section[];

function allowed(status: BookingStatus | "Anonymized", section: Section, role: AppRoleName) {
  if (status === "Anonymized") return false;
  if (section === "total") return role !== "staff" && status !== "Cancelled";
  return status !== "Cancelled" || section === "internal note";
}

async function bookingIn(status: BookingStatus | "Anonymized") {
  const booking = await createTestBooking({
    booking_status: status === "Anonymized" ? "CheckedOut" : status,
  });
  if (status === "Anonymized") {
    const { error } = await service
      .from("bookings")
      .update({ anonymized_at: new Date().toISOString() })
      .eq("booking_id", booking.booking_id);
    if (error) throw error;
  }
  return booking.booking_id;
}

const editAs = (role: AppRoleName, bookingId: string, section: Section) =>
  roleClients.byRole[role].rpc("update_booking", {
    p_booking_id: bookingId,
    p_changes: EDITS[section].changes,
    p_total: EDITS[section].total,
  });

const snapshot = async (bookingId: string) => {
  const { data, error } = await service
    .from("bookings")
    .select("guest_name, contact_number, special_requests, internal_notes, total_amount")
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data;
};

describe("booking edit rules", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("edit-rules");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  const statuses = [
    "Pending",
    "Confirmed",
    "CheckedIn",
    "CheckedOut",
    "Cancelled",
    "Anonymized",
  ] as const;

  describe.each(statuses)("a %s booking", (status) => {
    it.each(ROLES)("lets %s edit only what the status allows", async (role) => {
      if (!shouldRun) return;
      const bookingId = await bookingIn(status);

      for (const section of SECTIONS) {
        const before = await snapshot(bookingId);
        const { error } = await editAs(role, bookingId, section);

        if (allowed(status, section, role)) {
          expect(error, `${role} edits the ${section}`).toBeNull();
          expect(await snapshot(bookingId), `${role} edits the ${section}`).not.toEqual(before);
        } else {
          expect(error?.code, `${role} edits the ${section}`).toBe("42501");
          expect(await snapshot(bookingId)).toEqual(before);
        }
      }
    });
  });

  it("still copies a guest rename to the guest's cancelled booking", async () => {
    if (!shouldRun) return;
    const booking = await createTestBooking({ booking_status: "Cancelled" });

    const { error } = await roleClients.byRole.manager
      .from("guests")
      .update({ guest_name: "Maria Renamed" })
      .eq("guest_id", booking.guest_id!);

    expect(error).toBeNull();
    expect((await snapshot(booking.booking_id)).guest_name).toBe("Maria Renamed");
  });
});
