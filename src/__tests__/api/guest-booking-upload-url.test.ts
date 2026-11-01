import { describe, expect, it, vi } from "vitest";

import { onRequest } from "../../../functions/api/guest-booking/upload-url";
import { mockEnv } from "./setup";

vi.mock("@supabase/supabase-js", async () =>
  (await import("./mocks/supabase")).mockSupabaseModule()
);

const uploadUrlRequest = (body: Record<string, unknown>) =>
  new Request("https://api.example.com/api/guest-booking/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.9" },
    body: JSON.stringify({
      booking_reference: "TEMP-1a2b3c4d",
      file_name: "gcash.png",
      file_type: "image/png",
      file_size: 1024,
      ...body,
    }),
  });

describe("POST /api/guest-booking/upload-url", () => {
  it("returns 429 once one client passes 10 upload URLs in an hour", async () => {
    const env = { ...mockEnv, ENVIRONMENT: "production" as const };

    const statuses: number[] = [];
    for (let attempt = 1; attempt <= 11; attempt++) {
      const response = await onRequest({ request: uploadUrlRequest({}), env });
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
  });

  it.each(["../BK-202611-ABC123", "TEMP-1a2b3c4d/../x", "TEMP-XYZ", "BK-202611-ABC123"])(
    "rejects the booking reference %s",
    async (booking_reference) => {
      const response = await onRequest({
        request: uploadUrlRequest({ booking_reference }),
        env: mockEnv,
      });

      expect(response.status).toBe(400);
    }
  );

  it.each(["text/html", "constructor"])("rejects the file type %s", async (file_type) => {
    const response = await onRequest({ request: uploadUrlRequest({ file_type }), env: mockEnv });

    expect(response.status).toBe(400);
  });

  it.each([
    ["application/pdf", "pdf"],
    ["image/jpeg", "jpg"],
    ["image/jpg", "jpg"],
    ["image/png", "png"],
  ])("names a %s upload .%s whatever the file name says", async (file_type, extension) => {
    const response = await onRequest({
      request: uploadUrlRequest({ file_type, file_name: "proof.html" }),
      env: mockEnv,
    });
    const { file_path } = (await response.json()) as { file_path: string };

    expect(file_path).toMatch(new RegExp(`^TEMP-1a2b3c4d_\\d+\\.${extension}$`));
  });
});
