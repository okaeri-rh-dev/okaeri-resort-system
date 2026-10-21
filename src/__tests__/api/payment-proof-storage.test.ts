import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/types/database.types";

import { deletePaymentProofFiles } from "../../../functions/lib/payment-proof-storage";

const remove = vi.fn();
const supabase = {
  storage: { from: vi.fn(() => ({ remove })) },
} as unknown as SupabaseClient<Database>;
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

describe("deletePaymentProofFiles", () => {
  beforeEach(() => {
    remove.mockReset();
    logger.warn.mockReset();
  });

  it("deletes the files and reports them", async () => {
    remove.mockResolvedValue({ data: [], error: null });

    await expect(deletePaymentProofFiles(supabase, ["a.png", "b.png"], logger)).resolves.toEqual({
      deleted: ["a.png", "b.png"],
      failed: [],
    });
    expect(remove).toHaveBeenCalledWith(["a.png", "b.png"]);
  });

  it("reports every file as failed and logs the paths when storage errors", async () => {
    remove.mockResolvedValue({ data: null, error: { message: "denied" } });

    await expect(deletePaymentProofFiles(supabase, ["a.png"], logger)).resolves.toEqual({
      deleted: [],
      failed: ["a.png"],
    });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("a.png"));
  });

  it("skips storage when there is nothing to delete", async () => {
    await expect(deletePaymentProofFiles(supabase, [], logger)).resolves.toEqual({
      deleted: [],
      failed: [],
    });
    expect(remove).not.toHaveBeenCalled();
  });
});
