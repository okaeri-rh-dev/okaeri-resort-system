/**
 * The payment-proofs bucket enforces the proof size and type limits itself,
 * because a signed upload URL does not check what the client claimed.
 *
 * @vitest-environment node
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { testSupabaseAdmin as admin, shouldRunDatabaseTests } from "../setup/test-db";

const BUCKET = "payment-proofs";
const FOLDER = `limits-test-${Date.now()}`;
const MB = 1024 * 1024;

let shouldRun = false;

const upload = (name: string, sizeBytes: number, type: string) =>
  admin.storage
    .from(BUCKET)
    .upload(`${FOLDER}/${name}`, new Blob([new Uint8Array(sizeBytes)], { type }), {
      contentType: type,
    });

describe("payment-proofs bucket limits", () => {
  beforeAll(async () => {
    shouldRun = await shouldRunDatabaseTests();
  });

  afterAll(async () => {
    if (!shouldRun) return;
    const { data } = await admin.storage.from(BUCKET).list(FOLDER);
    if (data?.length)
      await admin.storage.from(BUCKET).remove(data.map((o) => `${FOLDER}/${o.name}`));
  });

  it("accepts a JPEG, PNG or PDF up to 5 MB", async () => {
    if (!shouldRun) return;
    for (const [name, type] of [
      ["proof.jpg", "image/jpeg"],
      ["proof.png", "image/png"],
      ["proof.pdf", "application/pdf"],
    ]) {
      const { error } = await upload(name, 5 * MB, type);
      expect(error, `${type} upload`).toBeNull();
    }
  });

  it("rejects a file over 5 MB", async () => {
    if (!shouldRun) return;
    const { error } = await upload("too-big.png", 5 * MB + 1, "image/png");
    expect(error).not.toBeNull();
  });

  it("rejects a type other than JPEG, PNG or PDF", async () => {
    if (!shouldRun) return;
    for (const [name, type] of [
      ["proof.gif", "image/gif"],
      ["proof.html", "text/html"],
    ]) {
      const { error } = await upload(name, 1024, type);
      expect(error, `${type} upload`).not.toBeNull();
    }
  });
});
