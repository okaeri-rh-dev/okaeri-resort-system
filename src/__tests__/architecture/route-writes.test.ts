// @vitest-environment node
/**
 * The client passes a route's *_WRITES constant to afterWrite, so a table the route writes
 * but the constant omits leaves stale caches. Reads source text only; tables written inside
 * Postgres functions called through .rpc(...) or inside imported helpers are not seen.
 * audit_logs is skipped: afterWrite always refreshes it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = join(__dirname, "..", "..", "..");

const ROUTE_WRITES: Record<string, { constant: string; constantFile: string }> = {
  "functions/api/admin/guests/[guestId].ts": {
    constant: "GUEST_RETENTION_WRITES",
    constantFile: "src/stores/useGuestStore.ts",
  },
  "functions/api/admin/guests/[guestId]/anonymize.ts": {
    constant: "GUEST_RETENTION_WRITES",
    constantFile: "src/stores/useGuestStore.ts",
  },
  "functions/api/bookings/multi-unit.ts": {
    constant: "BOOKING_CREATE_WRITES",
    constantFile: "src/lib/bookings/request.ts",
  },
};

const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

function listFiles(dir: string): string[] {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? listFiles(join(dir, entry.name))
      : entry.name.endsWith(".ts")
        ? [join(dir, entry.name)]
        : []
  );
}

// storage.from(bucket).update(...) is a file upload, not a table write
function writtenTables(source: string): string[] {
  const writes = source.matchAll(
    /(?<!storage\s*)\.from\(\s*["'](\w+)["']\s*\)\s*\.(?:insert|update|upsert|delete)\(/g
  );
  return [...new Set([...writes].map((match) => match[1]))];
}

function constantTables(source: string, constant: string): string[] {
  const body = source.match(new RegExp(`const ${constant} = \\[([^\\]]*)\\]`))?.[1];
  if (body === undefined) throw new Error(`${constant} not found`);
  return [...body.matchAll(/["'](\w+)["']/g)].map((match) => match[1]);
}

function missingWrites(route: string, routeSource: string) {
  const { constant, constantFile } = ROUTE_WRITES[route];
  const listed = constantTables(read(constantFile), constant);
  return writtenTables(routeSource)
    .filter((table) => table !== "audit_logs" && !listed.includes(table))
    .map((table) => `${route} writes ${table}, but ${constant} does not list it`);
}

describe("Worker route writes", () => {
  it.each(Object.keys(ROUTE_WRITES))("%s writes only tables its constant lists", (route) => {
    expect(missingWrites(route, read(route))).toEqual([]);
  });

  it("every route whose comment names a *_WRITES constant has a map entry", () => {
    const unmapped = listFiles("functions/api")
      .filter((path) => /\/\/.*\b[A-Z_]+_WRITES\b/.test(read(path)))
      .filter((path) => !(path in ROUTE_WRITES));

    expect(unmapped).toEqual([]);
  });

  it("names the route, table and constant when a write is missing", () => {
    const route = "functions/api/bookings/multi-unit.ts";
    const source = `${read(route)}\nawait supabase.from("expenses").insert({});`;

    expect(missingWrites(route, source)).toEqual([
      `${route} writes expenses, but BOOKING_CREATE_WRITES does not list it`,
    ]);
  });

  it("ignores storage uploads and reads", () => {
    const source = `supabase.storage
        .from("proofs")
        .update(path, file);
      supabase.from("units").select("*");
      supabase
        .from("expenses")
        .delete()`;

    expect(writtenTables(source)).toEqual(["expenses"]);
  });
});
