import { z } from "zod";

/**
 * Search params accepted by the login route(s). Kept in this plain module so the
 * component file exports only its component (satisfies react-refresh) and so
 * other login routes can share the same schema.
 */
export const loginSearchSchema = z.object({
  redirect: z.string().optional(),
  registered: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

/**
 * Resolve where to navigate after a successful login.
 *
 * @param redirectTo - The requested post-login destination (absolute or
 *   relative), or undefined when none was provided.
 * @param origin - The current origin to validate the redirect against
 *   (e.g. window.location.origin).
 * @returns The resolved same-origin absolute URL to navigate to, or null when
 *   there is no redirect or it is not same-origin (the caller should reload).
 */
export function resolveSafeRedirect(redirectTo: string | undefined, origin: string): string | null {
  if (redirectTo) {
    try {
      const url = new URL(redirectTo, origin);
      // Same-origin only — prevents open-redirect attacks
      if (url.origin === origin) {
        return url.href;
      }
    } catch {
      // Invalid URL — fall through to null (caller reloads)
    }
  }
  return null;
}
