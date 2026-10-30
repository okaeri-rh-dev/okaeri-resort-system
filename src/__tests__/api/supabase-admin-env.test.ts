/**
 * Cloudflare Pages Functions receive SUPABASE_URL, not VITE_SUPABASE_URL.
 */

import { describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("createSupabaseAdmin", () => {
  it("uses the Worker's SUPABASE_URL binding", async () => {
    const { createSupabaseAdmin } = await import("../../../functions/lib/supabase-admin");

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
