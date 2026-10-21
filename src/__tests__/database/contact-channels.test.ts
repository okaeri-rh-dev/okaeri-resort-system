/**
 * Contact channels: RLS per role, the table's constraints and reordering.
 *
 * Requires a local Supabase (supabase start).
 *
 * @vitest-environment node
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/supabase";

import { createRoleClients, type RoleClients } from "../setup/role-clients";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

// The global test setup mocks the app client and points it at a fake URL; the list
// tests query the local database through the real one (as anon).
vi.unmock("@/lib/supabase");
vi.hoisted(() => {
  process.env.VITE_SUPABASE_URL = process.env.TEST_SUPABASE_URL;
  process.env.VITE_SUPABASE_ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;
});

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

  it("appends a new channel after the last one", async () => {
    if (!shouldRun) return;
    const { data: last } = await admin
      .from("contact_channels")
      .select("display_order")
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const created = await createChannel(true);

    expect(created.display_order).toBe((last?.display_order ?? -1) + 1);
  });

  describe("db.contactChannels lists", () => {
    // Rank order is display_order, then created_at, then id. Each group has a
    // created_at tie broken by id. One group is inserted backwards and one forwards,
    // so a list that leaves ties in storage order gets at least one group wrong.
    async function createTiedChannels() {
      const tiedAt = "2026-01-01T00:00:00Z";
      const laterAt = "2026-01-02T00:00:00Z";
      const group = (displayOrder: number, idSuffix: string) => [
        {
          id: `00000000-0000-4000-8000-${idSuffix}`,
          created_at: tiedAt,
          display_order: displayOrder,
        },
        {
          id: `ffffffff-0000-4000-8000-${idSuffix}`,
          created_at: tiedAt,
          display_order: displayOrder,
        },
        {
          id: `aaaaaaaa-0000-4000-8000-${idSuffix}`,
          created_at: laterAt,
          display_order: displayOrder,
        },
      ];
      const first = group(9998, "000000000001");
      const second = group(9999, "000000000002");

      for (const row of [...[...first].reverse(), ...second]) {
        const { error } = await admin
          .from("contact_channels")
          .insert({ ...row, kind: "messenger", value: nextHandle() });
        if (error) throw new Error(`seed tied channel failed: ${error.message}`);
      }
      return [...first, ...second].map((row) => row.id);
    }

    it.each(["all", "active"] as const)(
      "%s() breaks display_order ties by created_at, then id",
      async (list) => {
        if (!shouldRun) return;
        const rankOrder = await createTiedChannels();

        const { data, error } = await db.contactChannels[list]();

        expect(error).toBeNull();
        expect(data?.map((row) => row.id).filter((id) => rankOrder.includes(id))).toEqual(
          rankOrder
        );
      }
    );
  });

  describe("reorder_contact_channel", () => {
    async function orderOf(...ids: string[]) {
      const { data } = await admin
        .from("contact_channels")
        .select("id, display_order")
        .in("id", ids);
      return ids.map((id) => data?.find((row) => row.id === id)?.display_order);
    }

    it.each(MANAGER_PLUS)("%s swaps a channel with the one above it", async (role) => {
      if (!shouldRun) return;
      const upper = await createChannel(true);
      const lower = await createChannel(false);

      const { error } = await roles.byRole[role].rpc("reorder_contact_channel", {
        p_id: lower.id,
        p_direction: "up",
      });

      expect(error).toBeNull();
      const [upperOrder, lowerOrder] = await orderOf(upper.id, lower.id);
      expect(lowerOrder! + 1).toBe(upperOrder);
    });

    it("leaves the order alone when the last channel moves down", async () => {
      if (!shouldRun) return;
      const upper = await createChannel(true);
      const lower = await createChannel(true);
      const before = await orderOf(upper.id, lower.id);

      const { error } = await roles.byRole.manager.rpc("reorder_contact_channel", {
        p_id: lower.id,
        p_direction: "down",
      });

      expect(error).toBeNull();
      expect(await orderOf(upper.id, lower.id)).toEqual(before);
    });

    it.each(["staff", "anon"] as const)(
      "%s cannot reorder, and neither row changes",
      async (role) => {
        if (!shouldRun) return;
        const upper = await createChannel(true);
        const lower = await createChannel(true);
        const before = await orderOf(upper.id, lower.id);
        const client = role === "anon" ? roles.anon : roles.byRole.staff;

        const { error } = await client.rpc("reorder_contact_channel", {
          p_id: lower.id,
          p_direction: "up",
        });

        expect(error?.code).toBe("42501");
        expect(await orderOf(upper.id, lower.id)).toEqual(before);
      }
    );
  });
});
