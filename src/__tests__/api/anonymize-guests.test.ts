import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../../../functions/api/cron/anonymize-guests";
import { anonymizeExpiredGuests } from "../../../functions/scheduled/anonymize-guests";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc, storage: { from: vi.fn(() => ({ remove })) } })),
}));

vi.mock("../../../functions/lib/logger", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  CRON_SECRET: "secret",
};

const post = (authorization?: string) =>
  onRequestPost({
    request: new Request("https://example.com/api/cron/anonymize-guests", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    }),
    env,
  });

const result = (failed = 0) => ({
  data: [{ guests_count: 2, bookings_count: 1, failed_count: failed, proof_paths: ["a.png"] }],
  error: null,
});

describe("anonymizeExpiredGuests", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("returns the counts and deletes the returned proof files", async () => {
    rpc.mockResolvedValue(result());

    await expect(anonymizeExpiredGuests(env)).resolves.toEqual({
      guestsCount: 2,
      bookingsCount: 1,
      failedCount: 0,
      deletedFiles: ["a.png"],
      failedFiles: [],
    });
    expect(rpc).toHaveBeenCalledWith("anonymize_expired_guests");
    expect(remove).toHaveBeenCalledWith(["a.png"]);
  });

  it("throws on a database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(anonymizeExpiredGuests(env)).rejects.toThrow("Database error: boom");
  });
});

describe("POST /api/cron/anonymize-guests", () => {
  beforeEach(() => {
    rpc.mockReset();
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("rejects requests without the cron secret", async () => {
    const response = await post();
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the job result", async () => {
    rpc.mockResolvedValue(result());

    const response = await post("Bearer secret");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      guests_count: 2,
      bookings_count: 1,
      failed_count: 0,
      deleted_files: 1,
    });
  });

  it("returns 500 when a guest failed, so the workflow step fails", async () => {
    rpc.mockResolvedValue(result(1));

    const response = await post("Bearer secret");

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ success: false, failed_count: 1 });
  });

  it("returns 500 when the job throws", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await post("Bearer secret");

    expect(response.status).toBe(500);
  });
});
