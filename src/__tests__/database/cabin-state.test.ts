/**
 * A cabin's state on a date is derived from blocks and bookings (ADR 0005):
 * Blocked (with the reason), Booked or Free. The cabin status column plays no part.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { toStayInstants, type ManilaDay } from "@/lib/bookings/stay";

import { runPsql } from "../setup/psql";
import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  testSupabaseAdmin as admin,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const REASON_PREFIX = "dbtest-cabin-state";

let shouldRun = false;
let roles: RoleClients;
const unitIds: string[] = [];
const bookingIds: string[] = [];

async function newUnit(overrides: Parameters<typeof createTestUnit>[0] = {}) {
  const unit = await createTestUnit(overrides);
  unitIds.push(unit.unit_id);
  return unit.unit_id;
}

async function addBlock(
  unitId: string | null,
  firstNight: ManilaDay,
  lastNight: ManilaDay,
  reason: string
) {
  const { error } = await admin.from("availability_blackouts").insert({
    unit_id: unitId,
    start_date: firstNight,
    end_date: lastNight,
    reason: `${REASON_PREFIX} ${reason}`,
  });
  if (error) throw new Error(`seed block failed: ${error.message}`);
}

async function createBooking(
  unitId: string,
  checkInDay: ManilaDay,
  checkOutDay: ManilaDay,
  bookingStatus = "Confirmed"
) {
  const guest = await createTestGuest();
  const { data, error } = await admin.rpc("create_multi_unit_booking", {
    p_booking_data: {
      guest_name: guest.guest_name,
      num_guests: 2,
      booking_status: bookingStatus,
      ...toStayInstants(checkInDay, checkOutDay),
    },
    p_units: [{ unit_id: unitId, unit_price: 3000, subtotal: 3000, assigned_guests: 2 }],
    p_guest_id: guest.guest_id,
  });
  if (error || !data) throw new Error(`seed booking failed: ${error?.message}`);
  bookingIds.push(data);
  return data;
}

async function statesOn(date: ManilaDay, client = roles.byRole.staff) {
  const { data, error } = await client.rpc("get_cabin_states", { p_date: date });
  if (error) throw new Error(`get_cabin_states failed: ${error.message}`);
  return Object.fromEntries(
    data
      .filter((row) => unitIds.includes(row.unit_id))
      .map((row) => [row.unit_id, { state: row.state, block_reason: row.block_reason }])
  );
}

describe("derived cabin state", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("cabin-state");
  }, 60000);

  afterEach(async () => {
    if (!shouldRun) return;
    // Replica mode skips the lock trigger, which refuses deletes of past and running blocks.
    runPsql(
      `SET session_replication_role = replica; DELETE FROM public.availability_blackouts WHERE reason LIKE '${REASON_PREFIX}%';`
    );
    if (bookingIds.length) await admin.from("bookings").delete().in("booking_id", bookingIds);
    bookingIds.length = 0;
    if (unitIds.length) await admin.from("units").delete().in("unit_id", unitIds);
    unitIds.length = 0;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await roles.cleanup();
  });

  it("returns Blocked with the reason, Booked and Free for a date", async () => {
    if (!shouldRun) return;
    const blockedUnit = await newUnit();
    const bookedUnit = await newUnit();
    const freeUnit = await newUnit();
    await addBlock(blockedUnit, "2034-05-10", "2034-05-12", "aircon cleaning");
    await createBooking(bookedUnit, "2034-05-09", "2034-05-12");

    expect(await statesOn("2034-05-11")).toEqual({
      [blockedUnit]: { state: "Blocked", block_reason: `${REASON_PREFIX} aircon cleaning` },
      [bookedUnit]: { state: "Booked", block_reason: null },
      [freeUnit]: { state: "Free", block_reason: null },
    });
  });

  it("a resort closure blocks every cabin", async () => {
    if (!shouldRun) return;
    const unitA = await newUnit();
    const unitB = await newUnit();
    await addBlock(null, "2034-05-11", "2034-05-11", "typhoon closure");

    expect(await statesOn("2034-05-11")).toEqual({
      [unitA]: { state: "Blocked", block_reason: `${REASON_PREFIX} typhoon closure` },
      [unitB]: { state: "Blocked", block_reason: `${REASON_PREFIX} typhoon closure` },
    });
  });

  it("a cabin is Free on its booking's check-out day and Booked on the check-in day", async () => {
    if (!shouldRun) return;
    const unitId = await newUnit();
    await createBooking(unitId, "2034-05-10", "2034-05-12");

    expect((await statesOn("2034-05-10"))[unitId].state).toBe("Booked");
    expect((await statesOn("2034-05-12"))[unitId].state).toBe("Free");
  });

  it("a cancelled booking leaves the cabin Free", async () => {
    if (!shouldRun) return;
    const unitId = await newUnit();
    await createBooking(unitId, "2034-05-10", "2034-05-12", "Cancelled");

    expect((await statesOn("2034-05-10"))[unitId].state).toBe("Free");
  });

  it("does not read the cabin status: a free cabin in Maintenance is Free", async () => {
    if (!shouldRun) return;
    const maintenanceUnit = await newUnit({ unit_status: "Maintenance" });

    expect(await statesOn("2034-05-11")).toEqual({
      [maintenanceUnit]: { state: "Free", block_reason: null },
    });
  });

  it("staff and above can read it; anon cannot", async () => {
    if (!shouldRun) return;
    for (const client of Object.values(roles.byRole)) {
      const { error } = await client.rpc("get_cabin_states", { p_date: "2034-05-11" });
      expect(error).toBeNull();
    }

    const { error } = await roles.anon.rpc("get_cabin_states", { p_date: "2034-05-11" });
    expect(error?.code).toBe("42501");
  });
});
