/**
 * verify_and_confirm_booking: one manager step that records the online downpayment,
 * assigns the cabins and confirms the booking, or changes nothing.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupBlockTestData,
  cleanupTestData,
  createTestBooking,
  createTestUnit,
  testSupabaseAdmin as service,
  shouldRunDatabaseTests,
} from "../setup/test-db";

// Manila 2027-04-10 14:00 to 2027-04-12 12:00 (docs/adr/0002)
const STAY = { check_in: "2027-04-10T06:00:00.000Z", check_out: "2027-04-12T04:00:00.000Z" };
const BLOCK_REASON = "dbtest-verify";

let roles: RoleClients;
let shouldRun = false;

async function createOnlineBooking(guests: number[]): Promise<string> {
  const unit_breakdown = guests.map((count) => ({
    guests: count,
    total: 8000,
    extra_person_fees: count > 2 ? 1000 : 0,
  }));
  const { data, error } = await service.rpc("create_guest_booking", {
    p_turnstile_token: "test-token",
    p_booking_data: {
      booking_reference: `TB-VC-${crypto.randomUUID().slice(0, 8)}`,
      guest_name: "Verify Test Guest",
      email: "verify-guest-test@example.com",
      phone_number: "+639171234567",
      ...STAY,
      total_amount: 8000 * guests.length,
      downpayment_required: 4000 * guests.length,
      pricing_snapshot: { unit_breakdown },
      payment_proof_url: "TEMP-verify_1.png",
    },
    p_unit_requests: guests.map((count) => ({ guests_per_unit: count })),
  });
  if (error) throw error;
  return (data as { booking: { booking_id: string } }).booking.booking_id;
}

const verifyAs = (role: keyof RoleClients["byRole"], bookingId: string, unitIds: string[]) =>
  roles.byRole[role].rpc("verify_and_confirm_booking", {
    p_booking_id: bookingId,
    p_unit_ids: unitIds,
  });

async function bookingState(bookingId: string) {
  const { data, error } = await service
    .from("bookings")
    .select(
      "booking_status, unit_assignment_status, payment_status, booking_units(unit_id, subtotal, extra_person_charge, assigned_guests), booking_unit_availability(unit_id), payments(amount, kind, status, proof_url)"
    )
    .eq("booking_id", bookingId)
    .single();
  if (error) throw error;
  return data;
}

const unchanged = {
  booking_status: "Pending",
  unit_assignment_status: "pending",
  payment_status: "Pending",
  booking_units: [],
  booking_unit_availability: [],
  payments: [],
};

describe("verify_and_confirm_booking", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("verify-confirm");
  }, 60000);

  beforeEach(async () => {
    if (!shouldRun) return;
    await cleanupBlockTestData(BLOCK_REASON, []);
    await cleanupTestData({ includeTestFixtures: true });
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await cleanupBlockTestData(BLOCK_REASON, []);
    await cleanupTestData({ includeTestFixtures: true });
    await roles.cleanup();
  });

  it("records the downpayment, assigns the cabins at the quoted prices and confirms", async () => {
    if (!shouldRun) return;
    const bookingId = await createOnlineBooking([2, 4]);
    const [first, second] = [await createTestUnit(), await createTestUnit()];

    const { error } = await verifyAs("manager", bookingId, [first.unit_id, second.unit_id]);

    expect(error).toBeNull();
    const state = await bookingState(bookingId);
    expect(state).toMatchObject({
      booking_status: "Confirmed",
      unit_assignment_status: "assigned",
      payment_status: "Partial",
      payments: [
        {
          amount: 8000,
          kind: "online_downpayment",
          status: "Active",
          proof_url: "TEMP-verify_1.png",
        },
      ],
    });
    expect(state.booking_units).toEqual(
      expect.arrayContaining([
        { unit_id: first.unit_id, subtotal: 8000, extra_person_charge: 0, assigned_guests: 2 },
        { unit_id: second.unit_id, subtotal: 8000, extra_person_charge: 1000, assigned_guests: 4 },
      ])
    );
    expect(state.booking_unit_availability).toHaveLength(2);
  });

  it("does not record the payment twice when one is already recorded", async () => {
    if (!shouldRun) return;
    const bookingId = await createOnlineBooking([2]);
    await service
      .from("payments")
      .insert({ booking_id: bookingId, amount: 4000, status: "Active" });
    const unit = await createTestUnit();

    const { error } = await verifyAs("owner", bookingId, [unit.unit_id]);

    expect(error).toBeNull();
    const state = await bookingState(bookingId);
    expect(state.booking_status).toBe("Confirmed");
    expect(state.payments).toEqual([expect.objectContaining({ amount: 4000, kind: "manual" })]);
  });

  it("refuses the wrong number of cabins and changes nothing", async () => {
    if (!shouldRun) return;
    const bookingId = await createOnlineBooking([2, 2]);
    const unit = await createTestUnit();

    const { error } = await verifyAs("manager", bookingId, [unit.unit_id]);

    expect(error?.message).toMatch(/exactly 2 cabins/);
    expect(await bookingState(bookingId)).toMatchObject(unchanged);
  });

  it("refuses a cabin booked on those nights and changes nothing", async () => {
    if (!shouldRun) return;
    const [free, booked] = [await createTestUnit(), await createTestUnit()];
    await createTestBooking({
      unit: booked,
      check_in: new Date(STAY.check_in),
      check_out: new Date(STAY.check_out),
    });
    const bookingId = await createOnlineBooking([2, 2]);

    const { error } = await verifyAs("manager", bookingId, [free.unit_id, booked.unit_id]);

    expect(error?.code).toBe("23P01");
    expect(await bookingState(bookingId)).toMatchObject(unchanged);
  });

  it("refuses a cabin blocked on those nights and changes nothing", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const { error: blockError } = await service.from("availability_blackouts").insert({
      unit_id: unit.unit_id,
      start_date: "2027-04-11",
      end_date: "2027-04-11",
      reason: `${BLOCK_REASON} aircon`,
    });
    if (blockError) throw blockError;
    const bookingId = await createOnlineBooking([2]);

    const { error } = await verifyAs("manager", bookingId, [unit.unit_id]);

    expect(error?.code).toBe("BLOCK");
    expect(await bookingState(bookingId)).toMatchObject(unchanged);
  });

  it("refuses staff and changes nothing", async () => {
    if (!shouldRun) return;
    const bookingId = await createOnlineBooking([2]);
    const unit = await createTestUnit();

    const { error } = await verifyAs("staff", bookingId, [unit.unit_id]);

    expect(error?.code).toBe("42501");
    expect(await bookingState(bookingId)).toMatchObject(unchanged);
  });

  it("refuses the anon key", async () => {
    if (!shouldRun) return;
    const { error } = await roles.anon.rpc("verify_and_confirm_booking", {
      p_booking_id: crypto.randomUUID(),
      p_unit_ids: [crypto.randomUUID()],
    });
    expect(error?.message).toMatch(/permission denied/);
  });

  it("lets only one of two concurrent verifies through", async () => {
    if (!shouldRun) return;
    const bookingId = await createOnlineBooking([2]);
    const [first, second] = [await createTestUnit(), await createTestUnit()];

    const results = await Promise.all([
      verifyAs("manager", bookingId, [first.unit_id]),
      verifyAs("owner", bookingId, [second.unit_id]),
    ]);

    expect(results.filter((result) => result.error === null)).toHaveLength(1);
    const state = await bookingState(bookingId);
    expect(state.booking_units).toHaveLength(1);
    expect(state.payments).toHaveLength(1);
  });
});
