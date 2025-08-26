/**
 * Secure Token Management with Enhanced Protection
 * Implements OWASP best practices for token storage and management
 * Addresses critical security vulnerability from audit
 */

import type { User } from "@/types/common";
import { SECURITY_ERROR_CODES, TOKEN_EXPIRY } from "./constants";

interface TokenPayload {
  exp: number;
  iat: number;
  sub: string;
  email: string;
  role: string;
  projectId?: string;
  jti?: string; // JWT ID for revocation
}

interface StoredToken {
  token: string;
  expiresAt: number;
  issuedAt: number;
  fingerprint: string;
}

/**
 * Secure Token Manager with memory-only storage
 * Prevents XSS attacks by avoiding localStorage/sessionStorage
 */
export class SecureTokenManager {
  private static instance: SecureTokenManager;

  // Memory-only storage - not accessible via window object
  private accessToken: string | null = null;
  private tokenFingerprint: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshCallbacks: Set<() => Promise<void>> = new Set();

  // Token rotation tracking
  private tokenRotationCount: number = 0;
  private lastTokenRotation: number = 0;

  private constructor() {
    // Singleton pattern
    this.initializeSecurityListeners();
  }

  static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }

  /**
   * Initialize security event listeners
   */
  private initializeSecurityListeners(): void {
    // Detect tab visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        // Tab is hidden, pause refresh timer
        this.pauseTokenRefresh();
      } else {
        // Tab is visible, resume and check token
        this.resumeTokenRefresh();
      }
    });

    // Detect storage events (for logout synchronization)
    window.addEventListener("storage", (event) => {
      if (event.key === "okaeri_logout_event") {
        // Another tab logged out, clear tokens
        this.clearTokens();
        window.location.href = "/login?reason=logged_out_other_tab";
      }
    });

    // Prevent token extraction attempts
    this.preventTokenExtraction();
  }

  /**
   * Prevent common token extraction attempts
   */
  private preventTokenExtraction(): void {
    // Override console methods in production
    if (import.meta.env.PROD) {
      const noop = () => {};
      const consoleWarn = console.warn;

      // Only block specific console methods that might be used for token extraction
      const originalLog = console.log;
      console.log = (...args: any[]) => {
        // Filter out sensitive data
        const filtered = args.map((arg) => {
          if (typeof arg === "string" && arg.includes("Bearer")) {
            return "[REDACTED]";
          }
          return arg;
        });
        originalLog.apply(console, filtered);
      };

      // Warn about debugger usage
      setInterval(() => {
        const start = performance.now();
        // eslint-disable-next-line no-debugger
        debugger;
        const end = performance.now();
        if (end - start > 100) {
          consoleWarn("Debugger detected. Security measures activated.");
          this.handleSuspiciousActivity();
        }
      }, 1000);
    }
  }

  /**
   * Handle suspicious activity detection
   */
  private handleSuspiciousActivity(): void {
    // Log security event
    const event = new CustomEvent("securityAlert", {
      detail: {
        type: "suspicious_activity",
        timestamp: Date.now(),
      },
    });
    window.dispatchEvent(event);

    // Optionally: Reduce token lifetime or require re-authentication
    if (this.tokenRotationCount > 10) {
      this.clearTokens();
      window.location.href = "/login?reason=security_check";
    }
  }

  /**
   * Generate secure token fingerprint
   */
  private generateFingerprint(): string {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return Math.random().toString(36);

    // Create canvas fingerprint
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Browser Fingerprint", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("Browser Fingerprint", 4, 17);

    const dataURL = canvas.toDataURL();

    // Combine with other browser characteristics
    const fingerprint = btoa(
      JSON.stringify({
        canvas: dataURL.slice(-50),
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        vendor: navigator.vendor,
      })
    );

    return fingerprint;
  }

  /**
   * Parse JWT token payload securely
   */
  parseToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("Invalid token format");
        return null;
      }

      // Validate token structure
      if (
        !/^[A-Za-z0-9_-]+$/.test(parts[0]!) ||
        !/^[A-Za-z0-9_-]+$/.test(parts[1]!) ||
        !/^[A-Za-z0-9_-]+$/.test(parts[2]!)
      ) {
        console.error("Token contains invalid characters");
        return null;
      }

      const payload = JSON.parse(atob(parts[1]!));

      // Validate required fields
      if (!payload.exp || !payload.iat || !payload.sub) {
        console.error("Token missing required fields");
        return null;
      }

      return payload as TokenPayload;
    } catch (error) {
      console.error("Failed to parse token:", error);
      return null;
    }
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(token: string, bufferTime: number = TOKEN_EXPIRY.REFRESH_BUFFER): boolean {
    const payload = this.parseToken(token);
    if (!payload) return true;

    const now = Date.now() / 1000;
    const expiryWithBuffer = payload.exp - bufferTime / 1000;

    return now >= expiryWithBuffer;
  }

  /**
   * Calculate time until token expiry
   */
  getTimeUntilExpiry(token: string): number {
    const payload = this.parseToken(token);
    if (!payload) return 0;

    const now = Date.now() / 1000;
    const timeUntilExpiry = (payload.exp - now) * 1000;

    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Store tokens securely in memory only
   * Refresh token should be stored as httpOnly cookie by server
   */
  storeTokens(accessToken: string, refreshToken?: string): void {
    // Validate token before storing
    const validation = this.validateTokenStructure(accessToken);
    if (!validation.valid) {
      throw new Error(validation.error || "Invalid token");
    }

    // Store access token in memory only
    this.accessToken = accessToken;
    this.tokenFingerprint = this.generateFingerprint();

    // Track token rotation
    this.tokenRotationCount++;
    this.lastTokenRotation = Date.now();

    // Note: Refresh token should be managed server-side as httpOnly cookie
    // Not stored in client memory or storage
    if (refreshToken) {
      console.warn("Refresh token should be managed server-side as httpOnly cookie");
    }

    // Set up automatic refresh
    this.scheduleTokenRefresh(accessToken);

    // Broadcast token update to other tabs (without token value)
    this.broadcastTokenUpdate();
  }

  /**
   * Retrieve stored access token with fingerprint validation
   */
  getAccessToken(): string | null {
    // Validate fingerprint hasn't changed (detect token theft)
    const currentFingerprint = this.generateFingerprint();
    if (this.tokenFingerprint && this.tokenFingerprint !== currentFingerprint) {
      console.error("Token fingerprint mismatch - possible token theft");
      this.clearTokens();
      this.handleSuspiciousActivity();
      return null;
    }

    return this.accessToken;
  }

  /**
   * Clear all tokens securely
   */
  clearTokens(): void {
    // Overwrite token in memory
    if (this.accessToken) {
      this.accessToken = crypto.getRandomValues(new Uint8Array(this.accessToken.length)).toString();
      this.accessToken = null;
    }

    this.tokenFingerprint = null;
    this.tokenRotationCount = 0;
    this.lastTokenRotation = 0;

    this.cancelTokenRefresh();

    // Signal logout to other tabs
    localStorage.setItem("okaeri_logout_event", Date.now().toString());
    setTimeout(() => localStorage.removeItem("okaeri_logout_event"), 100);
  }

  /**
   * Schedule automatic token refresh before expiry
   */
  private scheduleTokenRefresh(token: string): void {
    this.cancelTokenRefresh();

    const timeUntilRefresh = this.getTimeUntilExpiry(token) - TOKEN_EXPIRY.REFRESH_BUFFER;

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        // Execute all registered refresh callbacks
        for (const callback of this.tokenRefreshCallbacks) {
          try {
            await callback();
          } catch (error) {
            console.error("Token refresh callback failed:", error);
          }
        }
      }, timeUntilRefresh);
    }
  }

  /**
   * Pause token refresh (when tab is hidden)
   */
  private pauseTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Resume token refresh (when tab becomes visible)
   */
  private resumeTokenRefresh(): void {
    if (this.accessToken && !this.refreshTimer) {
      // Check if token needs refresh
      if (this.isTokenExpired(this.accessToken, TOKEN_EXPIRY.REFRESH_BUFFER)) {
        // Trigger immediate refresh
        this.tokenRefreshCallbacks.forEach((callback) => callback());
      } else {
        // Reschedule refresh
        this.scheduleTokenRefresh(this.accessToken);
      }
    }
  }

  /**
   * Cancel scheduled token refresh
   */
  private cancelTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Register callback for token refresh
   */
  onTokenRefresh(callback: () => Promise<void>): () => void {
    this.tokenRefreshCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.tokenRefreshCallbacks.delete(callback);
    };
  }

  /**
   * Validate token structure and claims
   */
  validateTokenStructure(token: string): { valid: boolean; error?: string } {
    const payload = this.parseToken(token);

    if (!payload) {
      return { valid: false, error: "Invalid token format" };
    }

    // Check required claims
    if (!payload.sub || !payload.email || !payload.role) {
      return { valid: false, error: "Missing required claims" };
    }

    // Check token age (prevent replay attacks)
    const tokenAge = Date.now() / 1000 - payload.iat;
    if (tokenAge > 24 * 60 * 60) {
      // Token older than 24 hours
      return { valid: false, error: "Token too old" };
    }

    // Check expiry
    if (this.isTokenExpired(token, 0)) {
      return { valid: false, error: SECURITY_ERROR_CODES.TOKEN_EXPIRED };
    }

    // Validate JWT ID if present (for revocation checking)
    if (payload.jti) {
      // In production, check against revocation list
      // This would require server-side validation
    }

    return { valid: true };
  }

  /**
   * Extract user info from token
   */
  getUserFromToken(token: string): Partial<User> | null {
    const payload = this.parseToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as any,
    };
  }

  /**
   * Broadcast token update to other tabs (without token value)
   */
  private broadcastTokenUpdate(): void {
    const event = new StorageEvent("storage", {
      key: "okaeri_token_update",
      newValue: Date.now().toString(),
      url: window.location.href,
    });
    window.dispatchEvent(event);
  }

  /**
   * Get token security metrics
   */
  getSecurityMetrics(): {
    rotationCount: number;
    lastRotation: number;
    isSecure: boolean;
    fingerprint: string | null;
  } {
    return {
      rotationCount: this.tokenRotationCount,
      lastRotation: this.lastTokenRotation,
      isSecure: this.accessToken !== null && this.tokenFingerprint !== null,
      fingerprint: this.tokenFingerprint,
    };
  }
}

// Export singleton instance
export const secureTokenManager = SecureTokenManager.getInstance();

// Remove global token storage declaration - no longer needed
// Tokens are now stored securely in memory within the class
