import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockEnv } from "./setup";

const createSignedUploadUrl = vi.fn();

function postUploadUrl() {
  return new Request("https://okaeri-resort.pages.dev/api/guest-booking/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      booking_reference: "TEMP-1a2b3c4d",
      file_type: "image/png",
      file_size: 1024,
    }),
  });
}

describe("POST /api/guest-booking/upload-url when storage fails", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: () => ({ storage: { from: () => ({ createSignedUploadUrl }) } }),
    }));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("does not echo the storage error text", async () => {
    createSignedUploadUrl.mockResolvedValue({
      data: null,
      error: { message: 'relation "storage.objects" permission denied for role anon' },
    });
    const { onRequest } = await import("../../../functions/api/guest-booking/upload-url");

    const response = await onRequest({ request: postUploadUrl() as never, env: mockEnv });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Could not prepare the upload. Please try again.",
    });
  });

  it("does not echo an unexpected exception", async () => {
    createSignedUploadUrl.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const { onRequest } = await import("../../../functions/api/guest-booking/upload-url");

    const response = await onRequest({ request: postUploadUrl() as never, env: mockEnv });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: "Could not prepare the upload. Please try again.",
    });
  });
});
