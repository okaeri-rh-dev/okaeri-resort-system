/**
 * Secure token management with automatic refresh and expiry handling
 * Implements JWT best practices and prevents XSS attacks
 */

import { TOKEN_EXPIRY, SECURITY_ERROR_CODES } from "./constants";
import type { User } from "@/types/common";

interface TokenPayload {
  exp: number;
  iat: number;
  sub: string;
  email: string;
  role: string;
  projectId?: string;
}

interface StoredToken {
  token: string;
  expiresAt: number;
  issuedAt: number;
}

export class TokenManager {
  private static instance: TokenManager;
  private refreshTimer: NodeJS.Timeout | null = null;
  private tokenRefreshCallbacks: Set<() => Promise<void>> = new Set();
  private refreshTokenMemory: string | null = null; // Memory storage for refresh token

  private constructor() {
    // Singleton pattern
    // In development mode with mock auth, restore tokens from sessionStorage
    if (this.isDevelopmentMockAuth()) {
      const storedRefreshToken = sessionStorage.getItem("mock_refresh_token");
      if (storedRefreshToken) {
        console.log("[TokenManager] Restoring mock refresh token from sessionStorage (dev mode)");
        this.refreshTokenMemory = storedRefreshToken;
      }
    }
  }

  /**
   * Check if running in development mode with mock authentication
   * SECURITY: This is the ONLY condition where browser storage should be used
   */
  private isDevelopmentMockAuth(): boolean {
    return (
      import.meta.env.DEV &&
      ((window as any).__VITE_ENV__?.VITE_MOCK_AUTH === "true" ||
        import.meta.env.VITE_MOCK_AUTH === "true")
    );
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Parse JWT token payload (without verification - verification happens server-side)
   */
  parseToken(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        console.error("Invalid token format");
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));
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
   * Store tokens securely (using memory for access token, httpOnly cookie preferred for refresh)
   * Note: In production, refresh token should be in httpOnly cookie set by server
   */
  storeTokens(accessToken: string, refreshToken: string): void {
    // Store access token in memory only (not in localStorage to prevent XSS)
    window.__OKAERI_ACCESS_TOKEN__ = accessToken;

    // Store refresh token in memory
    this.refreshTokenMemory = refreshToken;

    // SECURITY: Only use sessionStorage in development mode with mock auth
    if (this.isDevelopmentMockAuth()) {
      console.log("[TokenManager] Persisting mock refresh token to sessionStorage (dev mode only)");
      sessionStorage.setItem("mock_refresh_token", refreshToken);
    } else if (import.meta.env.DEV) {
      console.warn(
        "[TokenManager] Refresh token stored in memory only. " +
          "In production, use httpOnly cookies for refresh tokens."
      );
    }

    // Set up automatic refresh
    this.scheduleTokenRefresh(accessToken);
  }

  /**
   * Retrieve stored access token
   */
  getAccessToken(): string | null {
    return window.__OKAERI_ACCESS_TOKEN__ || null;
  }

  /**
   * Retrieve stored refresh token
   */
  getRefreshToken(): string | null {
    // First try memory storage
    if (this.refreshTokenMemory) {
      return this.refreshTokenMemory;
    }

    // SECURITY: Only check sessionStorage in development mode with mock auth
    if (this.isDevelopmentMockAuth()) {
      const storedToken = sessionStorage.getItem("mock_refresh_token");
      if (storedToken) {
        this.refreshTokenMemory = storedToken; // Cache in memory
        return storedToken;
      }
    }

    // In production, refresh tokens should be handled server-side via httpOnly cookie
    if (!import.meta.env.DEV) {
      console.error(
        "[SECURITY] Refresh tokens must be managed server-side via httpOnly cookies in production"
      );
    }

    return null;
  }

  /**
   * Clear all tokens
   */
  clearTokens(): void {
    // Clear access token from memory
    window.__OKAERI_ACCESS_TOKEN__ = undefined;

    // Clear refresh token from memory
    this.refreshTokenMemory = null;

    // SECURITY: Only clear sessionStorage in development mode with mock auth
    if (this.isDevelopmentMockAuth()) {
      sessionStorage.removeItem("mock_refresh_token");
    }

    this.cancelTokenRefresh();
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

    // Check expiry
    if (this.isTokenExpired(token, 0)) {
      return { valid: false, error: SECURITY_ERROR_CODES.TOKEN_EXPIRED };
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
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();

// Declare global variable for access token storage
declare global {
  interface Window {
    __OKAERI_ACCESS_TOKEN__?: string;
  }
}
