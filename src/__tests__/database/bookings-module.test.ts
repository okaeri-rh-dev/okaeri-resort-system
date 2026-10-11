/**
 * The Booking module (src/lib/bookings) against local Supabase.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  cancelBooking,
  createBooking,
  setBookingStatus,
  updateBooking,
  type NewBooking,
} from "@/lib/bookings";

import {
  cleanupTestData,
  createTestGuest,
  createTestUnit,
  shouldRunDatabaseTests,
  testSupabaseAdmin as supabase,
} from "../setup/test-db";

const iso = (value: string) => new Date(value).toISOString();

const stayFor = (unitId: string, checkIn: string, checkOut: string): NewBooking => ({
  guest: { guest_name: "Module Guest", email: null, contact_number: null },
  check_in: checkIn,
  check_out: checkOut,
  units: [
    {
      unit_id: unitId,
      unit_price: 10000,
      weekend_surcharge: 0,
      extra_person_charge: 0,
      subtotal: 10000,
      assigned_guests: 2,
    },
  ],
  payment_method: "Cash",
  is_walk_in: false,
});

const confirm = (bookingId: string) =>
  supabase.from("bookings").update({ booking_status: "Confirmed" }).eq("booking_id", bookingId);

describe("createBooking", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  afterAll(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("stores the Manila days at 14:00 / 12:00 with an availability row", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();

    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    expect(iso(booking.check_in)).toBe("2026-12-20T06:00:00.000Z");
    expect(iso(booking.check_out)).toBe("2026-12-22T04:00:00.000Z");
    expect(booking.booking_status).toBe("Pending");
    expect(booking.payment_method).toBe("Cash");
    expect(booking.booking_units).toHaveLength(1);

    const { data: availability } = await supabase
      .from("booking_unit_availability")
      .select("unit_id, check_in, check_out")
      .eq("booking_id", booking.booking_id);
    expect(availability).toHaveLength(1);
    expect(iso(availability![0].check_in)).toBe("2026-12-20T06:00:00.000Z");
  });

  it("links an existing guest by email instead of creating a duplicate", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const guest = await createTestGuest();

    const booking = await createBooking(supabase, {
      ...stayFor(unit.unit_id, "2026-12-20", "2026-12-22"),
      guest: { guest_name: guest.guest_name, email: guest.email, contact_number: null },
    });

    expect(booking.guest_id).toBe(guest.guest_id);
  });

  it("creates a guest when there is no email", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();

    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    expect(booking.guest_id).not.toBeNull();
  });

  it("lets one guest check out and the next check in on the same day", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const first = await createBooking(supabase, stayFor(unit.unit_id, "2026-12-20", "2026-12-22"));
    const next = await createBooking(supabase, stayFor(unit.unit_id, "2026-12-22", "2026-12-24"));

    expect((await confirm(first.booking_id)).error).toBeNull();
    expect((await confirm(next.booking_id)).error).toBeNull();
  });

  it("refuses to confirm an overlapping stay on the same unit", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const first = await createBooking(supabase, stayFor(unit.unit_id, "2026-12-20", "2026-12-23"));
    const overlapping = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-22", "2026-12-24")
    );
    await confirm(first.booking_id);

    const { error } = await confirm(overlapping.booking_id);
    expect(error?.message).toMatch(/exclusion/);
  });
});

describe("updateBooking", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("moves the stay and its availability row to the new Manila days", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    const updated = await updateBooking(supabase, booking.booking_id, {
      stay: { check_in: "2026-12-27", check_out: "2026-12-29" },
    });

    expect(iso(updated.check_in)).toBe("2026-12-27T06:00:00.000Z");
    const { data: availability } = await supabase
      .from("booking_unit_availability")
      .select("check_in, check_out")
      .eq("booking_id", booking.booking_id)
      .single();
    expect(iso(availability!.check_out)).toBe("2026-12-29T04:00:00.000Z");
  });

  it("links the booking to the guest with the new email, creating one when missing", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    const updated = await updateBooking(supabase, booking.booking_id, {
      guest_name: "Renamed Guest",
      email: `renamed-${Date.now()}@example.com`,
    });

    const { data: guest } = await supabase
      .from("guests")
      .select("email")
      .eq("guest_id", updated.guest_id!)
      .single();
    expect(guest?.email).toBe(updated.email);
  });

  it("throws when the row is not visible to the caller", async () => {
    if (!shouldRun) return;
    await expect(
      updateBooking(supabase, "00000000-0000-0000-0000-000000000000", { num_guests: 2 })
    ).rejects.toThrow();
  });
});

describe("cancelBooking and setBookingStatus", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  beforeEach(async () => {
    if (shouldRun) await cleanupTestData({ includeTestFixtures: true });
  });

  it("cancels and frees the unit", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );
    await setBookingStatus(supabase, booking.booking_id, "Confirmed");

    const cancelled = await cancelBooking(supabase, booking.booking_id);

    expect(cancelled.booking_status).toBe("Cancelled");
    const { data } = await supabase.rpc("check_multi_unit_availability", {
      p_unit_ids: [unit.unit_id],
      p_check_in: "2026-12-20T06:00:00Z",
      p_check_out: "2026-12-22T04:00:00Z",
    });
    expect(data?.[0].is_available).toBe(true);
  });

  it("throws instead of silently doing nothing when no row is updated", async () => {
    if (!shouldRun) return;
    await expect(cancelBooking(supabase, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();
  });

  it("refuses a status change the workflow does not allow", async () => {
    if (!shouldRun) return;
    const unit = await createTestUnit();
    const booking = await createBooking(
      supabase,
      stayFor(unit.unit_id, "2026-12-20", "2026-12-22")
    );

    await expect(setBookingStatus(supabase, booking.booking_id, "CheckedOut")).rejects.toThrow(
      /Cannot change a Pending booking to CheckedOut/
    );
  });
});
