import { execFile, execFileSync } from "node:child_process";

const PG_PASSWORD = process.env.PGPASSWORD ?? "postgres";

export function psqlAvailable(): boolean {
  try {
    execFileSync("psql", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const PSQL_ARGS = [
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
];

const toLines = (output: string) =>
  output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Runs SQL as the local postgres superuser; returns non-empty output lines (-tA format). */
export function runPsql(sql: string): string[] {
  const output = execFileSync("psql", PSQL_ARGS, {
    input: sql,
    env: { ...process.env, PGPASSWORD: PG_PASSWORD },
    encoding: "utf8",
  });
  return toLines(output);
}

/** Like runPsql, in its own session, so several can run at once. Rejects on any SQL error. */
export function runPsqlAsync(sql: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "psql",
      PSQL_ARGS,
      { env: { ...process.env, PGPASSWORD: PG_PASSWORD }, encoding: "utf8" },
      (error, stdout, stderr) =>
        error ? reject(new Error(stderr || error.message)) : resolve(toLines(stdout))
    );
    child.stdin?.end(sql);
  });
}
