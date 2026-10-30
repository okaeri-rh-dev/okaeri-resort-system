/**
 * Role-based access on the payment-proofs, receipts and payment-methods buckets,
 * seasonal_rates, and the dropped booking_pricing_analytics view
 * (20261030100000, 20261030200000).
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createRoleClients, type RoleClients, type TestClient } from "../setup/role-clients";
import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

type Role = "user" | "staff" | "manager" | "owner" | "admin";
const ALL: Role[] = ["user", "staff", "manager", "owner", "admin"];
const STAFF_PLUS: Role[] = ["staff", "manager", "owner", "admin"];
const MANAGER_PLUS: Role[] = ["manager", "owner", "admin"];

const BUCKETS = ["payment-proofs", "receipts"] as const;
const FOLDER = `rls-test-${Date.now()}`;
const pngBlob = () => new Blob(["rls"], { type: "image/png" });

let roleClients: RoleClients;
let clients: Record<Role, TestClient>;
let shouldRun = false;
let seq = 0;

async function seedObject(bucket: string) {
  const path = `${FOLDER}/seed-${seq++}.png`;
  const { error } = await admin.storage.from(bucket).upload(path, pngBlob());
  if (error) throw new Error(`seed upload to ${bucket} failed: ${error.message}`);
  return path;
}

describe("storage and pricing RLS", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
    if (!shouldRun) return;
    roleClients = await createRoleClients("storage-rls");
    clients = { user: roleClients.noRole, ...roleClients.byRole };
  }, 60000);

  afterAll(async () => {
    if (!shouldRun) return;
    for (const bucket of [...BUCKETS, "payment-methods"]) {
      const { data } = await admin.storage.from(bucket).list(FOLDER);
      if (data?.length)
        await admin.storage.from(bucket).remove(data.map((o) => `${FOLDER}/${o.name}`));
    }
    await admin.from("seasonal_rates").delete().like("season_id", "rls_test_%");
    await roleClients.cleanup();
  });

  for (const bucket of BUCKETS) {
    describe(bucket, () => {
      it("list and download need staff or above", async () => {
        if (!shouldRun) return;
        const path = await seedObject(bucket);
        for (const role of ALL) {
          const storage = clients[role].storage.from(bucket);
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
          const { error } = await clients[role].storage
            .from(bucket)
            .upload(`${FOLDER}/${role}-${seq++}.png`, pngBlob());
          expect(error === null, `${role} upload ${bucket}: ${error?.message}`).toBe(
            STAFF_PLUS.includes(role)
          );
        }
      });

      it("update and delete need manager or above", async () => {
        if (!shouldRun) return;
        for (const role of ALL) {
          const storage = clients[role].storage.from(bucket);
          const allowed = MANAGER_PLUS.includes(role);

          const { error: updateError } = await storage.update(await seedObject(bucket), pngBlob());
          expect(updateError === null, `${role} update ${bucket}`).toBe(allowed);

          const { data: removed } = await storage.remove([await seedObject(bucket)]);
          expect((removed?.length ?? 0) > 0, `${role} delete ${bucket}`).toBe(allowed);
        }
      });
    });
  }

  describe("payment-methods", () => {
    const bucket = "payment-methods";

    it("anyone, including anon, can download a QR code", async () => {
      if (!shouldRun) return;
      const path = await seedObject(bucket);
      for (const client of [roleClients.anon, ...ALL.map((role) => clients[role])]) {
        const { error } = await client.storage.from(bucket).download(path);
        expect(error).toBeNull();
      }
    });

    it("upload, update and delete need manager or above", async () => {
      if (!shouldRun) return;
      for (const role of ["anon", ...ALL] as const) {
        const storage = (role === "anon" ? roleClients.anon : clients[role]).storage.from(bucket);
        const allowed = (MANAGER_PLUS as string[]).includes(role);

        const { error: uploadError } = await storage.upload(
          `${FOLDER}/${role}-${seq++}.png`,
          pngBlob()
        );
        expect(uploadError === null, `${role} upload ${bucket}`).toBe(allowed);

        const { error: updateError } = await storage.update(await seedObject(bucket), pngBlob());
        expect(updateError === null, `${role} update ${bucket}`).toBe(allowed);

        const { data: removed } = await storage.remove([await seedObject(bucket)]);
        expect((removed?.length ?? 0) > 0, `${role} delete ${bucket}`).toBe(allowed);
      }
    });
  });

  it("a guest can upload a payment proof through a signed upload URL", async () => {
    if (!shouldRun) return;
    const path = `${FOLDER}/guest-${seq++}.png`;
    const { data: signed, error: signError } = await admin.storage
      .from("payment-proofs")
      .createSignedUploadUrl(path);
    expect(signError).toBeNull();

    const { error } = await roleClients.anon.storage
      .from("payment-proofs")
      .uploadToSignedUrl(path, signed!.token, pngBlob());
    expect(error).toBeNull();
  });

  describe("seasonal_rates", () => {
    const seasonalRateRow = () => ({
      season_id: `rls_test_${seq++}`,
      name: "RLS test season",
      start_date: "01-01",
      end_date: "01-02",
      multiplier: 1.0,
    });

    it("staff and above read, manager and above write", async () => {
      if (!shouldRun) return;
      for (const role of ALL) {
        const table = () => clients[role].from("seasonal_rates");
        const allowedRead = STAFF_PLUS.includes(role);
        const allowedWrite = MANAGER_PLUS.includes(role);

        const { data: read } = await table().select("season_id").limit(1);
        expect((read?.length ?? 0) > 0, `${role} select`).toBe(allowedRead);

        const { error: insertError } = await table().insert(seasonalRateRow());
        expect(insertError === null, `${role} insert`).toBe(allowedWrite);

        const { data: seeded } = await admin
          .from("seasonal_rates")
          .insert(seasonalRateRow())
          .select()
          .single();
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
