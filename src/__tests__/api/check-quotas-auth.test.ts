import { describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../functions/api/monitoring/check-quotas";
import type { UserRole } from "../../../functions/lib/rbac";

const callAs = (role: UserRole | undefined) => {
  const env = {
    RATE_LIMIT_KV: { list: vi.fn(async () => ({ keys: [] })), get: vi.fn(async () => null) },
    ENVIRONMENT: "development",
  };
  return onRequest({
    request: new Request("https://example.com/api/monitoring/check-quotas"),
    env,
    data: { user: role ? { id: "user-1", role } : undefined },
  } as never);
};

describe("check-quotas access", () => {
  it.each<UserRole | undefined>([undefined, "user", "staff", "manager"])(
    "refuses %s with 403",
    async (role) => {
      expect((await callAs(role)).status).toBe(403);
    }
  );

  it.each<UserRole>(["owner", "admin"])("lets %s check quotas", async (role) => {
    expect((await callAs(role)).status).toBe(200);
  });
});
