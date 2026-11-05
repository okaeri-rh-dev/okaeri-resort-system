/**
 * Blocks (availability_blackouts): the block rules, RLS per role, the past and
 * running locks, and the booking guard on every booking path.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { addDays, format, parseISO } from "date-fns";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { toStayInstants, type ManilaDay } from "@/lib/bookings/stay";
import { db, supabase } from "@/lib/supabase";
import type { TablesUpdate } from "@/types/database.types";

import { runPsql } from "../setup/psql";
import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  testSupabaseAdmin as admin,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
} from "../setup/test-db";

// The global test setup mocks the app client; the helper tests use the real one.
vi.unmock("@/lib/supabase");
vi.hoisted(() => {
  process.env.VITE_SUPABASE_URL = process.env.TEST_SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
});

const BLOCKED_NIGHT_CODE = "BLOCK";
const LOCKED_BLOCK_CODE = "55000";
const REASON_PREFIX = "dbtest-block";

let shouldRun = false;
let roles: RoleClients;
// From the database clock: src/test/setup.ts pins Date.now() to 2025.
let manilaToday: ManilaDay;
const unitIds: string[] = [];
const bookingIds: string[] = [];

const plusDays = (day: ManilaDay, days: number): ManilaDay =>
  format(addDays(parseISO(day), days), "yyyy-MM-dd");

async function newUnit() {
  const unit = await createTestUnit();
  unitIds.push(unit.unit_id);
  return unit.unit_id;
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

// Booking create and unit assignment run as the service role, like the Workers do.
async function createBooking(unitIds: string[], checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  const guest = await createTestGuest();
  const { data, error } = await admin.rpc("create_multi_unit_booking", {
    p_booking_data: {
      guest_name: guest.guest_name,
      contact_number: guest.phone_number,
      num_guests: 2,
      booking_status: "Confirmed",
      ...toStayInstants(checkInDay, checkOutDay),
    },
    p_units: unitIds.map((unit_id) => ({
      unit_id,
      unit_price: 3000,
      subtotal: 3000,
      assigned_guests: 2,
    })),
    p_guest_id: guest.guest_id,
  });
  if (data) bookingIds.push(data);
  return { bookingId: data, error };
}

async function createGuestRequest(checkInDay: ManilaDay, checkOutDay: ManilaDay) {
  const unitTotal = 7000;
  const { data, error } = await admin.rpc("create_guest_booking", {
    p_turnstile_token: "test-token",
    p_booking_data: {
      booking_reference: `TB-BLK-${crypto.randomUUID().slice(0, 8)}`,
      guest_name: "Block Test Guest",
      email: "block-guest-test@example.com",
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

  const { error: paymentError } = await admin
    .from("payments")
    .insert({ booking_id: bookingId, amount: unitTotal / 2, status: "Active" });
  if (paymentError) throw new Error(`downpayment failed: ${paymentError.message}`);
  return bookingId;
}

const assignUnits = (bookingId: string, unitId: string) =>
  admin.rpc("assign_units_to_booking", { p_booking_id: bookingId, p_unit_ids: [unitId] });

describe("blocks", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("blocks");
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
    await roles.cleanup();
  });

  describe("block rules", () => {
    it("a one-night block blocks that night but not a check-out on it", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      await addBlock(unitId, "2030-05-10", "2030-05-10");

      const checkOutOnBlock = await createBooking([unitId], "2030-05-08", "2030-05-10");
      expect(checkOutOnBlock.error).toBeNull();

      const checkInOnBlock = await createBooking([unitId], "2030-05-10", "2030-05-11");
      expect(checkInOnBlock.error?.code).toBe(BLOCKED_NIGHT_CODE);

      const checkInAfterBlock = await createBooking([unitId], "2030-05-11", "2030-05-12");
      expect(checkInAfterBlock.error).toBeNull();
    });

    it("a resort closure blocks every unit, including a unit created after it", async () => {
      if (!shouldRun) return;
      const existingUnitId = await newUnit();
      await addBlock(null, "2031-02-10", "2031-02-12");
      const laterUnitId = await newUnit();

      for (const unitId of [existingUnitId, laterUnitId]) {
        const { error } = await createBooking([unitId], "2031-02-12", "2031-02-14");
        expect(error?.code).toBe(BLOCKED_NIGHT_CODE);
      }
      const afterClosure = await createBooking([laterUnitId], "2031-02-13", "2031-02-14");
      expect(afterClosure.error).toBeNull();
    });

    it("overlapping blocks are allowed", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      await addBlock(unitId, "2030-06-01", "2030-06-05");

      const { error } = await roles.byRole.manager.from("availability_blackouts").insert({
        unit_id: unitId,
        start_date: "2030-06-03",
        end_date: "2030-06-08",
        reason: `${REASON_PREFIX} repainting`,
      });

      expect(error).toBeNull();
    });

    it("a blank or missing reason is refused", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      const manager = roles.byRole.manager;
      const nights = { unit_id: unitId, start_date: "2030-06-10", end_date: "2030-06-11" };

      const blank = await manager
        .from("availability_blackouts")
        .insert({ ...nights, reason: "  " });
      expect(blank.error?.code).toBe("23514");

      const missing = await manager
        .from("availability_blackouts")
        // @ts-expect-error reason is required
        .insert({ ...nights });
      expect(missing.error?.code).toBe("23502");
    });
  });

  it("the block table is in the realtime publication", () => {
    if (!shouldRun) return;
    const tables = runPsql(
      "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'"
    );
    expect(tables).toContain("availability_blackouts");
  });

  describe("access", () => {
    const upcomingNights = { start_date: "2030-11-01", end_date: "2030-11-02" };

    it("anon cannot read blocks", async () => {
      if (!shouldRun) return;
      const block = await addBlock(await newUnit(), "2030-11-01", "2030-11-02");

      const { data } = await roles.anon
        .from("availability_blackouts")
        .select("blackout_id")
        .eq("blackout_id", block.blackout_id);

      expect(data ?? []).toEqual([]);
    });

    it("staff can read blocks but not write them", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      const block = await addBlock(unitId, "2030-11-01", "2030-11-02");
      const staff = roles.byRole.staff;

      const read = await staff
        .from("availability_blackouts")
        .select("blackout_id")
        .eq("blackout_id", block.blackout_id);
      expect(read.data).toHaveLength(1);

      const insert = await staff
        .from("availability_blackouts")
        .insert({ unit_id: unitId, ...upcomingNights, reason: `${REASON_PREFIX} staff` });
      expect(insert.error?.code).toBe("42501");

      const update = await staff
        .from("availability_blackouts")
        .update({ reason: `${REASON_PREFIX} changed` })
        .eq("blackout_id", block.blackout_id)
        .select();
      expect(update.data ?? []).toEqual([]);

      const remove = await staff
        .from("availability_blackouts")
        .delete()
        .eq("blackout_id", block.blackout_id)
        .select();
      expect(remove.data ?? []).toEqual([]);
    });

    it.each(["manager", "owner", "admin"] as const)(
      "%s can create, change and delete a block",
      async (role) => {
        if (!shouldRun) return;
        const client = roles.byRole[role];
        const unitId = await newUnit();

        const created = await client
          .from("availability_blackouts")
          .insert({ unit_id: unitId, ...upcomingNights, reason: `${REASON_PREFIX} ${role}` })
          .select()
          .single();
        expect(created.error).toBeNull();

        const { data: user } = await client.auth.getUser();
        expect(created.data?.created_by).toBe(user.user?.id);

        const updated = await client
          .from("availability_blackouts")
          .update({ end_date: "2030-11-05" })
          .eq("blackout_id", created.data!.blackout_id)
          .select();
        expect(updated.data).toHaveLength(1);

        const removed = await client
          .from("availability_blackouts")
          .delete()
          .eq("blackout_id", created.data!.blackout_id)
          .select();
        expect(removed.data).toHaveLength(1);
      }
    );
  });

  describe("locks", () => {
    const updateBlock = (blockId: string, patch: TablesUpdate<"availability_blackouts">) =>
      roles.byRole.manager
        .from("availability_blackouts")
        .update(patch)
        .eq("blackout_id", blockId)
        .select();

    const deleteBlock = (blockId: string) =>
      roles.byRole.manager
        .from("availability_blackouts")
        .delete()
        .eq("blackout_id", blockId)
        .select();

    it("a past block cannot change or be deleted", async () => {
      if (!shouldRun) return;
      const block = await addBlock(
        await newUnit(),
        plusDays(manilaToday, -5),
        plusDays(manilaToday, -1)
      );

      expect(
        (await updateBlock(block.blackout_id, { reason: `${REASON_PREFIX} late note` })).error?.code
      ).toBe(LOCKED_BLOCK_CODE);
      expect(
        (await updateBlock(block.blackout_id, { end_date: plusDays(manilaToday, 3) })).error?.code
      ).toBe(LOCKED_BLOCK_CODE);
      expect((await deleteBlock(block.blackout_id)).error?.code).toBe(LOCKED_BLOCK_CODE);
    });

    it("a running block can change only its last night, and not to before today", async () => {
      if (!shouldRun) return;
      const block = await addBlock(
        await newUnit(),
        plusDays(manilaToday, -2),
        plusDays(manilaToday, 2)
      );

      expect(
        (await updateBlock(block.blackout_id, { end_date: plusDays(manilaToday, 6) })).data
      ).toHaveLength(1);
      expect((await updateBlock(block.blackout_id, { end_date: manilaToday })).data).toHaveLength(
        1
      );
      expect(
        (await updateBlock(block.blackout_id, { end_date: plusDays(manilaToday, -1) })).error?.code
      ).toBe(LOCKED_BLOCK_CODE);
      expect(
        (await updateBlock(block.blackout_id, { start_date: plusDays(manilaToday, -1) })).error
          ?.code
      ).toBe(LOCKED_BLOCK_CODE);
      expect(
        (await updateBlock(block.blackout_id, { reason: `${REASON_PREFIX} new reason` })).error
          ?.code
      ).toBe(LOCKED_BLOCK_CODE);
      expect((await deleteBlock(block.blackout_id)).error?.code).toBe(LOCKED_BLOCK_CODE);
    });

    it("a block whose first night is today counts as running", async () => {
      if (!shouldRun) return;
      const block = await addBlock(await newUnit(), manilaToday, plusDays(manilaToday, 2));

      expect(
        (await updateBlock(block.blackout_id, { start_date: plusDays(manilaToday, 1) })).error?.code
      ).toBe(LOCKED_BLOCK_CODE);
      expect((await deleteBlock(block.blackout_id)).error?.code).toBe(LOCKED_BLOCK_CODE);
    });

    it("the cabin on a block never changes", async () => {
      if (!shouldRun) return;
      const block = await addBlock(
        await newUnit(),
        plusDays(manilaToday, 5),
        plusDays(manilaToday, 7)
      );

      expect((await updateBlock(block.blackout_id, { unit_id: await newUnit() })).error?.code).toBe(
        LOCKED_BLOCK_CODE
      );
      expect((await updateBlock(block.blackout_id, { unit_id: null })).error?.code).toBe(
        LOCKED_BLOCK_CODE
      );
    });

    it("an upcoming block can change dates and reason, and can be deleted", async () => {
      if (!shouldRun) return;
      const block = await addBlock(
        await newUnit(),
        plusDays(manilaToday, 5),
        plusDays(manilaToday, 7)
      );

      const changed = await updateBlock(block.blackout_id, {
        start_date: plusDays(manilaToday, 3),
        end_date: plusDays(manilaToday, 9),
        reason: `${REASON_PREFIX} moved`,
      });
      expect(changed.data).toHaveLength(1);
      expect((await deleteBlock(block.blackout_id)).data).toHaveLength(1);
    });
  });

  describe("booking guard", () => {
    it("refuses a booking edit that moves onto a blocked night", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      await addBlock(unitId, "2030-07-10", "2030-07-12");
      const { bookingId } = await createBooking([unitId], "2030-07-05", "2030-07-07");

      const moved = await roles.byRole.staff
        .from("bookings")
        .update(toStayInstants("2030-07-08", "2030-07-11"))
        .eq("booking_id", bookingId!);
      expect(moved.error?.code).toBe(BLOCKED_NIGHT_CODE);

      const clear = await roles.byRole.staff
        .from("bookings")
        .update(toStayInstants("2030-07-08", "2030-07-10"))
        .eq("booking_id", bookingId!);
      expect(clear.error).toBeNull();
    });

    it("refuses a booking edit onto a resort closure", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      await addBlock(null, "2031-03-10", "2031-03-10");
      const { bookingId } = await createBooking([unitId], "2031-03-05", "2031-03-07");

      const { error } = await roles.byRole.staff
        .from("bookings")
        .update(toStayInstants("2031-03-09", "2031-03-11"))
        .eq("booking_id", bookingId!);

      expect(error?.code).toBe(BLOCKED_NIGHT_CODE);
    });

    it("refuses a multi-cabin booking when one cabin is blocked", async () => {
      if (!shouldRun) return;
      const freeUnitId = await newUnit();
      const blockedUnitId = await newUnit();
      await addBlock(blockedUnitId, "2030-08-01", "2030-08-01");

      const { error } = await createBooking(
        [freeUnitId, blockedUnitId],
        "2030-08-01",
        "2030-08-02"
      );
      expect(error?.code).toBe(BLOCKED_NIGHT_CODE);

      const { data } = await admin
        .from("booking_unit_availability")
        .select("availability_id")
        .eq("unit_id", freeUnitId);
      expect(data).toEqual([]);
    });

    it("cancelling a booking that sits on a block still works", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      const { bookingId } = await createBooking([unitId], "2030-09-01", "2030-09-03");
      // Rows from before the block save guard: insert the block without triggers.
      runPsql(
        `SET session_replication_role = replica; INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason) VALUES ('${unitId}', '2030-09-02', '2030-09-02', '${REASON_PREFIX} legacy');`
      );

      const { error } = await roles.byRole.staff
        .from("bookings")
        .update({ booking_status: "Cancelled" })
        .eq("booking_id", bookingId!);

      expect(error).toBeNull();
    });

    it("refuses a guest unit assignment onto a cabin block or a resort closure", async () => {
      if (!shouldRun) return;
      const blockedUnitId = await newUnit();
      const freeUnitId = await newUnit();
      await addBlock(blockedUnitId, "2030-10-10", "2030-10-10");

      const overBlock = await createGuestRequest("2030-10-09", "2030-10-11");
      const blocked = await assignUnits(overBlock, blockedUnitId);
      expect(blocked.error?.code).toBe(BLOCKED_NIGHT_CODE);
      expect((await assignUnits(overBlock, freeUnitId)).error).toBeNull();

      // The request step refuses a closure night, and a closure refuses a waiting
      // request, so the closure goes in after the request with the triggers off.
      const overClosure = await createGuestRequest("2031-04-09", "2031-04-11");
      runPsql(
        `SET session_replication_role = replica; INSERT INTO public.availability_blackouts (unit_id, start_date, end_date, reason) VALUES (NULL, '2031-04-10', '2031-04-10', '${REASON_PREFIX} closure');`
      );
      expect((await assignUnits(overClosure, freeUnitId)).error?.code).toBe(BLOCKED_NIGHT_CODE);
    });
  });

  describe("typed helpers", () => {
    let managerId: string;

    beforeAll(async () => {
      if (!shouldRun) return;
      vi.setSystemTime(parseISO(`${manilaToday}T12:00:00+08:00`));

      const email = `blocks-helpers-${crypto.randomUUID()}@example.com`;
      const password = "Test-Password-123!";
      const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      managerId = data.user!.id;
      await admin
        .from("app_roles")
        .insert({ user_id: managerId, email, role: "manager", is_active: true });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`manager sign-in failed: ${error.message}`);
    });

    afterAll(async () => {
      if (!shouldRun) return;
      await supabase.auth.signOut();
      await admin.from("app_roles").delete().eq("user_id", managerId);
      await admin.auth.admin.deleteUser(managerId);
    });

    it("create makes one block per cabin, or one resort closure", async () => {
      if (!shouldRun) return;
      const firstUnitId = await newUnit();
      const secondUnitId = await newUnit();
      const nights = { start_date: "2032-01-10", end_date: "2032-01-12" };

      const perCabin = await db.blackouts.create({
        unitIds: [firstUnitId, secondUnitId],
        ...nights,
        reason: `${REASON_PREFIX} per cabin`,
      });
      expect(perCabin.data?.map((block) => block.unit_id).sort()).toEqual(
        [firstUnitId, secondUnitId].sort()
      );

      const closure = await db.blackouts.create({
        unitIds: null,
        ...nights,
        reason: `${REASON_PREFIX} closure`,
      });
      expect(closure.data?.map((block) => block.unit_id)).toEqual([null]);
    });

    it("conflicts lists the bookings on the nights, and cancelAndSave clears them", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      const { bookingId } = await createBooking([unitId], "2032-02-10", "2032-02-12");
      const block = {
        unitIds: [unitId],
        start_date: "2032-02-11",
        end_date: "2032-02-11",
        reason: `${REASON_PREFIX} helper`,
      };

      const conflicts = await db.blackouts.conflicts({
        unitIds: block.unitIds,
        firstNight: block.start_date,
        lastNight: block.end_date,
      });
      expect(conflicts.data?.map((conflict) => conflict.booking_id)).toEqual([bookingId]);

      const saved = await db.blackouts.cancelAndSave(block, [bookingId!]);
      expect(saved.error).toBeNull();
      expect(saved.data?.status).toBe("saved");
      expect(saved.data?.blocks.map((saved) => saved.unit_id)).toEqual([unitId]);
    });

    it("list shows current and upcoming blocks, and past ones on request", async () => {
      if (!shouldRun) return;
      const unitId = await newUnit();
      const past = await addBlock(unitId, plusDays(manilaToday, -4), plusDays(manilaToday, -1));
      const running = await addBlock(unitId, plusDays(manilaToday, -1), manilaToday);
      const upcoming = await addBlock(unitId, plusDays(manilaToday, 3), plusDays(manilaToday, 4));
      const ids = (blocks: { blackout_id: string }[] | null) =>
        (blocks ?? [])
          .map((block) => block.blackout_id)
          .filter((id) =>
            [past.blackout_id, running.blackout_id, upcoming.blackout_id].includes(id)
          );

      const current = await db.blackouts.list();
      expect(ids(current.data)).toEqual([running.blackout_id, upcoming.blackout_id]);

      const withPast = await db.blackouts.list({ includePast: true });
      expect(ids(withPast.data)).toEqual([
        past.blackout_id,
        running.blackout_id,
        upcoming.blackout_id,
      ]);
    });
  });
});
