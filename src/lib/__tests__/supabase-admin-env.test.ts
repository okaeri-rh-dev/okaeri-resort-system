/**
 * Regression: createSupabaseAdmin read env.VITE_SUPABASE_URL, but Cloudflare
 * Pages Functions only receive SUPABASE_URL. In a deployed Worker the fallback
 * (requireEnv) has no import.meta.env, so the client could not be created.
 */

import { describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("createSupabaseAdmin", () => {
  it("uses the Worker's SUPABASE_URL binding", async () => {
    const { createSupabaseAdmin } = await import("../supabase-admin");

    createSupabaseAdmin({
      SUPABASE_URL: "https://worker-binding.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    });

    expect(createClient).toHaveBeenCalledWith(
      "https://worker-binding.supabase.co",
      "service-key",
      expect.anything()
    );
  });
});
