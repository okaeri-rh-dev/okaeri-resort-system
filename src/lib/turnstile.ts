/**
 * Cloudflare Turnstile verification (Workers-native)
 * Free tier: Unlimited verifications
 *
 * IMPORTANT: Must use URLSearchParams (not FormData) for Workers compatibility
 */

interface TurnstileResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
  action?: string;
  cdata?: string;
}

export async function verifyTurnstile(
  token: string,
  secretKey: string,
  options?: {
    remoteip?: string;
    expectedHostname?: string;
    expectedAction?: string;
    environment?: string; // "development" | "production"
    skipInDev?: boolean; // Skip in development (default: true)
  }
): Promise<boolean> {
  // Development mode bypass
  const isDevelopment = options?.environment === "development";
  const skipInDev = options?.skipInDev !== false; // Default: true

  if (isDevelopment && skipInDev) {
    // Development mode: skipping verification (debug log removed)
    return true;
  }

  // Also detect mock token explicitly
  if (token === "dev-mock-token" && isDevelopment) {
    // Mock token detected in development: skipping verification (debug log removed)
    return true;
  }

  // Existing bypass for missing key
  if (!secretKey) {
    console.warn("TURNSTILE_SECRET_KEY not configured, skipping verification");
    return true;
  }

  try {
    // Use URLSearchParams for Workers compatibility (not FormData)
    const formData = new URLSearchParams({
      secret: secretKey,
      response: token,
      ...(options?.remoteip ? { remoteip: options.remoteip } : {}),
    });

    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: formData,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    });

    const data: TurnstileResponse = await response.json();

    // Enhanced security validation
    if (!data.success) {
      console.warn("Turnstile verification failed:", data["error-codes"]);
      return false;
    }

    // Verify hostname matches expected domain (prevents token reuse from other sites)
    if (options?.expectedHostname && data.hostname) {
      if (!data.hostname.includes(options.expectedHostname)) {
        console.warn(
          `Hostname mismatch: expected ${options.expectedHostname}, got ${data.hostname}`
        );
        return false;
      }
    }

    // Verify action matches expected value (prevents token reuse across different forms)
    if (options?.expectedAction && data.action) {
      if (data.action !== options.expectedAction) {
        console.warn(`Action mismatch: expected ${options.expectedAction}, got ${data.action}`);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return false;
  }
}

/**
 * Extract client IP from Cloudflare headers
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0] ||
    "unknown"
  );
}

// Usage in Cloudflare Function (Enhanced Security):
// const clientIp = getClientIp(request);
// const isValid = await verifyTurnstile(
//   data.turnstile_token,
//   env.TURNSTILE_SECRET_KEY,
//   {
//     remoteip: clientIp,
//     expectedHostname: 'your-domain.pages.dev',
//     expectedAction: 'guest-booking'
//   }
// );
