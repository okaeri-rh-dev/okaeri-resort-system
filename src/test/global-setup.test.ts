// @vitest-environment node
import { existsSync } from "fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { acquireDbLock, dbLockPath } from "./db-lock";

const upload = vi.fn(async () => ({ error: null as { message: string } | null }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ limit: async () => ({ error: null }) }) }),
    storage: { from: () => ({ upload, remove: async () => ({ error: null }) }) },
  }),
}));
vi.mock("./seeds/pricing-config", () => ({ seedPricingConfig: async () => {} }));
const execSync = vi.fn();
vi.mock("child_process", () => ({ execSync: (...args: unknown[]) => execSync(...args) }));

// A URL of its own, so this test never meets the lock that the real run holds.
const supabaseUrl = `http://global-setup-test-${process.pid}.invalid`;

async function loadGlobalSetup() {
  vi.resetModules();
  return (await import("./global-setup")).default;
}

describe("globalSetup", () => {
  beforeEach(() => {
    vi.stubEnv("TEST_SUPABASE_URL", supabaseUrl);
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    upload.mockClear();
  });

  it("holds the database lock until its teardown runs", async () => {
    vi.stubEnv("SKIP_DB_SETUP", undefined);
    const globalSetup = await loadGlobalSetup();

    const teardown = await globalSetup();
    expect(existsSync(dbLockPath(supabaseUrl))).toBe(true);

    teardown?.();
    expect(existsSync(dbLockPath(supabaseUrl))).toBe(false);
  });

  it("stops the run with the fix command when storage uploads fail with 42P10", async () => {
    vi.stubEnv("SKIP_DB_SETUP", undefined);
    upload.mockResolvedValueOnce({ error: { message: "database error, code: 42P10" } });
    const globalSetup = await loadGlobalSetup();

    await expect(globalSetup()).rejects.toThrow(
      /42P10[\s\S]*supabase stop --no-backup && supabase start[\s\S]*deletes all local data/
    );
    expect(existsSync(dbLockPath(supabaseUrl))).toBe(false);
  });

  it("stops the run when the stack clock stays off the host clock", async () => {
    vi.stubEnv("SKIP_DB_SETUP", undefined);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const tenMinutesAgo = new Date(Date.now() - 600_000).toUTCString();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { headers: { date: tenMinutesAgo } }))
    );
    const globalSetup = await loadGlobalSetup();

    try {
      await expect(globalSetup()).rejects.toThrow(/Docker clock is still \d+s off/);
      expect(execSync).toHaveBeenCalledWith(expect.stringContaining("hwclock -s"), {
        stdio: "ignore",
      });
      expect(existsSync(dbLockPath(supabaseUrl))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not wait for the database lock when SKIP_DB_SETUP=1", async () => {
    vi.stubEnv("SKIP_DB_SETUP", "1");
    const globalSetup = await loadGlobalSetup();
    const releaseOtherRun = await acquireDbLock(dbLockPath(supabaseUrl));

    try {
      expect(await globalSetup()).toBeUndefined();
      expect(upload).not.toHaveBeenCalled();
    } finally {
      releaseOtherRun();
    }
  });
});
