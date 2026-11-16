/**
 * update_booking_stay saves a booking's dates and cabins in one transaction, under
 * the stay rules of ADR 0007: Confirmed dates are manager-only, a CheckedIn stay is
 * manager-only with the check-in day locked, and CheckedOut, Cancelled and anonymized
 * bookings allow no stay change. The total changes only when a manager asks for a
 * recompute, and never on an Airbnb booking (ADR 0006).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { toStayInstants, type ManilaDay } from "@/lib/bookings";
import type { AppRoleName } from "@/types/app-role";
import type { BookingStatus } from "@/types/booking-status";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestBooking,
  createTestUnit,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let roleClients: RoleClients;
let shouldRun = false;

type Status = BookingStatus | "Anonymized";
type Cabin = { unit_id: string; assigned_guests: number };

async function bookingIn(status: Status, checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  const stay = toStayInstants(checkInDay, checkOutDay);
  const booking = await createTestBooking({
    booking_status: status === "Anonymized" ? "CheckedOut" : status,
    check_in: new Date(stay.check_in),
    check_out: new Date(stay.check_out),
  });
  if (status === "Anonymized") {
    const { error } = await service
      .from("bookings")
      .update({ anonymized_at: new Date().toISOString() })
      .eq("booking_id", booking.booking_id);
    if (error) throw error;
  }
  return { bookingId: booking.booking_id, unitId: booking.booking_units[0].unit_id };
}

const saveStayAs = (
  role: AppRoleName,
  bookingId: string,
  checkInDay: ManilaDay,
  checkOutDay: ManilaDay,
  cabins: Cabin[]
) => {
  const stay = toStayInstants(checkInDay, checkOutDay);
  return roleClients.byRole[role].rpc("update_booking_stay", {
    p_booking_id: bookingId,
    p_check_in: stay.check_in,
    p_check_out: stay.check_out,
    p_units: cabins,
  });
};

async function stayOf(bookingId: string) {
  const { data, error } = await service
    .from("bookings")
    .select(
      "check_in, check_out, num_guests, total_amount, booking_units(unit_id, assigned_guests), booking_unit_availability(unit_id, check_in, check_out)"
    )
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  const byUnit = (a: { unit_id: string }, b: { unit_id: string }) =>
    a.unit_id.localeCompare(b.unit_id);
  return {
    ...data,
    booking_units: data.booking_units.sort(byUnit),
    booking_unit_availability: data.booking_unit_availability.sort(byUnit),
  };
}

describe("update_booking_stay", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("stay-edit");
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("saves the dates and swaps the cabins together, with the total unchanged", async () => {
    if (!shouldRun) return;
    const { bookingId } = await bookingIn("Pending", "2034-01-10", "2034-01-12");
    const [second, third] = await Promise.all([createTestUnit(), createTestUnit()]);

    const { error } = await saveStayAs("staff", bookingId, "2034-01-11", "2034-01-14", [
      { unit_id: second.unit_id, assigned_guests: 3 },
      { unit_id: third.unit_id, assigned_guests: 1 },
    ]);

    expect(error).toBeNull();
    const stay = toStayInstants("2034-01-11", "2034-01-14");
    const saved = await stayOf(bookingId);
    expect(new Date(saved.check_in).toISOString()).toBe(stay.check_in);
    expect(new Date(saved.check_out).toISOString()).toBe(stay.check_out);
    expect(saved.num_guests).toBe(4);
    expect(saved.total_amount).toBe(5000);
    expect(saved.booking_units).toEqual(
      [
        { unit_id: second.unit_id, assigned_guests: 3 },
        { unit_id: third.unit_id, assigned_guests: 1 },
      ].sort((a, b) => a.unit_id.localeCompare(b.unit_id))
    );
    expect(
      saved.booking_unit_availability.map((row) => ({
        unit_id: row.unit_id,
        check_in: new Date(row.check_in).toISOString(),
        check_out: new Date(row.check_out).toISOString(),
      }))
    ).toEqual([second.unit_id, third.unit_id].sort().map((unit_id) => ({ unit_id, ...stay })));
  });

  it("keeps a cabin that stays, changing only its guest count", async () => {
    if (!shouldRun) return;
    const { bookingId, unitId } = await bookingIn("Confirmed", "2034-02-10", "2034-02-12");

    const { error } = await saveStayAs("staff", bookingId, "2034-02-10", "2034-02-12", [
      { unit_id: unitId, assigned_guests: 3 },
    ]);

    expect(error).toBeNull();
    const saved = await stayOf(bookingId);
    expect(saved.booking_units).toEqual([{ unit_id: unitId, assigned_guests: 3 }]);
    expect(saved.booking_unit_availability.map((row) => row.unit_id)).toEqual([unitId]);
    expect(saved.total_amount).toBe(5000);
  });

  it("refuses an empty cabin list", async () => {
    if (!shouldRun) return;
    const { bookingId } = await bookingIn("Pending", "2034-03-10", "2034-03-12");
    const before = await stayOf(bookingId);

    const { error } = await saveStayAs("manager", bookingId, "2034-03-10", "2034-03-12", []);

    expect(error?.code).toBe("22023");
    expect(await stayOf(bookingId)).toEqual(before);
  });

  it("refuses a cabin with no guest count", async () => {
    if (!shouldRun) return;
    const { bookingId, unitId } = await bookingIn("Pending", "2034-03-20", "2034-03-22");
    const before = await stayOf(bookingId);

    const stay = toStayInstants("2034-03-20", "2034-03-22");
    const { error } = await roleClients.byRole.staff.rpc("update_booking_stay", {
      p_booking_id: bookingId,
      p_check_in: stay.check_in,
      p_check_out: stay.check_out,
      p_units: [{ unit_id: unitId }],
    });

    expect(error?.code).toBe("22023");
    expect(await stayOf(bookingId)).toEqual(before);
  });

  it("refuses a cabin another confirmed booking holds on those nights", async () => {
    if (!shouldRun) return;
    const { unitId: takenUnit } = await bookingIn("Confirmed", "2034-04-10", "2034-04-12");
    const { bookingId, unitId } = await bookingIn("Confirmed", "2034-04-10", "2034-04-12");
    const before = await stayOf(bookingId);

    const { error } = await saveStayAs("staff", bookingId, "2034-04-10", "2034-04-12", [
      { unit_id: unitId, assigned_guests: 2 },
      { unit_id: takenUnit, assigned_guests: 2 },
    ]);

    expect(error?.code).toBe("23P01");
    expect(await stayOf(bookingId)).toEqual(before);
  });

  it("refuses a cabin that is blocked on one of the nights", async () => {
    if (!shouldRun) return;
    const { bookingId, unitId } = await bookingIn("Confirmed", "2034-05-10", "2034-05-12");
    const blocked = await createTestUnit();
    const { error: blockError } = await service.from("availability_blackouts").insert({
      unit_id: blocked.unit_id,
      start_date: "2034-05-11",
      end_date: "2034-05-11",
      reason: "Test block for stay edit",
    });
    if (blockError) throw blockError;
    const before = await stayOf(bookingId);

    const { error } = await saveStayAs("staff", bookingId, "2034-05-10", "2034-05-12", [
      { unit_id: unitId, assigned_guests: 2 },
      { unit_id: blocked.unit_id, assigned_guests: 2 },
    ]);

    await service.from("availability_blackouts").delete().eq("unit_id", blocked.unit_id);
    expect(error?.code).toBe("BLOCK");
    expect(await stayOf(bookingId)).toEqual(before);
  });

  type Change = "cabins" | "check-out" | "check-in";

  // Each change starts from a 2034-06-10 → 2034-06-12 stay
  const CHANGES: Record<Change, { days: [ManilaDay, ManilaDay]; addCabin: boolean }> = {
    cabins: { days: ["2034-06-10", "2034-06-12"], addCabin: true },
    "check-out": { days: ["2034-06-10", "2034-06-13"], addCabin: false },
    "check-in": { days: ["2034-06-09", "2034-06-12"], addCabin: false },
  };

  function allowed(status: Status, change: Change, role: AppRoleName) {
    const manager = role !== "staff";
    if (status === "Pending") return true;
    if (status === "Confirmed") return change === "cabins" || manager;
    if (status === "CheckedIn") return manager && change !== "check-in";
    return false;
  }

  const statuses = [
    "Pending",
    "Confirmed",
    "CheckedIn",
    "CheckedOut",
    "Cancelled",
    "Anonymized",
  ] as const;

  describe.each(statuses)("a %s booking", (status) => {
    it.each(["staff", "manager"] as const)(
      "lets %s change only what the status allows",
      async (role) => {
        if (!shouldRun) return;
        for (const change of Object.keys(CHANGES) as Change[]) {
          const { bookingId, unitId } = await bookingIn(status, "2034-06-10", "2034-06-12");
          const extra = await createTestUnit();
          const { days, addCabin } = CHANGES[change];
          const cabins = [
            { unit_id: unitId, assigned_guests: 2 },
            ...(addCabin ? [{ unit_id: extra.unit_id, assigned_guests: 1 }] : []),
          ];
          const before = await stayOf(bookingId);

          const { error } = await saveStayAs(role, bookingId, days[0], days[1], cabins);

          if (allowed(status, change, role)) {
            expect(error, `${role} changes the ${change}`).toBeNull();
            expect(await stayOf(bookingId), `${role} changes the ${change}`).not.toEqual(before);
          } else {
            expect(error?.code, `${role} changes the ${change}`).toBe("42501");
            expect(await stayOf(bookingId)).toEqual(before);
          }
        }
      }
    );
  });

  it.each(["CheckedOut", "Cancelled", "Anonymized"] as const)(
    "refuses a direct cabin or stay write on a %s booking",
    async (status) => {
      if (!shouldRun) return;
      const { bookingId } = await bookingIn(status, "2034-07-10", "2034-07-12");
      const extra = await createTestUnit();
      const admin = roleClients.byRole.admin;

      const added = await admin.from("booking_units").insert({
        booking_id: bookingId,
        unit_id: extra.unit_id,
        unit_price: 0,
        subtotal: 0,
        assigned_guests: 1,
      });
      const moved = await admin
        .from("bookings")
        .update(toStayInstants("2034-07-10", "2034-07-13"))
        .eq("booking_id", bookingId);

      expect(added.error?.code).toBe("42501");
      expect(moved.error?.code).toBe("42501");
    }
  );

  it.each(["Cancelled", "Anonymized"] as const)(
    "refuses a guest count or payment method change on a %s booking",
    async (status) => {
      if (!shouldRun) return;
      const { bookingId } = await bookingIn(status, "2034-08-10", "2034-08-12");

      const { error } = await roleClients.byRole.admin
        .from("bookings")
        .update({ num_guests: 5, payment_method: "GCash" })
        .eq("booking_id", bookingId);

      expect(error?.code).toBe("42501");
    }
  );

  describe("recompute of the total", () => {
    const pricedCabin = (unit_id: string, subtotal: number) => ({
      unit_id,
      assigned_guests: 2,
      unit_price: subtotal - 500,
      weekend_surcharge: 500,
      extra_person_charge: 0,
      subtotal,
    });

    const recomputeAs = (role: AppRoleName, bookingId: string, cabins: Cabin[]) => {
      const stay = toStayInstants("2034-09-10", "2034-09-13");
      return roleClients.byRole[role].rpc("update_booking_stay", {
        p_booking_id: bookingId,
        p_check_in: stay.check_in,
        p_check_out: stay.check_out,
        p_units: cabins,
        p_recompute: true,
      });
    };

    it("keeps the total when the stay changes without a recompute", async () => {
      if (!shouldRun) return;
      const { bookingId, unitId } = await bookingIn("Pending", "2034-09-10", "2034-09-12");

      const { error } = await saveStayAs("manager", bookingId, "2034-09-10", "2034-09-13", [
        pricedCabin(unitId, 7500),
      ]);

      expect(error).toBeNull();
      expect((await stayOf(bookingId)).total_amount).toBe(5000);
    });

    it("sets each cabin's price and the total when a manager asks", async () => {
      if (!shouldRun) return;
      const { bookingId, unitId } = await bookingIn("Pending", "2034-09-10", "2034-09-12");
      const extra = await createTestUnit();

      const { error } = await recomputeAs("manager", bookingId, [
        pricedCabin(unitId, 7500),
        pricedCabin(extra.unit_id, 6000),
      ]);

      expect(error).toBeNull();
      expect((await stayOf(bookingId)).total_amount).toBe(13500);
      const { data } = await service
        .from("booking_units")
        .select("unit_price, weekend_surcharge, subtotal")
        .eq("booking_id", bookingId)
        .order("subtotal");
      expect(data).toEqual([
        { unit_price: 5500, weekend_surcharge: 500, subtotal: 6000 },
        { unit_price: 7000, weekend_surcharge: 500, subtotal: 7500 },
      ]);
    });

    it("refuses a recompute from staff", async () => {
      if (!shouldRun) return;
      const { bookingId, unitId } = await bookingIn("Pending", "2034-09-10", "2034-09-12");
      const before = await stayOf(bookingId);

      const { error } = await recomputeAs("staff", bookingId, [pricedCabin(unitId, 7500)]);

      expect(error?.code).toBe("42501");
      expect(await stayOf(bookingId)).toEqual(before);
    });

    it("refuses a recompute on an Airbnb booking", async () => {
      if (!shouldRun) return;
      const { bookingId, unitId } = await bookingIn("Pending", "2034-09-10", "2034-09-12");
      const { error: sourceError } = await service
        .from("bookings")
        .update({ booking_source: "Airbnb" })
        .eq("booking_id", bookingId);
      if (sourceError) throw sourceError;
      const before = await stayOf(bookingId);

      const { error } = await recomputeAs("manager", bookingId, [pricedCabin(unitId, 7500)]);

      expect(error?.code).toBe("42501");
      expect(await stayOf(bookingId)).toEqual(before);
    });

    it("refuses a recompute with a cabin that has no price", async () => {
      if (!shouldRun) return;
      const { bookingId, unitId } = await bookingIn("Pending", "2034-09-10", "2034-09-12");
      const before = await stayOf(bookingId);

      const { error } = await recomputeAs("manager", bookingId, [
        { unit_id: unitId, assigned_guests: 2 },
      ]);

      expect(error?.code).toBe("22023");
      expect(await stayOf(bookingId)).toEqual(before);
    });
  });
});
