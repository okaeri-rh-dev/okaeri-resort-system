/**
 * Integration tests for the bookings.is_walk_in column.
 *
 * Covers:
 * - Column default = false on direct insert
 * - Explicit true persists through insert
 * - Update flips both directions
 * - Round-trips cleanly with all four is_walk_in × is_guest_booking combinations
 * - create_multi_unit_booking RPC honors is_walk_in passed via p_booking_data
 * - create_multi_unit_booking RPC falls back to false when is_walk_in is omitted
 * - Filtering by is_walk_in returns the correct subset
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const futureISO = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

// booking_reference is VARCHAR(20) — keep refs short
const shortRef = (label: string) => `${label}-${crypto.randomUUID().slice(0, 8)}`.slice(0, 20);

describe("bookings.is_walk_in column behavior", () => {
  let testUnitIdRpc1: string;
  let testUnitIdRpc2: string;
  let testGuestId: string;
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) {
      console.log("Skipping is_walk_in tests - test database not configured");
      return;
    }

    await cleanupTestData({ includeTestFixtures: true });

    // The RPC tests use unique units to dodge a pre-existing booking_units
    // exclusion bug (status defaults to 'confirmed' with NULL check_in_date /
    // check_out_date, which causes self-overlap if multiple bookings share a unit).
    const u1 = crypto.randomUUID().slice(0, 8);
    const unitRpc1 = await createTestUnit({
      unit_name: `Test Unit WalkinRpc1 ${u1}`,
      unit_code: `WI1-${u1.slice(0, 5)}`,
      unit_type: "Standard",
      base_rate: 2500,
    });
    testUnitIdRpc1 = unitRpc1.unit_id;

    const u2 = crypto.randomUUID().slice(0, 8);
    const unitRpc2 = await createTestUnit({
      unit_name: `Test Unit WalkinRpc2 ${u2}`,
      unit_code: `WI2-${u2.slice(0, 5)}`,
      unit_type: "Standard",
      base_rate: 2500,
    });
    testUnitIdRpc2 = unitRpc2.unit_id;

    const guest = await createTestGuest({
      guest_name: "Walk-in Test Guest",
      phone_number: "+639170000001",
    });
    testGuestId = guest.guest_id;
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
  });

  beforeEach(async () => {
    if (!shouldRun) return;
    // Wipe bookings between tests for isolation; keep the unit/guest fixtures.
    await supabase
      .from("payments")
      .delete()
      .neq("payment_id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("booking_unit_availability")
      .delete()
      .neq("booking_id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("booking_units")
      .delete()
      .neq("booking_unit_id", "00000000-0000-0000-0000-000000000000");
    await supabase
      .from("bookings")
      .delete()
      .neq("booking_id", "00000000-0000-0000-0000-000000000000");
  });

  it("defaults is_walk_in to false on direct insert when omitted", async () => {
    if (!shouldRun) return;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        booking_reference: shortRef("WIDEF"),
        guest_id: testGuestId,
        guest_name: "Default Walk-in",
        num_guests: 1,
        contact_number: "+639170000010",
        email: "walkin1@test.example.com",
        check_in: futureISO(1),
        check_out: futureISO(2),
        total_amount: 2500,
        booking_status: "Pending",
        payment_status: "Pending",
      })
      .select("is_walk_in")
      .single();

    expect(error).toBeNull();
    expect(data?.is_walk_in).toBe(false);
  });

  it("persists is_walk_in=true on direct insert", async () => {
    if (!shouldRun) return;

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        booking_reference: shortRef("WITRUE"),
        guest_id: testGuestId,
        guest_name: "Explicit Walk-in",
        num_guests: 2,
        contact_number: "+639170000011",
        email: "walkin2@test.example.com",
        check_in: futureISO(3),
        check_out: futureISO(4),
        total_amount: 2500,
        is_walk_in: true,
        booking_status: "Pending",
        payment_status: "Pending",
      })
      .select("is_walk_in")
      .single();

    expect(error).toBeNull();
    expect(data?.is_walk_in).toBe(true);
  });

  it("flips is_walk_in via update in both directions", async () => {
    if (!shouldRun) return;

    const { data: created } = await supabase
      .from("bookings")
      .insert({
        booking_reference: shortRef("WIUPD"),
        guest_id: testGuestId,
        guest_name: "Toggle Walk-in",
        num_guests: 1,
        contact_number: "+639170000012",
        email: "walkin3@test.example.com",
        check_in: futureISO(5),
        check_out: futureISO(6),
        total_amount: 2500,
        is_walk_in: false,
        booking_status: "Pending",
        payment_status: "Pending",
      })
      .select("booking_id, is_walk_in")
      .single();

    expect(created?.is_walk_in).toBe(false);

    const { data: toggledTrue } = await supabase
      .from("bookings")
      .update({ is_walk_in: true })
      .eq("booking_id", created!.booking_id)
      .select("is_walk_in")
      .single();
    expect(toggledTrue?.is_walk_in).toBe(true);

    const { data: toggledFalse } = await supabase
      .from("bookings")
      .update({ is_walk_in: false })
      .eq("booking_id", created!.booking_id)
      .select("is_walk_in")
      .single();
    expect(toggledFalse?.is_walk_in).toBe(false);
  });

  it("round-trips all four is_walk_in × is_guest_booking combinations independently", async () => {
    if (!shouldRun) return;

    const combos: Array<{ walk: boolean; guest: boolean }> = [
      { walk: false, guest: false },
      { walk: true, guest: false },
      { walk: false, guest: true },
      { walk: true, guest: true },
    ];

    for (const combo of combos) {
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          booking_reference: shortRef("WICMB"),
          guest_id: testGuestId,
          guest_name: `Combo ${combo.walk}/${combo.guest}`,
          num_guests: 1,
          contact_number: "+639170000013",
          email: "walkin4@test.example.com",
          check_in: futureISO(10),
          check_out: futureISO(11),
          total_amount: 2500,
          is_walk_in: combo.walk,
          is_guest_booking: combo.guest,
          booking_status: "Pending",
          payment_status: "Pending",
        })
        .select("is_walk_in, is_guest_booking")
        .single();

      expect(error).toBeNull();
      expect(data?.is_walk_in).toBe(combo.walk);
      expect(data?.is_guest_booking).toBe(combo.guest);
    }
  });

  it("persists is_walk_in=true through create_multi_unit_booking RPC", async () => {
    if (!shouldRun) return;

    // p_guest_id: null avoids the guest_statistics trigger path, which has a
    // pre-existing audit_logs check-constraint bug on no-op guest UPDATEs
    // (unrelated to this feature). The booking is still created normally.
    const { data: bookingId, error } = await supabase.rpc("create_multi_unit_booking", {
      p_booking_data: {
        booking_reference: shortRef("WIRPCT"),
        guest_name: "RPC Walk-in",
        contact_number: "+639170000002",
        email: "rpcwalkin1@test.example.com",
        check_in: futureISO(20),
        check_out: futureISO(21),
        num_guests: 1,
        is_walk_in: true,
      },
      p_units: [
        {
          unit_id: testUnitIdRpc1,
          unit_price: 2500,
          weekend_surcharge: 0,
          extra_person_charge: 0,
          subtotal: 2500,
          assigned_guests: 1,
        },
      ],
    });

    expect(error).toBeNull();
    expect(bookingId).toBeTruthy();

    const { data: row } = await supabase
      .from("bookings")
      .select("is_walk_in")
      .eq("booking_id", bookingId!)
      .single();
    expect(row?.is_walk_in).toBe(true);
  });

  it("defaults is_walk_in to false when omitted from create_multi_unit_booking RPC payload", async () => {
    if (!shouldRun) return;

    const { data: bookingId, error } = await supabase.rpc("create_multi_unit_booking", {
      p_booking_data: {
        booking_reference: shortRef("WIRPCO"),
        guest_name: "RPC Omitted Walk-in",
        contact_number: "+639170000003",
        email: "rpcwalkin2@test.example.com",
        check_in: futureISO(25),
        check_out: futureISO(26),
        num_guests: 1,
        // is_walk_in intentionally omitted
      },
      p_units: [
        {
          unit_id: testUnitIdRpc2,
          unit_price: 2500,
          weekend_surcharge: 0,
          extra_person_charge: 0,
          subtotal: 2500,
          assigned_guests: 1,
        },
      ],
    });

    expect(error).toBeNull();

    const { data: row } = await supabase
      .from("bookings")
      .select("is_walk_in")
      .eq("booking_id", bookingId!)
      .single();
    expect(row?.is_walk_in).toBe(false);
  });

  it("filters bookings by is_walk_in flag", async () => {
    if (!shouldRun) return;

    const refPrefix = `WIF${crypto.randomUUID().slice(0, 4)}`;

    // guest_id: null sidesteps the pre-existing audit_logs check-constraint
    // bug fired by the guest_statistics trigger on no-op guest updates.
    const { error: insertError } = await supabase.from("bookings").insert([
      {
        booking_reference: `${refPrefix}-w1`,
        guest_id: null,
        guest_name: "Walk Filter 1",
        num_guests: 1,
        contact_number: "+639170000014",
        email: "walkin5@test.example.com",
        check_in: futureISO(30),
        check_out: futureISO(31),
        total_amount: 2500,
        is_walk_in: true,
        booking_status: "Pending",
        payment_status: "Pending",
      },
      {
        booking_reference: `${refPrefix}-w2`,
        guest_id: null,
        guest_name: "Walk Filter 2",
        num_guests: 1,
        contact_number: "+639170000015",
        email: "walkin6@test.example.com",
        check_in: futureISO(32),
        check_out: futureISO(33),
        total_amount: 2500,
        is_walk_in: true,
        booking_status: "Pending",
        payment_status: "Pending",
      },
      {
        booking_reference: `${refPrefix}-o1`,
        guest_id: null,
        guest_name: "Online Filter 1",
        num_guests: 1,
        contact_number: "+639170000016",
        email: "walkin7@test.example.com",
        check_in: futureISO(34),
        check_out: futureISO(35),
        total_amount: 2500,
        is_walk_in: false,
        booking_status: "Pending",
        payment_status: "Pending",
      },
    ]);

    expect(insertError).toBeNull();

    const { data: walkIns } = await supabase
      .from("bookings")
      .select("booking_reference")
      .eq("is_walk_in", true)
      .like("booking_reference", `${refPrefix}-%`);
    expect(walkIns?.length).toBe(2);
    expect(walkIns?.every((b) => b.booking_reference?.includes("-w"))).toBe(true);

    const { data: reserved } = await supabase
      .from("bookings")
      .select("booking_reference")
      .eq("is_walk_in", false)
      .like("booking_reference", `${refPrefix}-%`);
    expect(reserved?.length).toBe(1);
    expect(reserved?.[0]?.booking_reference?.includes("-o")).toBe(true);
  });
});
