/**
 * Idempotency handler using Cloudflare KV
 * Prevents duplicate bookings from retry attempts or double-submits
 */

export interface IdempotencyResult {
  isProcessed: boolean;
  response?: string; // Cached response if already processed
}

export async function checkIdempotency(kv: KVNamespace, key: string): Promise<IdempotencyResult> {
  const cached = await kv.get(key);

  if (cached) {
    return {
      isProcessed: true,
      response: cached,
    };
  }

  return { isProcessed: false };
}

export async function setIdempotencyResult(
  kv: KVNamespace,
  key: string,
  response: string,
  ttlSeconds: number = 600 // 10 minutes default
): Promise<void> {
  await kv.put(key, response, {
    expirationTtl: ttlSeconds,
  });
}

/**
 * Generate a hash from request body for automatic idempotency key
 */
export async function generateRequestHash(request: Request): Promise<string> {
  const body = await request.clone().text();
  const encoder = new TextEncoder();
  const data = encoder.encode(body);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16); // Use first 16 chars of hash
}

/**
 * Generate idempotency key from request
 * Prefers header-provided key, falls back to request body hash
 */
export async function getIdempotencyKey(request: Request): Promise<string> {
  // Check for client-provided idempotency key
  const headerKey = request.headers.get("X-Idempotency-Key");
  if (headerKey) {
    return headerKey;
  }

  // Generate hash from request body as fallback
  return generateRequestHash(request);
}
