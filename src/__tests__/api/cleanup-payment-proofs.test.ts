import { beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupPaymentProofs } from "../../../functions/scheduled/cleanup-payment-proofs";

const rpc = vi.fn();
const list = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc,
    storage: { from: vi.fn(() => ({ list, remove })) },
  })),
}));

const env = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key" };

function expiredProofs(filePaths: string[]) {
  rpc.mockImplementation((fn: string) =>
    Promise.resolve({
      data:
        fn === "cleanup_expired_payment_proofs"
          ? filePaths.map((file_path) => ({ file_path }))
          : [],
      error: null,
    })
  );
}

describe("cleanupPaymentProofs", () => {
  beforeEach(() => {
    rpc.mockReset();
    list.mockReset().mockResolvedValue({ data: [], error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("deletes the files the SQL function returns", async () => {
    expiredProofs(["bookings/b1/proof.jpg", "REF_1.png"]);

    await expect(cleanupPaymentProofs(env)).resolves.toEqual({
      deletedCount: 2,
      orphanDeletedCount: 0,
    });

    expect(rpc).toHaveBeenCalledWith("cleanup_expired_payment_proofs");
    expect(remove).toHaveBeenCalledWith(["bookings/b1/proof.jpg", "REF_1.png"]);
  });

  it("skips storage when nothing expired", async () => {
    expiredProofs([]);

    await expect(cleanupPaymentProofs(env)).resolves.toEqual({
      deletedCount: 0,
      orphanDeletedCount: 0,
    });

    expect(remove).not.toHaveBeenCalled();
  });

  it("also deletes old guest uploads that nothing references", async () => {
    expiredProofs([]);
    list.mockResolvedValue({
      data: [{ name: "TEMP-abc12345_1700000000000.png", created_at: "2020-01-01T00:00:00Z" }],
      error: null,
    });

    await expect(cleanupPaymentProofs(env)).resolves.toEqual({
      deletedCount: 0,
      orphanDeletedCount: 1,
    });

    expect(remove).toHaveBeenCalledWith(["TEMP-abc12345_1700000000000.png"]);
  });
});
