/**
 * Security Event Constants
 * Phase 1.2 - Centralized event keys for cross-tab synchronization
 *
 * These constants are used for localStorage event signaling between tabs.
 * Events are temporary (removed within 100ms) and never contain sensitive data.
 */

/**
 * Security event keys for cross-tab communication
 */
export const SECURITY_EVENTS = {
  /**
   * Broadcast when user logs out in one tab
   * Triggers logout in all other tabs
   */
  LOGOUT: "okaeri_logout_event",

  /**
   * Broadcast when tokens are updated/rotated
   * Triggers token refresh check in other tabs
   */
  TOKEN_UPDATE: "okaeri_token_update",
} as const;

/**
 * Type for security event keys
 */
export type SecurityEventKey = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

/**
 * Helper to check if a storage key is a security event
 * Used by verification scripts to filter allowed localStorage usage
 */
export function isSecurityEventKey(key: string): boolean {
  return Object.values(SECURITY_EVENTS).includes(key as SecurityEventKey);
}
