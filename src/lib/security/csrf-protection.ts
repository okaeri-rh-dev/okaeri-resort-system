/**
 * CSRF Protection Implementation
 * Implements synchronizer token pattern for CSRF prevention
 * Addresses critical security vulnerability from audit
 */

import { apiClient } from "@/lib/api-client";

export interface CSRFToken {
  token: string;
  expiresAt: number;
  sessionId: string;
}

/**
 * CSRF Protection Manager
 * Handles CSRF token generation, validation, and rotation
 */
export class CSRFProtectionManager {
  private static instance: CSRFProtectionManager;
  private csrfToken: string | null = null;
  private tokenExpiry: number = 0;
  private sessionId: string | null = null;
  private tokenRefreshPromise: Promise<void> | null = null;

  private readonly TOKEN_LIFETIME = 60 * 60 * 1000; // 1 hour
  private readonly TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.initializeCSRFProtection();
  }

  static getInstance(): CSRFProtectionManager {
    if (!CSRFProtectionManager.instance) {
      CSRFProtectionManager.instance = new CSRFProtectionManager();
    }
    return CSRFProtectionManager.instance;
  }

  /**
   * Initialize CSRF protection
   */
  private async initializeCSRFProtection(): Promise<void> {
    // Generate session ID for CSRF token binding
    this.sessionId = this.generateSessionId();

    // Fetch initial CSRF token
    await this.refreshCSRFToken();

    // Set up automatic token refresh
    this.scheduleTokenRefresh();

    // Add beforeunload handler to clean up
    window.addEventListener("beforeunload", () => {
      this.cleanup();
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Get current CSRF token
   */
  async getCSRFToken(): Promise<string | null> {
    // Check if token needs refresh
    if (this.isTokenExpired()) {
      await this.refreshCSRFToken();
    }

    return this.csrfToken;
  }

  /**
   * Refresh CSRF token from server
   */
  private async refreshCSRFToken(): Promise<void> {
    // Prevent multiple simultaneous refresh requests
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.performTokenRefresh();

    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  /**
   * Perform actual token refresh
   */
  private async performTokenRefresh(): Promise<void> {
    try {
      // Request new CSRF token from server
      const response = await fetch("/api/csrf-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
        }),
        credentials: "include", // Include cookies
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }

      const data: CSRFToken = await response.json();

      // Validate response
      if (!data.token || !data.expiresAt) {
        throw new Error("Invalid CSRF token response");
      }

      // Store new token
      this.csrfToken = data.token;
      this.tokenExpiry = data.expiresAt;

      // Schedule next refresh
      this.scheduleTokenRefresh();

      // Log token refresh for audit
      this.logCSRFEvent("token_refreshed");
    } catch (error) {
      console.error("Failed to refresh CSRF token:", error);
      this.logCSRFEvent("token_refresh_failed", { error: error.message });

      // Retry after delay
      setTimeout(() => this.refreshCSRFToken(), 5000);
    }
  }

  /**
   * Check if token is expired
   */
  private isTokenExpired(): boolean {
    if (!this.csrfToken || !this.tokenExpiry) {
      return true;
    }

    const now = Date.now();
    return now >= this.tokenExpiry - this.TOKEN_REFRESH_BUFFER;
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    if (!this.tokenExpiry) return;

    const timeUntilRefresh = this.tokenExpiry - Date.now() - this.TOKEN_REFRESH_BUFFER;

    if (timeUntilRefresh > 0) {
      setTimeout(() => {
        this.refreshCSRFToken();
      }, timeUntilRefresh);
    }
  }

  /**
   * Add CSRF token to request headers
   */
  addCSRFHeader(headers: HeadersInit): HeadersInit {
    if (!this.csrfToken) {
      console.warn("CSRF token not available");
      return headers;
    }

    if (headers instanceof Headers) {
      headers.set("X-CSRF-Token", this.csrfToken);
      headers.set("X-Session-Id", this.sessionId || "");
    } else if (Array.isArray(headers)) {
      headers.push(["X-CSRF-Token", this.csrfToken]);
      headers.push(["X-Session-Id", this.sessionId || ""]);
    } else {
      (headers as Record<string, string>)["X-CSRF-Token"] = this.csrfToken;
      (headers as Record<string, string>)["X-Session-Id"] = this.sessionId || "";
    }

    return headers;
  }

  /**
   * Validate CSRF token in response
   */
  validateResponse(response: Response): boolean {
    const responseToken = response.headers.get("X-CSRF-Token");

    if (responseToken && responseToken !== this.csrfToken) {
      console.error("CSRF token mismatch in response");
      this.logCSRFEvent("token_mismatch");
      return false;
    }

    return true;
  }

  /**
   * Handle CSRF validation failure
   */
  handleCSRFFailure(): void {
    // Clear current token
    this.csrfToken = null;
    this.tokenExpiry = 0;

    // Log security event
    this.logCSRFEvent("csrf_validation_failed");

    // Redirect to login for security
    window.location.href = "/login?reason=security_check";
  }

  /**
   * Log CSRF-related events
   */
  private logCSRFEvent(event: string, details?: any): void {
    const eventData = {
      event: `csrf.${event}`,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      details,
    };

    // Send to audit logger if available
    if (window.auditLogger) {
      window.auditLogger.logSecurityEvent("csrf", eventData);
    }

    // Also log to console in development
    if (import.meta.env.DEV) {
      console.log("CSRF Event:", eventData);
    }
  }

  /**
   * Generate double-submit cookie value
   */
  generateDoubleSubmitCookie(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");

    // Set cookie (should be done server-side in production)
    document.cookie = `csrf_token=${token}; path=/; SameSite=Strict; Secure`;

    return token;
  }

  /**
   * Verify double-submit cookie
   */
  verifyDoubleSubmitCookie(headerToken: string): boolean {
    const cookies = document.cookie.split(";");
    const csrfCookie = cookies.find((c) => c.trim().startsWith("csrf_token="));

    if (!csrfCookie) {
      return false;
    }

    const cookieToken = csrfCookie.split("=")[1];
    return cookieToken === headerToken;
  }

  /**
   * Clean up CSRF protection
   */
  private cleanup(): void {
    this.csrfToken = null;
    this.tokenExpiry = 0;
    this.sessionId = null;
  }

  /**
   * Get CSRF protection status
   */
  getStatus(): {
    hasToken: boolean;
    isExpired: boolean;
    sessionId: string | null;
    expiresAt: number;
  } {
    return {
      hasToken: this.csrfToken !== null,
      isExpired: this.isTokenExpired(),
      sessionId: this.sessionId,
      expiresAt: this.tokenExpiry,
    };
  }
}

// Export singleton instance
export const csrfProtection = CSRFProtectionManager.getInstance();

/**
 * CSRF Protected Fetch Wrapper
 * Automatically adds CSRF tokens to requests
 */
export async function csrfFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";

  // Only add CSRF token for state-changing requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = await csrfProtection.getCSRFToken();

    if (!token) {
      throw new Error("CSRF token not available");
    }

    // Add CSRF token to headers
    const headers = new Headers(options.headers || {});
    headers.set("X-CSRF-Token", token);

    options.headers = headers;
  }

  // Perform fetch
  const response = await fetch(url, options);

  // Validate response CSRF token if present
  if (!csrfProtection.validateResponse(response)) {
    csrfProtection.handleCSRFFailure();
    throw new Error("CSRF validation failed");
  }

  return response;
}

/**
 * Hook for React components to use CSRF protection
 */
export function useCSRFToken() {
  const [token, setToken] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    csrfProtection.getCSRFToken().then((token) => {
      setToken(token);
      setLoading(false);
    });
  }, []);

  return { token, loading };
}

// Declare global for audit logger
declare global {
  interface Window {
    auditLogger?: any;
  }
}

import React from "react";
