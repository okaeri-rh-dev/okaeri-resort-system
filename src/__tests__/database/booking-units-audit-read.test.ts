/**
 * Managers read the audit rows of a booking's cabins for its History card;
 * staff read none (20261115000000).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import {
  cleanupTestData,
  createTestMultiUnitBooking,
  shouldRunDatabaseTests,
} from "../setup/test-db";

let roleClients: RoleClients;
let bookingId: string;
let shouldRun = false;

const cabinAuditRows = (role: "staff" | "manager") =>
  roleClients.byRole[role]
    .from("audit_logs")
    .select("audit_id")
    .eq("table_name", "booking_units")
    .or(`new_data->>booking_id.eq.${bookingId},old_data->>booking_id.eq.${bookingId}`);

describe("booking_units audit rows", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;

    await cleanupTestData({ includeTestFixtures: true });
    roleClients = await createRoleClients("cabin-audit");
    bookingId = (await createTestMultiUnitBooking(2)).booking_id;
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    await roleClients.cleanup();
    await cleanupTestData({ includeTestFixtures: true });
  });

  it("lets a manager read them", async () => {
    if (!shouldRun) return;
    const { data, error } = await cabinAuditRows("manager");
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });

  it("hides them from staff", async () => {
    if (!shouldRun) return;
    const { data, error } = await cabinAuditRows("staff");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
