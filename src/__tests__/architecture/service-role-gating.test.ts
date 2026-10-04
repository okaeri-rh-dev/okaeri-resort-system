/**
 * The service-role key bypasses RLS, so an endpoint that uses it must do its
 * own authorization. Every functions/api file that touches it has to be a
 * deliberate public path, sit behind the admin/ or cron/ gates, or check the
 * caller's app_roles role itself.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { isPublicPath } from "../../../functions/_middleware";

const repoRoot = join(__dirname, "..", "..", "..");
const apiDir = join(repoRoot, "functions", "api");

const USES_SERVICE_ROLE = /SUPABASE_SERVICE_ROLE_KEY|createSupabaseAdmin/;
const CHECKS_ROLE = /\b(requireRole|lookupUserRole|withRBAC)\(/;
const GATED_DIRECTORIES = ["functions/api/admin/", "functions/api/cron/"];

const KNOWN_UNGATED: Record<string, string> = {
  "functions/api/auth/sign-up.ts":
    "Missing from isPublicPath, so the middleware rejects the anonymous sign-up form with 401. Left as is (2026-10-05); see the guardrails plan.",
};

function apiFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return apiFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

function routePath(file: string): string {
  return "/" + relative(join(repoRoot, "functions"), file).replace(/(\/index)?\.ts$/, "");
}

function isGated(file: string): boolean {
  const repoPath = relative(repoRoot, file);
  return (
    GATED_DIRECTORIES.some((dir) => repoPath.startsWith(dir)) ||
    isPublicPath(routePath(file)) ||
    CHECKS_ROLE.test(readFileSync(file, "utf8"))
  );
}

const serviceRoleFiles = apiFiles(apiDir).filter((file) =>
  USES_SERVICE_ROLE.test(readFileSync(file, "utf8"))
);

describe("service-role gating", () => {
  it("finds the service-role endpoints", () => {
    expect(serviceRoleFiles.length).toBeGreaterThan(10);
  });

  it("every service-role endpoint is public, admin/cron-gated, or checks the role", () => {
    const ungated = serviceRoleFiles
      .filter((file) => !isGated(file))
      .map((file) => relative(repoRoot, file))
      .filter((repoPath) => !(repoPath in KNOWN_UNGATED));

    expect(ungated).toEqual([]);
  });

  it("KNOWN_UNGATED has no stale entries", () => {
    const stillUngated = new Set(
      serviceRoleFiles.filter((file) => !isGated(file)).map((file) => relative(repoRoot, file))
    );

    expect(Object.keys(KNOWN_UNGATED).filter((path) => !stillUngated.has(path))).toEqual([]);
  });

  it("the admin/ gate checks app_roles", () => {
    const adminMiddleware = readFileSync(join(apiDir, "admin", "_middleware.ts"), "utf8");
    expect(adminMiddleware).toMatch(CHECKS_ROLE);
  });
});
