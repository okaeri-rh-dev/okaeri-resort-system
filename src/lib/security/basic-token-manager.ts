/**
 * Basic Token Manager for Phase 1.4
 * Simplified, secure JWT token management without over-engineering
 * Focuses on essential security measures appropriate for Phase 1.4
 */

import type { User } from "@/types/common";
import { basicAuditLogger } from "./basic-audit-logger";

interface TokenPayload {
  exp: number;
  iat: number;
  sub: string;
  email: string;
  role: string;
  projectId?: string;
}

interface TokenValidationResult {
  valid: boolean;
  error?: string;
  payload?: TokenPayload;
}

/**
 * Basic Token Manager - Phase 1.4 Implementation
 * Secure memory-only storage with basic validation
 */
export class BasicTokenManager {
  private static instance: BasicTokenManager;

  // Memory-only storage (secure)
  private accessToken: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshCallbacks: Set<() => Promise<void>> = new Set();

  // Basic configuration
  private readonly REFRESH_BUFFER_MS = 2 * 60 * 1000; // 2 minutes before expiry

  private constructor() {
    // Initialize with basic security monitoring
    this.initializeBasicSecurity();

    basicAuditLogger.logSecurityEvent("token_manager_initialized", {
      level: "info",
      details: { memoryOnly: true, phase: "1.4" },
    });
  }

  static getInstance(): BasicTokenManager {
    if (!BasicTokenManager.instance) {
      BasicTokenManager.instance = new BasicTokenManager();
    }
    return BasicTokenManager.instance;
  }

