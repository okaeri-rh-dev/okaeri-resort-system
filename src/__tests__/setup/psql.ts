import { execFileSync } from "node:child_process";

const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";

export function psqlAvailable(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Runs SQL as the local postgres superuser; returns non-empty output lines (-tA format). */
export function runPsql(sql: string): string[] {
  const output = execFileSync(
    "psql",
    [
      "-h",
      "127.0.0.1",
      "-p",
      "54322",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-tA",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: sql, env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: "utf8" }
  );
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
