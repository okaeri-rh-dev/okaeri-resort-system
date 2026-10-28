/**
 * Supabase records a migration by its version prefix alone, so two files with the same
 * prefix share one schema_migrations row and `supabase db push` runs only one of them.
 */

import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = join(__dirname, "..", "..", "..", "supabase", "migrations");

describe("migration versions", () => {
  it("every migration file has its own version", () => {
    const versions = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.split("_")[0]);
    const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);

    expect(duplicates).toEqual([]);
  });
});
