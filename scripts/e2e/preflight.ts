import { SUPABASE_LOCAL_URL } from "./supabase-client";

async function preflight(): Promise<void> {
  try {
    const res = await fetch(`${SUPABASE_LOCAL_URL}/rest/v1/`, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    // Any 2xx/4xx response means Supabase is up. 5xx or network error means down.
    if (res.status >= 500) {
      throw new Error(`Supabase returned ${res.status}`);
    }
    console.log(`✓ Local Supabase reachable at ${SUPABASE_LOCAL_URL}`);
  } catch (err) {
    console.error(`✗ Local Supabase is not reachable at ${SUPABASE_LOCAL_URL}.`);
    console.error("  This pre-push E2E run requires a running local Supabase.");
    console.error("  Start it with:    supabase start");
    console.error("  Then push again.");
    console.error(`  (Reason: ${err instanceof Error ? err.message : String(err)})`);
    process.exit(1);
  }
}

preflight();
