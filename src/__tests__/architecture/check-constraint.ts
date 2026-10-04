import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(__dirname, "..", "..", "..", "supabase", "migrations");

export function latestCheckConstraintValues(constraintName: string): string[] {
  const definitions = readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .flatMap((name) => readFileSync(join(migrationsDir, name), "utf8").split("\n"))
    .filter((line) => line.includes(constraintName) && line.includes("CHECK"));

  const latest = definitions.at(-1);
  if (!latest) throw new Error(`${constraintName} not found in migrations`);
  return [...latest.matchAll(/'([^']+)'::/g)].map((match) => match[1]);
}
