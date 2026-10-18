import { beforeEach, describe, expect, it, vi } from "vitest";

import { onRequestPost } from "../../../functions/api/cron/anonymize-audit";
import { anonymizeAuditLogs } from "../../../functions/scheduled/anonymize-audit";

const rpc = vi.fn();
const warn = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc })),
}));

vi.mock("../../../functions/lib/logger", () => ({
  createLogger: vi.fn(() => ({ info: vi.fn(), warn, error: vi.fn(), debug: vi.fn() })),
}));

const env = {
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-key",
  CRON_SECRET: "secret",
};

const post = (authorization?: string) =>
  onRequestPost({
    request: new Request("https://example.com/api/cron/anonymize-audit", {
      method: "POST",
      headers: authorization ? { Authorization: authorization } : {},
    }),
    env,
  });

describe("anonymizeAuditLogs", () => {
  beforeEach(() => {
    rpc.mockReset();
    warn.mockReset();
  });

  it("returns the count and table size from the SQL function", async () => {
    rpc.mockResolvedValue({
      data: [{ anonymized_count: 12, audit_logs_bytes: 3_432_448 }],
      error: null,
    });

    await expect(anonymizeAuditLogs(env)).resolves.toEqual({
      anonymizedCount: 12,
      auditLogsBytes: 3_432_448,
    });
    expect(rpc).toHaveBeenCalledWith("anonymize_audit_logs");
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns when audit_logs passes 50 MB", async () => {
    rpc.mockResolvedValue({
      data: [{ anonymized_count: 0, audit_logs_bytes: 60 * 1024 * 1024 }],
      error: null,
    });

    await anonymizeAuditLogs(env);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining("50 MB"));
  });

  it("throws on a database error", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    await expect(anonymizeAuditLogs(env)).rejects.toThrow("Database error: boom");
  });
});

describe("POST /api/cron/anonymize-audit", () => {
  beforeEach(() => rpc.mockReset());

  it("rejects requests without the cron secret", async () => {
    const response = await post();
    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the job result", async () => {
    rpc.mockResolvedValue({
      data: [{ anonymized_count: 3, audit_logs_bytes: 1024 }],
      error: null,
    });

    const response = await post("Bearer secret");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      anonymized_count: 3,
      audit_logs_bytes: 1024,
    });
  });

  it("returns 500 when the job fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    const response = await post("Bearer secret");

    expect(response.status).toBe(500);
  });
});
