/**
 * Availability reads honour blocks: the admin availability check, the public
 * guest calendar counts and the guest request step. None of them read unit_status.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { createClient } from "@supabase/supabase-js";
import { addDays, format, parseISO } from "date-fns";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { toStayInstants, type ManilaDay } from "@/lib/bookings/stay";
import type { Database } from "@/types/database.types";

import { runPsql, runPsqlAsync } from "../setup/psql";
import {
  testSupabaseAdmin as admin,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
} from "../setup/test-db";

const REASON_PREFIX = "dbtest-availability";

let shouldRun = false;
// From the database clock: the public calendar refuses dates over a year ahead.
let manilaToday: ManilaDay;
const unitIds: string[] = [];
const bookingIds: string[] = [];

async function newUnit(overrides: Parameters<typeof createTestUnit>[0] = {}) {
  const unit = await createTestUnit(overrides);
  unitIds.push(unit.unit_id);
  return unit.unit_id;
}

async function addBlock(unitId: string | null, firstNight: ManilaDay, lastNight: ManilaDay) {
  const { error } = await admin.from("availability_blackouts").insert({
    unit_id: unitId,
    start_date: firstNight,
    end_date: lastNight,
    reason: `${REASON_PREFIX} aircon cleaning`,
  });
  if (error) throw new Error(`seed block failed: ${error.message}`);
}

async function createBooking(unitId: string, checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  const guest = await createTestGuest();
  const { data, error } = await admin.rpc("create_multi_unit_booking", {
    p_booking_data: {
      guest_name: guest.guest_name,
      num_guests: 2,
      booking_status: "Confirmed",
      ...toStayInstants(checkInDay, checkOutDay),
    },
    p_units: [{ unit_id: unitId, unit_price: 3000, subtotal: 3000, assigned_guests: 2 }],
    p_guest_id: guest.guest_id,
  });
  if (error || !data) throw new Error(`seed booking failed: ${error?.message}`);
  bookingIds.push(data);
  return data;
}

function createGuestRequest(cabins: number, checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  const unitTotal = 7000;
  return admin
    .rpc("create_guest_booking", {
      p_turnstile_token: "test-token",
      p_booking_data: {
        booking_reference: `TB-AVL-${crypto.randomUUID().slice(0, 8)}`,
        guest_name: "Availability Test Guest",
        email: "availability-guest-test@example.com",
        phone_number: "+639171234567",
        ...toStayInstants(checkInDay, checkOutDay),
        total_amount: unitTotal * cabins,
        downpayment_required: (unitTotal * cabins) / 2,
        pricing_snapshot: { total: unitTotal * cabins },
        idempotency_key: crypto.randomUUID(),
      },
      p_unit_requests: Array.from({ length: cabins }, () => ({ guests_per_unit: 2 })),
      p_guest_data: null,
    })
    .then(({ data, error }) => {
      if (data) bookingIds.push((data as { booking: { booking_id: string } }).booking.booking_id);
      return { error };
    });
}

// Cabin blocks on every unit but one, so one unblocked cabin is left on these nights.
function blockAllUnitsBut(spareUnitId: string, firstNight: ManilaDay, lastNight: ManilaDay) {
  runPsql(
    `INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason)
     SELECT unit_id, '${firstNight}', '${lastNight}', '${REASON_PREFIX} all but one'
     FROM public.units WHERE unit_id <> '${spareUnitId}';`
  );
}

const plusDays = (day: ManilaDay, days: number): ManilaDay =>
  format(addDays(parseISO(day), days), "yyyy-MM-dd");

const anon = createClient<Database>(
  process.env.TEST_SUPABASE_URL!,
  process.env.TEST_SUPABASE_ANON_KEY!
);

async function publicCounts(firstDay: ManilaDay, lastDay: ManilaDay) {
  const { data, error } = await anon.rpc("get_public_aggregate_availability", {
    p_start_date: firstDay,
    p_end_date: lastDay,
  });
  if (error) throw new Error(`public availability failed: ${error.message}`);
  return Object.fromEntries(data.map((day) => [day.date, day.available_count]));
}

const checkAvailability = (unitIds: string[], checkInDay: ManilaDay, checkOutDay: ManilaDay) => {
  const stay = toStayInstants(checkInDay, checkOutDay);
  return admin.rpc("check_multi_unit_availability", {
    p_unit_ids: unitIds,
    p_check_in: stay.check_in,
    p_check_out: stay.check_out,
  });
};

describe("availability reads honour blocks", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    [manilaToday] = runPsql("SELECT (now() AT TIME ZONE 'Asia/Manila')::date");
  }, 60000);

  afterEach(async () => {
    if (!shouldRun) return;
    // Replica mode skips the lock trigger, which refuses deletes of past and running blocks.
    runPsql(
      `SET session_replication_role = replica; DELETE FROM public.availability_blackouts WHERE reason LIKE '${REASON_PREFIX}%';`
    );
    if (bookingIds.length) await admin.from("bookings").delete().in("booking_id", bookingIds);
    bookingIds.length = 0;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    if (unitIds.length) await admin.from("units").delete().in("unit_id", unitIds);
  });

  describe("check_multi_unit_availability", () => {
    it("returns a blocked cabin as unavailable with reason Blocked, a booked one as Booked", async () => {
      if (!shouldRun) return;
      const blockedUnit = await newUnit();
      const bookedUnit = await newUnit();
      const freeUnit = await newUnit();
      await addBlock(blockedUnit, "2034-03-11", "2034-03-11");
      await createBooking(bookedUnit, "2034-03-10", "2034-03-12");

      const { data, error } = await checkAvailability(
        [blockedUnit, bookedUnit, freeUnit],
        "2034-03-10",
        "2034-03-12"
      );

      expect(error).toBeNull();
      const byUnit = Object.fromEntries(
        data!.map((row) => [row.unit_id, { is_available: row.is_available, reason: row.reason }])
      );
      expect(byUnit).toEqual({
        [blockedUnit]: { is_available: false, reason: "Blocked" },
        [bookedUnit]: { is_available: false, reason: "Booked" },
        [freeUnit]: { is_available: true, reason: null },
      });
    });

    it("does not read the cabin status: a free cabin in Maintenance is available", async () => {
      if (!shouldRun) return;
      const maintenanceUnit = await newUnit({ unit_status: "Maintenance" });

      const { data } = await checkAvailability([maintenanceUnit], "2034-03-10", "2034-03-12");

      expect(data).toMatchObject([{ unit_id: maintenanceUnit, is_available: true, reason: null }]);
    });
  });

  describe("get_public_aggregate_availability", () => {
    it("anon gets one fewer cabin on each blocked night, including the last one", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      const first = plusDays(manilaToday, 200);
      const nights = [first, plusDays(first, 1), plusDays(first, 2), plusDays(first, 3)];
      const before = await publicCounts(nights[0], nights[3]);

      await addBlock(unitId, nights[1], nights[2]);
      const after = await publicCounts(nights[0], nights[3]);

      expect(nights.map((night) => before[night] - after[night])).toEqual([0, 1, 1, 0]);
    });

    it("a resort closure gives 0 on its nights", async () => {
      if (!shouldRun) return;
      const first = plusDays(manilaToday, 210);
      await addBlock(null, first, plusDays(first, 1));

      const counts = await publicCounts(first, plusDays(first, 2));

      expect(counts[first]).toBe(0);
      expect(counts[plusDays(first, 1)]).toBe(0);
      expect(counts[plusDays(first, 2)]).toBeGreaterThan(0);
    });

    it("counts every cabin, booked ones off, whatever the cabin status", async () => {
      if (!shouldRun) return;
      const night = plusDays(manilaToday, 220);
      const before = await publicCounts(night, night);

      const maintenanceUnit = await newUnit({ unit_status: "Maintenance" });
      const withMaintenanceUnit = await publicCounts(night, night);
      await createBooking(maintenanceUnit, night, plusDays(night, 1));
      const withItBooked = await publicCounts(night, night);

      expect(withMaintenanceUnit[night] - before[night]).toBe(1);
      expect(withItBooked[night]).toBe(before[night]);
    });

    it("returns the total cabin count with each day", async () => {
      if (!shouldRun) return;
      const [unitCount] = runPsql("SELECT count(*) FROM public.units");
      const night = plusDays(manilaToday, 230);

      const { data } = await anon.rpc("get_public_aggregate_availability", {
        p_start_date: night,
        p_end_date: night,
      });

      expect(data).toMatchObject([{ date: night, total_units: Number(unitCount) }]);
    });
  });

  describe("create_guest_booking", () => {
    const UNAVAILABLE_CODE = "BLOCK";

    it("refuses a request over a resort closure night", async () => {
      if (!shouldRun) return;
      await addBlock(null, "2035-04-12", "2035-04-12");

      const { error } = await createGuestRequest(1, "2035-04-10", "2035-04-13");

      expect(error?.code).toBe(UNAVAILABLE_CODE);
    });

    it("refuses more cabins than are unblocked on a night, by unblocked count, not bookings", async () => {
      if (!shouldRun) return;
      // The one unblocked cabin is in Maintenance and booked: neither counts against it.
      const spareUnit = await newUnit({ unit_status: "Maintenance" });
      blockAllUnitsBut(spareUnit, "2035-05-11", "2035-05-11");
      await createBooking(spareUnit, "2035-05-10", "2035-05-12");

      const twoCabins = await createGuestRequest(2, "2035-05-10", "2035-05-12");
      const oneCabin = await createGuestRequest(1, "2035-05-10", "2035-05-12");

      expect(twoCabins.error?.code).toBe(UNAVAILABLE_CODE);
      expect(oneCabin.error).toBeNull();
    });

    it("lets a request check out on a closure's first night", async () => {
      if (!shouldRun) return;
      await addBlock(null, "2035-06-12", "2035-06-14");

      const { error } = await createGuestRequest(1, "2035-06-10", "2035-06-12");

      expect(error).toBeNull();
    });
  });

  describe("write skew", () => {
    const RACE_REFERENCE = "TB-AVL-RACE";

    const closureSql = `INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason) VALUES (NULL, '2035-08-10', '2035-08-10', '${REASON_PREFIX} race');`;

    const guestRequestSql = () => {
      const booking = JSON.stringify({
        booking_reference: RACE_REFERENCE,
        guest_name: "Race Guest",
        email: "availability-race-test@example.com",
        phone_number: "+639171234567",
        total_amount: 7000,
        downpayment_required: 3500,
        ...toStayInstants("2035-08-10", "2035-08-11"),
      });
      return `SELECT public.create_guest_booking('test-token', '${booking}'::jsonb, '[{"guests_per_unit": 2}]'::jsonb);`;
    };

    const refusals = {
      closure: "Bookings use these nights",
      request: "Not enough cabins are free",
    };

    // The first transaction holds its write open; the second starts while it waits.
    async function race(firstSql: string, secondSql: string) {
      const first = Promise.allSettled([
        runPsqlAsync(`BEGIN; ${firstSql} SELECT pg_sleep(1.5); COMMIT;`),
      ]);
      await new Promise((resolve) => setTimeout(resolve, 400));
      const second = Promise.allSettled([runPsqlAsync(`BEGIN; ${secondSql} COMMIT;`)]);
      return [(await first)[0], (await second)[0]];
    }

    afterEach(() => {
      if (!shouldRun) return;
      runPsql(`DELETE FROM public.bookings WHERE booking_reference = '${RACE_REFERENCE}';`);
    });

    it.each([
      ["a resort closure, then a guest request", "closure"],
      ["a guest request, then a resort closure", "request"],
    ] as const)("%s on the same night cannot both commit", async (_, firstWrite) => {
      if (!shouldRun) return;
      const writes = { closure: closureSql, request: guestRequestSql() };
      const secondWrite = firstWrite === "closure" ? "request" : "closure";

      const [first, second] = await race(writes[firstWrite], writes[secondWrite]);

      expect(first.status).toBe("fulfilled");
      expect(second.status).toBe("rejected");
      expect(String((second as PromiseRejectedResult).reason)).toContain(refusals[secondWrite]);
    });
  });
});