  /**
   * Initialize basic security measures
   */
  private initializeBasicSecurity(): void {
    // Guard for non-browser environments
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    // Listen for tab visibility changes to pause/resume token refresh
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pauseTokenRefresh();
      } else {
        this.resumeTokenRefresh();
      }
    });

    // Listen for logout events from other tabs
    window.addEventListener("storage", (event) => {
      if (event.key === "okaeri_logout_event") {
        this.clearTokens();
        basicAuditLogger.logAuthEvent("logout", {
          success: true,
          reason: "cross_tab_logout",
        });
      }
    });
  }

  /**
   * Parse JWT token payload safely
   */
  parseToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        basicAuditLogger.logSecurityViolation("invalid_token_format", {
          reason: "incorrect_parts_count",
          partsCount: parts.length,
        });
        return null;
      }

      // Validate token structure (basic security check)
      if (
        !/^[A-Za-z0-9_-]+$/.test(parts[0]!) ||
        !/^[A-Za-z0-9_-]+$/.test(parts[1]!) ||
        !/^[A-Za-z0-9_-]+$/.test(parts[2]!)
      ) {
        basicAuditLogger.logSecurityViolation("invalid_token_characters", {
          reason: "contains_invalid_characters",
        });
        return null;
      }

      // Decode payload
      const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
      const padding = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
      const normalized = base64 + padding;

      // Use safe decoding method
      const atobSafe =
        typeof atob !== "undefined"
          ? atob
          : (b64: string) => Buffer.from(b64, "base64").toString("binary");

      const payload = JSON.parse(atobSafe(normalized));

      // Validate required fields
      if (!payload.exp || !payload.iat || !payload.sub || !payload.email) {
        basicAuditLogger.logSecurityViolation("missing_required_claims", {
          claims: {
            exp: !!payload.exp,
            iat: !!payload.iat,
            sub: !!payload.sub,
            email: !!payload.email,
          },
        });
        return null;
      }

      return payload as TokenPayload;
    } catch (error) {
      basicAuditLogger.logSecurityViolation("token_parsing_failed", {
        error: error instanceof Error ? error.message : "unknown_error",
      });
      return null;
    }
  }

  /**
   * Validate token structure and expiry
   */
  validateToken(token: string): TokenValidationResult {
    // Allow mock tokens in development
    if (import.meta.env.DEV && token.startsWith("mock-")) {
      return {
        valid: true,
        payload: {
          sub: "mock-user",
          email: "mock@example.com",
          role: "user",
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        },
      };
    }

    const payload = this.parseToken(token);
    if (!payload) {
      return { valid: false, error: "Invalid token format" };
    }

    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      basicAuditLogger.logSecurityEvent("token_expired", {
        level: "warn",
        details: { expired_at: payload.exp, current_time: now },
      });
      return { valid: false, error: "Token expired" };
    }

    // Check if token is too old (prevent replay attacks)
    const tokenAge = now - payload.iat;
    if (tokenAge > 24 * 60 * 60) {
      // 24 hours
      basicAuditLogger.logSecurityViolation("token_too_old", {
        age_hours: tokenAge / 3600,
      });
      return { valid: false, error: "Token too old" };
    }

    return { valid: true, payload };
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(token: string, bufferMs: number = this.REFRESH_BUFFER_MS): boolean {
    const validation = this.validateToken(token);
    if (!validation.valid || !validation.payload) return true;

    const now = Math.floor(Date.now() / 1000);
    const expiryWithBuffer = validation.payload.exp - Math.floor(bufferMs / 1000);

    return now >= expiryWithBuffer;
  }

  /**
   * Store access token securely (memory only)
   */
  storeTokens(accessToken: string, refreshToken?: string): void {
    // Validate token before storing (skip for mock tokens)
    if (!import.meta.env.DEV || !accessToken.startsWith("mock-")) {
      const validation = this.validateToken(accessToken);
      if (!validation.valid) {
        throw new Error(validation.error || "Invalid token");
      }
    }

    // Store in memory only
    this.accessToken = accessToken;

    basicAuditLogger.logSecurityEvent("tokens_stored", {
      level: "info",
      details: {
        storage_type: "memory_only",
        has_refresh_token: !!refreshToken,
      },
    });

    // Schedule automatic refresh
    this.scheduleTokenRefresh();

    // Broadcast token update (without token value)
    this.broadcastTokenUpdate();
  }

  /**
   * Retrieve stored access token
   */
  getAccessToken(): string | null {
    if (!this.accessToken) {
      return null;
    }

    // Basic validation of stored token
    if (!this.validateToken(this.accessToken).valid) {
      basicAuditLogger.logSecurityEvent("stored_token_invalid", {
        level: "warn",
        details: { action: "clearing_invalid_token" },
      });
      this.clearTokens();
      return null;
    }

    return this.accessToken;
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    this.accessToken = null;
    this.cancelTokenRefresh();

    basicAuditLogger.logSecurityEvent("tokens_cleared", {
      level: "info",
      details: { reason: "manual_clear" },
    });

    // Signal logout to other tabs
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("okaeri_logout_event", Date.now().toString());
      setTimeout(() => localStorage.removeItem("okaeri_logout_event"), 1000);
    }
  }

  /**
   * Extract user info from token
   */
  getUserFromToken(token: string): Partial<User> | null {
    const validation = this.validateToken(token);
    if (!validation.valid || !validation.payload) {
      return null;
    }

    const { payload } = validation;
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role as any,
    };
  }

  /**
   * Register callback for token refresh
   */
  onTokenRefresh(callback: () => Promise<void>): () => void {
    this.tokenRefreshCallbacks.add(callback);

    return () => {
      this.tokenRefreshCallbacks.delete(callback);
    };
  }

  /**
   * Get time until token expiry
   */
  getTimeUntilExpiry(): number {
    if (!this.accessToken) return 0;

    const validation = this.validateToken(this.accessToken);
    if (!validation.valid || !validation.payload) return 0;

    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = (validation.payload.exp - now) * 1000;

    return Math.max(0, timeUntilExpiry);
  }

  /**
   * Force token refresh
   */
  async forceTokenRefresh(): Promise<void> {
    basicAuditLogger.logSecurityEvent("forced_token_refresh", {
      level: "info",
      details: { reason: "manual_refresh" },
    });

    // Execute all refresh callbacks
    for (const callback of this.tokenRefreshCallbacks) {
      try {
        await callback();
      } catch (error) {
        basicAuditLogger.logSecurityEvent("token_refresh_failed", {
          level: "error",
          details: {
            error: error instanceof Error ? error.message : "unknown_error",
          },
        });
      }
    }
  }

  /**
   * Schedule automatic token refresh
   */
  private scheduleTokenRefresh(): void {
    this.cancelTokenRefresh();

    if (!this.accessToken) return;

    const timeUntilRefresh = this.getTimeUntilExpiry() - this.REFRESH_BUFFER_MS;

    if (timeUntilRefresh > 0) {
      this.refreshTimer = setTimeout(async () => {
        basicAuditLogger.logSecurityEvent("auto_token_refresh", {
          level: "info",
        });

        await this.forceTokenRefresh();
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
      // Check if immediate refresh is needed
      if (this.isTokenExpired(this.accessToken)) {
        this.forceTokenRefresh();
      } else {
        this.scheduleTokenRefresh();
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
   * Broadcast token update to other tabs
   */
  private broadcastTokenUpdate(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("okaeri_token_update", Date.now().toString());
      setTimeout(() => localStorage.removeItem("okaeri_token_update"), 100);
    }
  }

  /**
   * Get basic security status
   */
  getSecurityStatus(): {
    hasToken: boolean;
    tokenValid: boolean;
    expiresIn: number;
    refreshScheduled: boolean;
  } {
    const hasToken = !!this.accessToken;
    const tokenValid = hasToken ? this.validateToken(this.accessToken!).valid : false;
    const expiresIn = this.getTimeUntilExpiry();
    const refreshScheduled = !!this.refreshTimer;

    return {
      hasToken,
      tokenValid,
      expiresIn,
      refreshScheduled,
    };
  }
}

// Export singleton instance
export const basicTokenManager = BasicTokenManager.getInstance();
