/**
 * Health Check Endpoint
 *
 * Simple health check for monitoring and verification
 */

interface Env {
  RATE_LIMIT_KV?: KVNamespace;
  ENVIRONMENT?: string;
}

export async function onRequest(context: EventContext<Env, never, Record<string, unknown>>) {
  const { env } = context;
  const checks: Record<string, boolean> = {};

  // Check KV namespace
  if (env.RATE_LIMIT_KV) {
    try {
      // Try to list one key to verify KV is accessible
      await env.RATE_LIMIT_KV.list({ limit: 1 });
      checks.kv = true;
    } catch (_error) {
      checks.kv = false;
    }
  }

  // Overall health
  const healthy = Object.values(checks).every((v) => v !== false);

  return new Response(
    JSON.stringify({
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || "development",
      checks,
      version: "1.0.0",
    }),
    {
      status: healthy ? 200 : 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    }
  );
}
