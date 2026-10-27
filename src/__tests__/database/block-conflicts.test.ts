/**
 * Block conflicts: the conflict RPC, the block save guard, cancel-and-save and
 * the shared unit lock that stops a booking and a block from both committing.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { toStayInstants, type ManilaDay } from "@/lib/bookings/stay";
import type { Database, Json } from "@/types/database.types";

import { runPsql, runPsqlAsync } from "../setup/psql";
import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  testSupabaseAdmin as admin,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
} from "../setup/test-db";

type BookingStatus = Database["public"]["Tables"]["bookings"]["Row"]["booking_status"];

const BLOCK_CONFLICT_CODE = "CNFLT";
const REASON_PREFIX = "dbtest-conflict";

let shouldRun = false;
let roles: RoleClients;
const unitIds: string[] = [];
const bookingIds: string[] = [];

async function newUnit() {
  const unit = await createTestUnit();
  unitIds.push(unit.unit_id);
  return unit;
}

async function createBooking(
  units: string[],
  checkInDay: ManilaDay,
  checkOutDay: ManilaDay,
  status: BookingStatus = "Confirmed"
) {
  const guest = await createTestGuest();
  const { data, error } = await admin.rpc("create_multi_unit_booking", {
    p_booking_data: {
      guest_name: guest.guest_name,
      contact_number: guest.phone_number,
      num_guests: 2,
      booking_status: "Confirmed",
      ...toStayInstants(checkInDay, checkOutDay),
    },
    p_units: units.map((unit_id) => ({
      unit_id,
      unit_price: 3000,
      subtotal: 3000,
      assigned_guests: 2,
    })),
    p_guest_id: guest.guest_id,
  });
  if (error || !data) throw new Error(`seed booking failed: ${error?.message}`);
  bookingIds.push(data);
  if (status !== "Confirmed") {
    const { error: statusError } = await admin
      .from("bookings")
      .update({ booking_status: status })
      .eq("booking_id", data);
    if (statusError) throw new Error(`seed status failed: ${statusError.message}`);
  }
  return data;
}

async function createGuestRequest(checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  const unitTotal = 7000;
  const { data, error } = await admin.rpc("create_guest_booking", {
    p_turnstile_token: "test-token",
    p_booking_data: {
      booking_reference: `TB-CNF-${crypto.randomUUID().slice(0, 8)}`,
      guest_name: "Conflict Test Guest",
      email: "conflict-guest-test@example.com",
      phone_number: "+639171234567",
      ...toStayInstants(checkInDay, checkOutDay),
      total_amount: unitTotal,
      downpayment_required: unitTotal / 2,
      pricing_snapshot: {
        total: unitTotal,
        downpayment_required: unitTotal / 2,
        unit_breakdown: [
          { unit_index: 1, guests: 2, subtotal: unitTotal, extra_person_fees: 0, total: unitTotal },
        ],
      },
      payment_proof_url: "TEMP-test_1.png",
      idempotency_key: crypto.randomUUID(),
    },
    p_unit_requests: [{ guests_per_unit: 2 }],
    p_guest_data: null,
  });
  if (error) throw new Error(`create_guest_booking failed: ${error.message}`);
  const bookingId = (data as { booking: { booking_id: string } }).booking.booking_id;
  bookingIds.push(bookingId);
  return bookingId;
}

async function addBlock(unitId: string | null, firstNight: ManilaDay, lastNight: ManilaDay) {
  const { data, error } = await admin
    .from("availability_blackouts")
    .insert({
      unit_id: unitId,
      start_date: firstNight,
      end_date: lastNight,
      reason: `${REASON_PREFIX} aircon cleaning`,
    })
    .select()
    .single();
  if (error || !data) throw new Error(`seed block failed: ${error?.message}`);
  return data;
}

const conflictsFor = (
  units: string[] | null,
  firstNight: ManilaDay,
  lastNight: ManilaDay,
  blockId?: string
) =>
  roles.byRole.staff.rpc("get_block_conflicts", {
    p_unit_ids: units ?? undefined,
    p_first_night: firstNight,
    p_last_night: lastNight,
    p_block_id: blockId,
  });

describe("block conflicts", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("block-conflicts");
  }, 60000);

  afterEach(async () => {
    if (!shouldRun) return;
    runPsql(
      `SET session_replication_role = replica; DELETE FROM public.availability_blackouts WHERE reason LIKE '${REASON_PREFIX}%';`
    );
    if (bookingIds.length) await admin.from("bookings").delete().in("booking_id", bookingIds);
    bookingIds.length = 0;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    if (unitIds.length) await admin.from("units").delete().in("unit_id", unitIds);
    await roles.cleanup();
  });

  describe("conflict query", () => {
    it("lists Pending, Confirmed and CheckedIn bookings, not CheckedOut or Cancelled", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const byStatus: Record<string, string> = {};
      const statuses: BookingStatus[] = [
        "Pending",
        "Confirmed",
        "CheckedIn",
        "CheckedOut",
        "Cancelled",
      ];
      for (const [index, status] of statuses.entries()) {
        const night = `2033-01-${String(10 + index * 2).padStart(2, "0")}`;
        const nextDay = `2033-01-${String(11 + index * 2).padStart(2, "0")}`;
        byStatus[status!] = await createBooking([unitId], night, nextDay, status);
      }

      const { data, error } = await conflictsFor([unitId], "2033-01-01", "2033-01-31");

      expect(error).toBeNull();
      expect(data?.map((conflict) => conflict.booking_id).sort()).toEqual(
        [byStatus.Pending, byStatus.Confirmed, byStatus.CheckedIn].sort()
      );
    });

    it("a resort closure lists bookings on every cabin and unassigned Pending guest requests", async () => {
      if (!shouldRun) return;
      const firstUnit = await newUnit();
      const secondUnit = await newUnit();
      const onFirst = await createBooking([firstUnit.unit_id], "2033-02-10", "2033-02-12");
      const onSecond = await createBooking([secondUnit.unit_id], "2033-02-11", "2033-02-12");
      const guestRequest = await createGuestRequest("2033-02-11", "2033-02-13");

      const closure = await conflictsFor(null, "2033-02-11", "2033-02-11");
      const closureIds = closure.data?.map((conflict) => conflict.booking_id) ?? [];
      expect(closureIds).toEqual(expect.arrayContaining([onFirst, onSecond, guestRequest]));

      const cabinBlock = await conflictsFor([firstUnit.unit_id], "2033-02-11", "2033-02-11");
      expect(cabinBlock.data?.map((conflict) => conflict.booking_id)).toEqual([onFirst]);
    });

    it("flags partial conflicts with a reason, and checked-in guests", async () => {
      if (!shouldRun) return;
      const blockedUnit = await newUnit();
      const otherUnit = await newUnit();
      const inside = await createBooking([blockedUnit.unit_id], "2033-03-11", "2033-03-13");
      const twoCabins = await createBooking(
        [blockedUnit.unit_id, otherUnit.unit_id],
        "2033-03-13",
        "2033-03-14"
      );
      const longStay = await createBooking(
        [blockedUnit.unit_id],
        "2033-03-14",
        "2033-03-18",
        "CheckedIn"
      );

      const { data } = await conflictsFor([blockedUnit.unit_id], "2033-03-10", "2033-03-15");
      const byId = new Map(data?.map((conflict) => [conflict.booking_id, conflict]));

      expect(byId.get(inside)).toMatchObject({
        is_partial: false,
        partial_reason: null,
        is_checked_in: false,
        booking_status: "Confirmed",
        unit_names: [blockedUnit.unit_name],
      });
      expect(byId.get(twoCabins)).toMatchObject({
        is_partial: true,
        partial_reason: `also uses ${otherUnit.unit_name}`,
        is_checked_in: false,
      });
      expect(byId.get(longStay)).toMatchObject({
        is_partial: true,
        partial_reason: "stays past the block",
        is_checked_in: true,
      });
    });

    it("an edited block counts only the nights it adds", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const block = await addBlock(unitId, "2033-04-10", "2033-04-12");
      const afterBlock = await createBooking([unitId], "2033-04-13", "2033-04-14");

      const shortened = await conflictsFor([unitId], "2033-04-10", "2033-04-11", block.blackout_id);
      expect(shortened.data).toEqual([]);

      const extended = await conflictsFor([unitId], "2033-04-10", "2033-04-13", block.blackout_id);
      expect(extended.data?.map((conflict) => conflict.booking_id)).toEqual([afterBlock]);
    });

    it("staff and above can query conflicts", async () => {
      if (!shouldRun) return;
      for (const client of Object.values(roles.byRole)) {
        const { error } = await client.rpc("get_block_conflicts", {
          p_first_night: "2033-04-10",
          p_last_night: "2033-04-12",
        });
        expect(error).toBeNull();
      }
    });

    it("anon cannot query conflicts", async () => {
      if (!shouldRun) return;
      const { error } = await roles.anon.rpc("get_block_conflicts", {
        p_first_night: "2033-04-10",
        p_last_night: "2033-04-12",
      });
      expect(error).not.toBeNull();
    });
  });

  describe("block save guard", () => {
    const managerBlocks = () => roles.byRole.manager.from("availability_blackouts");

    it("refuses a new cabin block or resort closure over a live booking", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      await createBooking([unitId], "2033-05-10", "2033-05-12");

      const cabinBlock = await managerBlocks().insert({
        unit_id: unitId,
        start_date: "2033-05-11",
        end_date: "2033-05-11",
        reason: `${REASON_PREFIX} cabin`,
      });
      expect(cabinBlock.error?.code).toBe(BLOCK_CONFLICT_CODE);

      const closure = await managerBlocks().insert({
        unit_id: null,
        start_date: "2033-05-11",
        end_date: "2033-05-11",
        reason: `${REASON_PREFIX} closure`,
      });
      expect(closure.error?.code).toBe(BLOCK_CONFLICT_CODE);

      const onCheckOutDay = await managerBlocks().insert({
        unit_id: unitId,
        start_date: "2033-05-12",
        end_date: "2033-05-13",
        reason: `${REASON_PREFIX} after the stay`,
      });
      expect(onCheckOutDay.error).toBeNull();
    });

    it("refuses an edit that adds nights over a booking; shortening always saves", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const block = await addBlock(unitId, "2033-06-10", "2033-06-12");
      await createBooking([unitId], "2033-06-14", "2033-06-15");

      const extended = await managerBlocks()
        .update({ end_date: "2033-06-14" })
        .eq("blackout_id", block.blackout_id);
      expect(extended.error?.code).toBe(BLOCK_CONFLICT_CODE);

      const movedEarlier = await managerBlocks()
        .update({ start_date: "2033-06-08" })
        .eq("blackout_id", block.blackout_id)
        .select();
      expect(movedEarlier.data).toHaveLength(1);

      const shortened = await managerBlocks()
        .update({ end_date: "2033-06-10" })
        .eq("blackout_id", block.blackout_id)
        .select();
      expect(shortened.data).toHaveLength(1);
    });

    it("shortening saves even when a booking sits on the remaining nights", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      await createBooking([unitId], "2033-07-11", "2033-07-12");
      // Rows from before the guard: insert the block without triggers.
      const [blockId] = runPsql(
        `SET session_replication_role = replica; INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason) VALUES ('${unitId}', '2033-07-10', '2033-07-14', '${REASON_PREFIX} legacy') RETURNING blackout_id;`
      ).filter((line) => /^[0-9a-f-]{36}$/.test(line));

      const shortened = await managerBlocks()
        .update({ end_date: "2033-07-12" })
        .eq("blackout_id", blockId!)
        .select();
      expect(shortened.data).toHaveLength(1);
    });
  });

  describe("cancel and save", () => {
    type SaveResult = {
      status: "saved" | "conflicts_changed" | "checked_in";
      conflicts: { booking_id: string }[];
      blocks: { blackout_id: string; unit_id: string | null }[];
    };

    const cancelAndSave = async (
      block: Json,
      confirmedIds: string[],
      client = roles.byRole.manager
    ) => {
      const { data, error } = await client.rpc("cancel_bookings_and_save_block", {
        p_block: block,
        p_booking_ids: confirmedIds,
      });
      return { result: data as SaveResult | null, error };
    };

    const bookingRows = async (ids: string[]) => {
      const { data } = await admin
        .from("bookings")
        .select("booking_id, booking_status, payment_status")
        .in("booking_id", ids);
      return new Map(data?.map((row) => [row.booking_id, row]));
    };

    const blocksOn = async (unitId: string) => {
      const { data } = await admin
        .from("availability_blackouts")
        .select("blackout_id, start_date, end_date")
        .eq("unit_id", unitId);
      return data ?? [];
    };

    it("cancels the confirmed bookings and writes the block in one go", async () => {
      if (!shouldRun) return;
      const blockedUnit = await newUnit();
      const otherUnit = await newUnit();
      const single = await createBooking([blockedUnit.unit_id], "2033-09-10", "2033-09-12");
      const twoCabins = await createBooking(
        [blockedUnit.unit_id, otherUnit.unit_id],
        "2033-09-12",
        "2033-09-14"
      );
      await admin.from("payments").insert({ booking_id: single, amount: 1000, status: "Active" });
      const before = await bookingRows([single, twoCabins]);

      const { result, error } = await cancelAndSave(
        {
          unit_ids: [blockedUnit.unit_id],
          start_date: "2033-09-10",
          end_date: "2033-09-13",
          reason: `${REASON_PREFIX} roof repair`,
        },
        [single, twoCabins]
      );

      expect(error).toBeNull();
      expect(result?.status).toBe("saved");
      expect(result?.blocks.map((block) => block.unit_id)).toEqual([blockedUnit.unit_id]);
      const after = await bookingRows([single, twoCabins]);
      for (const id of [single, twoCabins]) {
        expect(after.get(id)?.booking_status).toBe("Cancelled");
        expect(after.get(id)?.payment_status).toBe(before.get(id)?.payment_status);
      }
      expect(before.get(single)?.payment_status).toBe("Partial");
      const { data: otherCabinNights } = await admin
        .from("booking_unit_availability")
        .select("booking_status")
        .eq("unit_id", otherUnit.unit_id);
      expect(otherCabinNights).toEqual([{ booking_status: "Cancelled" }]);
      expect(await blocksOn(blockedUnit.unit_id)).toHaveLength(1);
    });

    it("extends an existing block after cancelling the bookings on the added nights", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const block = await addBlock(unitId, "2033-10-10", "2033-10-11");
      const onAddedNight = await createBooking([unitId], "2033-10-12", "2033-10-13");

      const { result } = await cancelAndSave(
        { blackout_id: block.blackout_id, end_date: "2033-10-12" },
        [onAddedNight]
      );

      expect(result?.status).toBe("saved");
      expect((await bookingRows([onAddedNight])).get(onAddedNight)?.booking_status).toBe(
        "Cancelled"
      );
      expect(await blocksOn(unitId)).toMatchObject([
        { start_date: "2033-10-10", end_date: "2033-10-12" },
      ]);
    });

    it("saves nothing and returns the new list when the conflicts changed", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const seen = await createBooking([unitId], "2033-11-10", "2033-11-11");
      const addedSince = await createBooking([unitId], "2033-11-11", "2033-11-12");

      const { result } = await cancelAndSave(
        {
          unit_ids: [unitId],
          start_date: "2033-11-10",
          end_date: "2033-11-11",
          reason: `${REASON_PREFIX} changed`,
        },
        [seen]
      );

      expect(result?.status).toBe("conflicts_changed");
      expect(result?.conflicts.map((conflict) => conflict.booking_id)).toEqual([seen, addedSince]);
      const rows = await bookingRows([seen, addedSince]);
      expect([...rows.values()].map((row) => row.booking_status)).toEqual([
        "Confirmed",
        "Confirmed",
      ]);
      expect(await blocksOn(unitId)).toEqual([]);
    });

    it("refuses when a conflicting guest is checked in", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const checkedIn = await createBooking([unitId], "2033-12-10", "2033-12-12", "CheckedIn");

      const { result } = await cancelAndSave(
        {
          unit_ids: [unitId],
          start_date: "2033-12-11",
          end_date: "2033-12-11",
          reason: `${REASON_PREFIX} checked in`,
        },
        [checkedIn]
      );

      expect(result?.status).toBe("checked_in");
      expect((await bookingRows([checkedIn])).get(checkedIn)?.booking_status).toBe("CheckedIn");
      expect(await blocksOn(unitId)).toEqual([]);
    });

    it("refuses staff", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const booking = await createBooking([unitId], "2034-01-10", "2034-01-11");

      const { error } = await cancelAndSave(
        {
          unit_ids: [unitId],
          start_date: "2034-01-10",
          end_date: "2034-01-10",
          reason: `${REASON_PREFIX} staff`,
        },
        [booking],
        roles.byRole.staff
      );

      expect(error?.code).toBe("42501");
      expect((await bookingRows([booking])).get(booking)?.booking_status).toBe("Confirmed");
    });

    it("the audit trail shows the cancels and the block together", async () => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const booking = await createBooking([unitId], "2034-02-10", "2034-02-11");

      const { result } = await cancelAndSave(
        {
          unit_ids: [unitId],
          start_date: "2034-02-10",
          end_date: "2034-02-10",
          reason: `${REASON_PREFIX} audit`,
        },
        [booking]
      );
      const blockId = result!.blocks[0]!.blackout_id;

      const { data: logs } = await admin
        .from("audit_logs")
        .select("table_name, action, record_id, user_id, created_at, new_data")
        .in("record_id", [booking, blockId])
        .in("table_name", ["bookings", "availability_blackouts"])
        .in("action", ["UPDATE", "INSERT"]);
      const cancel = logs?.find(
        (log) =>
          log.table_name === "bookings" &&
          (log.new_data as { booking_status?: string })?.booking_status === "Cancelled"
      );
      const blockInsert = logs?.find((log) => log.table_name === "availability_blackouts");
      const { data: manager } = await roles.byRole.manager.auth.getUser();

      expect(cancel?.user_id).toBe(manager.user?.id);
      expect(blockInsert?.user_id).toBe(manager.user?.id);
      expect(cancel?.created_at).toBe(blockInsert?.created_at);
    });
  });

  describe("write skew", () => {
    const blockSql = (unitId: string) =>
      `INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason) VALUES ('${unitId}', '2033-08-10', '2033-08-10', '${REASON_PREFIX} race');`;

    const bookingSql = (unitId: string) => {
      const stay = JSON.stringify({
        guest_name: "Race Guest",
        num_guests: 2,
        booking_status: "Confirmed",
        internal_notes: REASON_PREFIX,
        ...toStayInstants("2033-08-10", "2033-08-11"),
      });
      const unit = JSON.stringify({
        unit_id: unitId,
        unit_price: 3000,
        subtotal: 3000,
        assigned_guests: 2,
      });
      return `SELECT public.create_multi_unit_booking('${stay}'::jsonb, ARRAY['${unit}'::jsonb]);`;
    };

    const refusals = {
      block: "Bookings use these nights",
      booking: "The cabin is blocked",
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
      runPsql(`DELETE FROM public.bookings WHERE internal_notes = '${REASON_PREFIX}';`);
    });

    it.each([
      ["a block, then a booking", "block"],
      ["a booking, then a block", "booking"],
    ] as const)("%s on the same cabin and night cannot both commit", async (_, firstWrite) => {
      if (!shouldRun) return;
      const { unit_id: unitId } = await newUnit();
      const writes = { block: blockSql(unitId), booking: bookingSql(unitId) };
      const secondWrite = firstWrite === "block" ? "booking" : "block";

      const [first, second] = await race(writes[firstWrite], writes[secondWrite]);

      expect(first.status).toBe("fulfilled");
      expect(second.status).toBe("rejected");
      expect(String((second as PromiseRejectedResult).reason)).toContain(refusals[secondWrite]);
      const [blocks] = runPsql(
        `SELECT count(*) FROM public.availability_blackouts WHERE unit_id = '${unitId}'`
      );
      const [bookings] = runPsql(
        `SELECT count(*) FROM public.booking_unit_availability WHERE unit_id = '${unitId}'`
      );
      expect({ blocks, bookings }).toEqual(
        firstWrite === "block" ? { blocks: "1", bookings: "0" } : { blocks: "0", bookings: "1" }
      );
    });
  });
});
