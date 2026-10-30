/**
 * Role-based access on the payment-proofs and receipts buckets, seasonal_rates,
 * and the dropped booking_pricing_analytics view (20261030100000).
 *
 * @vitest-environment node
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const URL = process.env.TEST_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON = process.env.TEST_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

type Role = "user" | "staff" | "manager" | "owner" | "admin";
const ALL: Role[] = ["user", "staff", "manager", "owner", "admin"];
const STAFF_PLUS: Role[] = ["staff", "manager", "owner", "admin"];
const MANAGER_PLUS: Role[] = ["manager", "owner", "admin"];

const BUCKETS = ["payment-proofs", "receipts"] as const;
const FOLDER = `rls-test-${Date.now()}`;
const file = () => new Blob(["rls"], { type: "image/png" });

const clients: Partial<Record<Role, SupabaseClient>> = {};
const userIds: string[] = [];
let shouldRun = false;
let seq = 0;

async function makeUser(role: Role) {
  const email = `storage-rls-${role}-${Date.now()}@example.com`;
  const password = "Test-Password-123!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${role}) failed: ${error?.message}`);
  userIds.push(data.user.id);

  if (role !== "user") {
    const { error: roleError } = await admin
      .from("app_roles")
      .insert({ user_id: data.user.id, email, role, is_active: true });
    if (roleError) throw new Error(`app_roles insert(${role}) failed: ${roleError.message}`);
  }

  const client = createClient(URL, ANON);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${role}) failed: ${signInError.message}`);
  clients[role] = client;
}

async function seedObject(bucket: string) {
  const path = `${FOLDER}/seed-${seq++}.png`;
  const { error } = await admin.storage.from(bucket).upload(path, file());
  if (error) throw new Error(`seed upload to ${bucket} failed: ${error.message}`);
  return path;
}

describe("storage and pricing RLS", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    for (const role of ALL) await makeUser(role);
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    for (const bucket of BUCKETS) {
      const { data } = await admin.storage.from(bucket).list(FOLDER);
      if (data?.length)
        await admin.storage.from(bucket).remove(data.map((o) => `${FOLDER}/${o.name}`));
    }
    await admin.from("seasonal_rates").delete().like("season_id", "rls_test_%");
    await admin.from("app_roles").delete().in("user_id", userIds);
    for (const id of userIds) await admin.auth.admin.deleteUser(id).catch(() => {});
  });

  for (const bucket of BUCKETS) {
    describe(bucket, () => {
      it("list and download need staff or above", async () => {
        if (!shouldRun) return;
        const path = await seedObject(bucket);
        for (const role of ALL) {
          const storage = clients[role]!.storage.from(bucket);
          const { data: listed } = await storage.list(FOLDER);
          const { error: downloadError } = await storage.download(path);
          const allowed = STAFF_PLUS.includes(role);
          expect((listed?.length ?? 0) > 0, `${role} list ${bucket}`).toBe(allowed);
          expect(downloadError === null, `${role} download ${bucket}`).toBe(allowed);
        }
      });

      it("upload needs staff or above", async () => {
        if (!shouldRun) return;
        for (const role of ALL) {
          const { error } = await clients[role]!.storage.from(bucket).upload(
            `${FOLDER}/${role}-${seq++}.png`,
            file()
          );
          expect(error === null, `${role} upload ${bucket}: ${error?.message}`).toBe(
            STAFF_PLUS.includes(role)
          );
        }
      });

      it("update and delete need manager or above", async () => {
        if (!shouldRun) return;
        for (const role of ALL) {
          const storage = clients[role]!.storage.from(bucket);
          const allowed = MANAGER_PLUS.includes(role);

          const { error: updateError } = await storage.update(await seedObject(bucket), file());
          expect(updateError === null, `${role} update ${bucket}`).toBe(allowed);

          const { data: removed } = await storage.remove([await seedObject(bucket)]);
          expect((removed?.length ?? 0) > 0, `${role} delete ${bucket}`).toBe(allowed);
        }
      });
    });
  }

  it("a guest can upload a payment proof through a signed upload URL", async () => {
    if (!shouldRun) return;
    const path = `${FOLDER}/guest-${seq++}.png`;
    const { data: signed, error: signError } = await admin.storage
      .from("payment-proofs")
      .createSignedUploadUrl(path);
    expect(signError).toBeNull();

    const guest = createClient(URL, ANON);
    const { error } = await guest.storage
      .from("payment-proofs")
      .uploadToSignedUrl(path, signed!.token, file());
    expect(error).toBeNull();
  });

  describe("seasonal_rates", () => {
    const row = () => ({
      season_id: `rls_test_${seq++}`,
      name: "RLS test season",
      start_date: "01-01",
      end_date: "01-02",
      multiplier: 1.0,
    });

    it("staff and above read, manager and above write", async () => {
      if (!shouldRun) return;
      for (const role of ALL) {
        const table = () => clients[role]!.from("seasonal_rates");
        const allowedRead = STAFF_PLUS.includes(role);
        const allowedWrite = MANAGER_PLUS.includes(role);

        const { data: read } = await table().select("season_id").limit(1);
        expect((read?.length ?? 0) > 0, `${role} select`).toBe(allowedRead);

        const { error: insertError } = await table().insert(row());
        expect(insertError === null, `${role} insert`).toBe(allowedWrite);

        const { data: seeded } = await admin.from("seasonal_rates").insert(row()).select().single();
        const { data: updated } = await table()
          .update({ name: "RLS updated" })
          .eq("id", seeded!.id)
          .select();
        expect((updated?.length ?? 0) > 0, `${role} update`).toBe(allowedWrite);

        const { data: deleted } = await table().delete().eq("id", seeded!.id).select();
        expect((deleted?.length ?? 0) > 0, `${role} delete`).toBe(allowedWrite);
      }
    });
  });

  it("booking_pricing_analytics no longer exists", async () => {
    if (!shouldRun) return;
    const { error } = await admin.from("booking_pricing_analytics" as never).select("*");
    expect(error?.code).toBe("PGRST205");
  });
});
