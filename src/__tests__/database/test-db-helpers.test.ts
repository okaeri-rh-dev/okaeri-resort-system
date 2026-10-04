/**
 * The shared DB fixtures must satisfy the current schema with their defaults:
 * payment_status is Pending|Partial|Completed|Refunded, booking_units.subtotal
 * must equal unit_price + weekend_surcharge + extra_person_charge, and
 * bookings reach units only through booking_units.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  cleanupTestData,
  createTestBooking,
  createTestMultiUnitBooking,
  shouldRunDatabaseTests,
} from "../setup/test-db";

describe("test-db fixture helpers", () => {
  let shouldRun = false;

  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("createTestBooking works with its defaults", async () => {
    if (!shouldRun) return;

    const booking = await createTestBooking();

    expect(booking?.booking_units).toHaveLength(1);
    expect(booking?.booking_units[0]?.unit?.unit_id).toBeDefined();
  });

  it("createTestMultiUnitBooking returns its units through booking_units", async () => {
    if (!shouldRun) return;

    const booking = await createTestMultiUnitBooking(2);

    expect(booking?.booking_units).toHaveLength(2);
  });
});
