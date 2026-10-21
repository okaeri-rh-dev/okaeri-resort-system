import { beforeEach, describe, expect, it, vi } from "vitest";

import { cleanupPaymentProofs } from "../../../functions/scheduled/cleanup-payment-proofs";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc,
    storage: { from: vi.fn(() => ({ remove })) },
  })),
}));

const env = { SUPABASE_URL: "https://test.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "test-key" };

describe("cleanupPaymentProofs", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("deletes the files the SQL function returns", async () => {
    rpc.mockResolvedValue({
      data: [{ file_path: "bookings/b1/proof.jpg" }, { file_path: "REF_1.png" }],
      error: null,
    });

    await expect(cleanupPaymentProofs(env)).resolves.toEqual({ deletedCount: 2 });

    expect(rpc).toHaveBeenCalledWith("cleanup_expired_payment_proofs");
    expect(remove).toHaveBeenCalledWith(["bookings/b1/proof.jpg", "REF_1.png"]);
  });

  it("skips storage when nothing expired", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await expect(cleanupPaymentProofs(env)).resolves.toEqual({ deletedCount: 0 });

    expect(remove).not.toHaveBeenCalled();
  });
});
