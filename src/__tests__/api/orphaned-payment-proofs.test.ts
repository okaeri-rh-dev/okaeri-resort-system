import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import { sweepOrphanedPaymentProofs } from "../../../functions/lib/orphaned-payment-proofs";

const rpc = vi.fn();
const list = vi.fn();
const remove = vi.fn();
const supabase = {
  rpc,
  storage: { from: vi.fn(() => ({ list, remove })) },
} as unknown as SupabaseClient<Database>;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

const now = new Date("2026-10-25T03:00:00Z");
const thirtyOneDaysAgo = "2026-09-24T03:00:00Z";

function storedFiles(files: { name: string; created_at: string }[]) {
  list.mockImplementation((_prefix: string, options: { limit: number; offset: number }) =>
    Promise.resolve({
      data: files.slice(options.offset, options.offset + options.limit),
      error: null,
    })
  );
}

function referencedPaths(paths: string[]) {
  rpc.mockResolvedValue({ data: paths.map((file_path) => ({ file_path })), error: null });
}

describe("sweepOrphanedPaymentProofs", () => {
  beforeEach(() => {
    rpc.mockReset();
    list.mockReset();
    remove.mockReset().mockResolvedValue({ data: [], error: null });
    logger.warn.mockReset();
    referencedPaths([]);
  });

  it("deletes a TEMP- upload older than 30 days that nothing references", async () => {
    storedFiles([{ name: "TEMP-abc12345_1760000000000.png", created_at: thirtyOneDaysAgo }]);

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(rpc).toHaveBeenCalledWith("referenced_payment_proof_paths");
    expect(remove).toHaveBeenCalledWith(["TEMP-abc12345_1760000000000.png"]);
    expect(result).toEqual({ deleted: ["TEMP-abc12345_1760000000000.png"], failed: [] });
  });

  it("never deletes a TEMP- upload that a booking or payment references, at any age", async () => {
    storedFiles([
      { name: "TEMP-booked01_1700000000000.png", created_at: "2025-01-01T00:00:00Z" },
      { name: "TEMP-paid0001_1700000000000.jpg", created_at: "2025-01-01T00:00:00Z" },
    ]);
    referencedPaths(["TEMP-booked01_1700000000000.png", "TEMP-paid0001_1700000000000.jpg"]);

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(remove).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });

  it("keeps a TEMP- upload that is 30 days old or newer", async () => {
    storedFiles([
      { name: "TEMP-fresh001_1761000000000.png", created_at: "2026-10-17T03:00:00Z" },
      { name: "TEMP-edge0001_1761000000000.png", created_at: "2026-09-25T03:00:00Z" },
    ]);

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(remove).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });

  it("pages through the whole bucket", async () => {
    const files = Array.from({ length: 250 }, (_, i) => ({
      name: `TEMP-page${String(i).padStart(4, "0")}_1760000000000.png`,
      created_at: thirtyOneDaysAgo,
    }));
    storedFiles(files);

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(result.deleted).toHaveLength(250);
    expect(result.deleted.at(-1)).toBe("TEMP-page0249_1760000000000.png");
  });

  it("logs a failed delete with its paths and keeps deleting the rest", async () => {
    const files = Array.from({ length: 150 }, (_, i) => ({
      name: `TEMP-fail${String(i).padStart(4, "0")}_1760000000000.png`,
      created_at: thirtyOneDaysAgo,
    }));
    storedFiles(files);
    remove
      .mockResolvedValueOnce({ data: null, error: { message: "denied" } })
      .mockResolvedValue({ data: [], error: null });

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(result.failed).toHaveLength(100);
    expect(result.failed[0]).toBe("TEMP-fail0000_1760000000000.png");
    expect(result.deleted).toHaveLength(50);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("TEMP-fail0000_1760000000000.png")
    );
  });

  it("stops at 500 deletes per run and logs that it stopped at the cap", async () => {
    const files = Array.from({ length: 520 }, (_, i) => ({
      name: `TEMP-cap${String(i).padStart(4, "0")}_1760000000000.png`,
      created_at: thirtyOneDaysAgo,
    }));
    storedFiles(files);

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(result.deleted).toHaveLength(500);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("cap"));
  });

  it("does not touch files without the TEMP- prefix", async () => {
    storedFiles([
      { name: "OKR-2026-0042_1760000000000.png", created_at: thirtyOneDaysAgo },
      { name: "temp-lowercase_1760000000000.png", created_at: thirtyOneDaysAgo },
    ]);

    const result = await sweepOrphanedPaymentProofs(supabase, logger, now);

    expect(remove).not.toHaveBeenCalled();
    expect(result.deleted).toEqual([]);
  });
});
