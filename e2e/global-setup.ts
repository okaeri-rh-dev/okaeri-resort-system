/**
 * Playwright global setup.
 *
 * Seeds the three login users (admin/owner/staff from .env.test) into the
 * LOCAL Supabase stack before any spec runs. Without this, a clean checkout
 * (fresh `supabase db reset`) has no auth users and every credentialed test
 * in e2e/auth.spec.ts fails wholesale.
 *
 * Safety:
 * - Seeding only runs when the resolved Supabase URL is local
 *   (127.0.0.1 / localhost / ::1). Remote targets are never seeded.
 * - `scripts/seed-test-users.mjs` is idempotent (existing users are left intact).
 * - Failure to seed is a WARNING, not a hard stop: specs that need no auth
 *   users (and CI, which has no .env.test and skips credentialed tests)
 *   still run. Login-dependent specs will fail with the warning below as
 *   the breadcrumb.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(file: string): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      out[trimmed.slice(0, eq).trim()] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2");
    }
    return out;
  } catch {
    return {};
  }
}

export default function globalSetup(): void {
  // Mirror the URL resolution order of scripts/seed-test-users.mjs.
  const devVars = parseEnvFile(path.join(repoRoot, ".dev.vars"));
  const envTest = parseEnvFile(path.join(repoRoot, ".env.test"));
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    devVars.SUPABASE_URL ??
    envTest.VITE_SUPABASE_URL ??
    "http://127.0.0.1:54321";

  let hostname: string;
  try {
    hostname = new URL(supabaseUrl).hostname;
  } catch {
    console.warn(`[global-setup] Unparseable Supabase URL "${supabaseUrl}" — skipping seeding.`);
    return;
  }

  const isLocal = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
  if (!isLocal) {
    console.warn(
      `[global-setup] Supabase URL ${supabaseUrl} is not local — skipping test-user seeding.`
    );
    return;
  }

  try {
    execFileSync("node", ["scripts/seed-test-users.mjs"], { cwd: repoRoot, stdio: "inherit" });
  } catch {
    console.warn(
      "[global-setup] WARNING: test-user seeding failed. Login-dependent specs " +
        "(e.g. e2e/auth.spec.ts) will fail or skip. Is local Supabase running " +
        "(`supabase start`) and .env.test populated?"
    );
  }
}
