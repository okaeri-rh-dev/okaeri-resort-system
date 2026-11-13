// Holds the vitest DB lock while a command runs: other hooked runs and DB vitest runs delete E2E fixtures.
import { dbLockPath, runHoldingLock } from "../../src/test/db-lock";
import { SUPABASE_LOCAL_URL } from "./supabase-client";

const [command, ...args] = process.argv.slice(2);

runHoldingLock(dbLockPath(SUPABASE_LOCAL_URL), command, args).then(
  (exitCode) => process.exit(exitCode),
  (err) => {
    console.error("✗ Locked run failed:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
);
