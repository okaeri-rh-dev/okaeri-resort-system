import { describe, expect, it } from "vitest";

import { isLocalSupabaseUrl } from "../../e2e/fixtures/local-supabase-url";

describe("isLocalSupabaseUrl", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])(
    "treats %s as local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
    }
  );

  it.each(["https://gxgpdlvathotgqtszabo.supabase.co", "not a url"])(
    "treats %s as not local",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(false);
    }
  );
});
