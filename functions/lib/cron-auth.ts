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

  if (authHeader.substring(7) !== cronSecret) {
    return { valid: false, error: "Invalid token" };
  }

  return { valid: true };
}
