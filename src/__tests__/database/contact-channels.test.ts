/**
 * Contact channels: RLS per role and the table's constraints.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const TEST_HANDLE_PREFIX = "dbtest-cc-";
const MANAGER_PLUS = ["manager", "owner", "admin"] as const;

let shouldRun = false;
let roles: RoleClients;
let handleSeq = 0;

const nextHandle = () => `${TEST_HANDLE_PREFIX}${Date.now()}-${handleSeq++}`;

async function createChannel(isActive: boolean) {
  const { data, error } = await admin
    .from("contact_channels")
    .insert({ kind: "messenger", value: nextHandle(), is_active: isActive })
    .select()
    .single();
  if (error || !data) throw new Error(`seed contact channel failed: ${error?.message}`);
  return data;
}

describe("contact_channels", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roles = await createRoleClients("contact-channels");
  }, 60000);

  afterEach(async () => {
    if (!shouldRun) return;
    await admin.from("contact_channels").delete().like("value", `${TEST_HANDLE_PREFIX}%`);
  });

  afterAll(async () => {
    if (!shouldRun) return;
    await roles.cleanup();
  });

  it("anon reads active channels only", async () => {
    if (!shouldRun) return;
    const active = await createChannel(true);
    const hidden = await createChannel(false);

    const { data } = await roles.anon
      .from("contact_channels")
      .select("id")
      .in("id", [active.id, hidden.id]);

    expect(data?.map((row) => row.id)).toEqual([active.id]);
  });

  it("staff cannot read hidden channels, insert, update or delete", async () => {
    if (!shouldRun) return;
    const staff = roles.byRole.staff;
    const hidden = await createChannel(false);
    const active = await createChannel(true);

    const { data: read } = await staff.from("contact_channels").select("id").eq("id", hidden.id);
    expect(read).toEqual([]);

    const { error: insertError } = await staff
      .from("contact_channels")
      .insert({ kind: "messenger", value: nextHandle() });
    expect(insertError?.code).toBe("42501");

    const { data: updated } = await staff
      .from("contact_channels")
      .update({ label: "Changed" })
      .eq("id", active.id)
      .select();
    expect(updated).toEqual([]);

    const { data: deleted } = await staff
      .from("contact_channels")
      .delete()
      .eq("id", active.id)
      .select();
    expect(deleted).toEqual([]);
  });

  it.each(MANAGER_PLUS)(
    "%s reads hidden channels and can insert, update and delete",
    async (role) => {
      if (!shouldRun) return;
      const client = roles.byRole[role];
      const hidden = await createChannel(false);

      const { data: read } = await client.from("contact_channels").select("id").eq("id", hidden.id);
      expect(read).toEqual([{ id: hidden.id }]);

      const { data: inserted, error: insertError } = await client
        .from("contact_channels")
        .insert({ kind: "messenger", value: nextHandle(), label: "Maria" })
        .select()
        .single();
      expect(insertError).toBeNull();

      const { data: updated } = await client
        .from("contact_channels")
        .update({ label: "Ben" })
        .eq("id", inserted!.id)
        .select("label");
      expect(updated).toEqual([{ label: "Ben" }]);

      const { data: deleted } = await client
        .from("contact_channels")
        .delete()
        .eq("id", inserted!.id)
        .select("id");
      expect(deleted).toEqual([{ id: inserted!.id }]);
    }
  );

  it("rejects a second channel with the same kind and value", async () => {
    if (!shouldRun) return;
    const value = nextHandle();
    await admin.from("contact_channels").insert({ kind: "messenger", value });

    const { error } = await admin.from("contact_channels").insert({ kind: "messenger", value });

    expect(error?.code).toBe("23505");
  });

  it("allows the same value under two kinds", async () => {
    if (!shouldRun) return;
    const value = nextHandle();
    await admin.from("contact_channels").insert({ kind: "messenger", value });

    const { error } = await admin.from("contact_channels").insert({ kind: "facebook", value });

    expect(error).toBeNull();
  });

  it("rejects an unknown kind", async () => {
    if (!shouldRun) return;
    const { error } = await admin
      .from("contact_channels")
      .insert({ kind: "telegram" as "messenger", value: nextHandle() });

    expect(error?.code).toBe("23514");
  });

  it("rejects a label longer than 40 characters", async () => {
    if (!shouldRun) return;
    const { error } = await admin
      .from("contact_channels")
      .insert({ kind: "messenger", value: nextHandle(), label: "x".repeat(41) });

    expect(error?.code).toBe("23514");
  });
});
