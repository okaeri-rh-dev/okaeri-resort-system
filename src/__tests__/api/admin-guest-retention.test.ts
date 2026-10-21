import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRole } from "../../../functions/lib/rbac";
import { createMockEnv } from "./mocks/env";
import { createMockContext, createMockRequest } from "./utils/test-helpers";

const rpc = vi.fn();
const remove = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ rpc, storage: { from: vi.fn(() => ({ remove })) } })),
}));

const GUEST_ID = "11111111-1111-1111-1111-111111111111";
const mockEnv = createMockEnv();

async function anonymizeAs(role: UserRole | null) {
  const { onRequestPost } = await import("../../../functions/api/admin/guests/[guestId]/anonymize");
  const request = createMockRequest(
    `https://api.example.com/api/admin/guests/${GUEST_ID}/anonymize`,
    {
      method: "POST",
    }
  );
  const context = {
    ...createMockContext(request, mockEnv, {}, role ? { id: "user-1", role } : undefined),
    params: { guestId: GUEST_ID },
  };
  return onRequestPost(context as never);
}

async function deleteAs(role: UserRole | null) {
  const { onRequestDelete } = await import("../../../functions/api/admin/guests/[guestId]");
  const request = createMockRequest(`https://api.example.com/api/admin/guests/${GUEST_ID}`, {
    method: "DELETE",
  });
  const context = {
    ...createMockContext(request, mockEnv, {}, role ? { id: "user-1", role } : undefined),
    params: { guestId: GUEST_ID },
  };
  return onRequestDelete(context as never);
}

describe("POST /api/admin/guests/:guestId/anonymize", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [{ proof_path: "a.png" }], error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it("rejects a request with no user", async () => {
    expect((await anonymizeAs(null)).status).toBe(401);
  });

  it.each<UserRole>(["staff", "manager"])("forbids %s", async (role) => {
    expect((await anonymizeAs(role)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each<UserRole>(["owner", "admin"])(
    "lets %s anonymize and deletes the proof files",
    async (role) => {
      const response = await anonymizeAs(role);

      expect(response.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("anonymize_guest", { p_guest_id: GUEST_ID });
      expect(remove).toHaveBeenCalledWith(["a.png"]);
      await expect(response.json()).resolves.toEqual({
        success: true,
        deleted_files: 1,
        failed_files: [],
      });
    }
  );

  it.each([
    ["PT409", 409],
    ["PT404", 404],
    ["XX000", 500],
  ])("maps SQLSTATE %s to %i", async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "blocked" } });

    expect((await anonymizeAs("owner")).status).toBe(status);
  });
});

describe("DELETE /api/admin/guests/:guestId", () => {
  beforeEach(() => {
    rpc.mockReset().mockResolvedValue({ data: [], error: null });
    remove.mockReset().mockResolvedValue({ data: [], error: null });
  });

  it.each<UserRole>(["staff", "manager", "owner"])("forbids %s", async (role) => {
    expect((await deleteAs(role)).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets an admin delete through delete_guest", async () => {
    const response = await deleteAs("admin");

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("delete_guest", { p_guest_id: GUEST_ID });
  });

  it("maps active bookings to 409", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "active bookings" } });

    expect((await deleteAs("admin")).status).toBe(409);
  });
});
