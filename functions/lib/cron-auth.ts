/** Checks the `Authorization: Bearer <CRON_SECRET>` header the cleanup workflow sends. */
export function verifyCronAuth(
  request: Request,
  cronSecret: string | undefined
): { valid: boolean; error?: string } {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Invalid Authorization format. Expected: Bearer <token>" };
  }

  if (!cronSecret) {
    console.error("[CRON] CRON_SECRET environment variable not configured");
    return { valid: false, error: "Server configuration error" };
  }

  if (!secretsMatch(authHeader.substring(7), cronSecret)) {
    return { valid: false, error: "Invalid token" };
  }

  return { valid: true };
}

/** Constant-time compare, so response timing does not leak how much of a guess was right. */
export function secretsMatch(given: string, expected: string): boolean {
  const givenBytes = new TextEncoder().encode(given);
  const expectedBytes = new TextEncoder().encode(expected);
  if (givenBytes.length !== expectedBytes.length) return false;

  let difference = 0;
  for (let i = 0; i < expectedBytes.length; i++) difference |= givenBytes[i] ^ expectedBytes[i];
  return difference === 0;
}
