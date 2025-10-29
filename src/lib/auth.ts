import { logger } from "@/lib/logger";
import type { AuthChangeEvent, AuthSession } from "@/types/supabase";

import { supabase } from "./supabase";

/**
 * Authentication module for Phase 1
 * Provides basic admin authentication using Supabase Auth
 * Enhanced with security hardening for production deployment
 */

// ============================================
// CONSTANTS & CONFIGURATIONS
// ============================================

// Validated routes for redirect security
const VALID_ROUTES = [
  "/login",
  "/dashboard",
  "/bookings",
  "/units",
  "/guests",
  "/expenses",
  "/payments",
  "/availability",
  "/settings",
];

// Session refresh timing configuration
const MIN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
const MAX_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes

// Rate limiting configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 30 * 60 * 1000; // 30 minutes

// Session warning timing
const SESSION_WARNING_TIME = 5 * 60 * 1000; // 5 minutes before expiry

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

// AuthSession type imported from @/types/supabase
// Keep AuthUser as local type for auth service
export type { AuthSession } from "@/types/supabase";

// Rate limiting types
interface FailedAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

// CSRF protection
interface CSRFConfig {
  token?: string;
  expiresAt?: number;
}

// Session callback types
type SessionExpiredCallback = () => void;
type SessionWarningCallback = (minutesLeft: number) => void;

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validates if a route is safe for redirect
 */
function isValidRoute(route: string): boolean {
  return VALID_ROUTES.some((validRoute) => route.startsWith(validRoute));
}

/**
 * Generates a random session refresh interval
 */
function getRandomRefreshInterval(): number {
  return (
    Math.floor(Math.random() * (MAX_REFRESH_INTERVAL - MIN_REFRESH_INTERVAL + 1)) +
    MIN_REFRESH_INTERVAL
  );
}

/**
 * Performs secure cleanup of all sensitive data
 */
function secureCleanup(): void {
  // Clear session storage
  sessionStorage.clear();

  // Clear local storage
  localStorage.clear();

  // Clear cookies if any
  document.cookie.split(";").forEach((c) => {
    document.cookie = c
      .replace(/^ +/, "")
      .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
  });
}

/**
 * Generates a cryptographically secure random token
 */
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Sanitizes authentication errors to prevent information leakage
 */
function sanitizeAuthError(): string {
  // Always return a generic error message
  return "Authentication failed. Please check your credentials.";
}

/**
 * Safe redirect that validates the destination
 */
function safeRedirect(url: string): void {
  if (isValidRoute(url)) {
    window.location.replace(url);
  } else {
    // Redirect to login for invalid routes
    window.location.replace("/login");
  }
}

// ============================================
// AUTH SERVICE CLASS
// ============================================

class AuthService {
  private refreshTimeout: NodeJS.Timeout | null = null;
  private warningTimeout: NodeJS.Timeout | null = null;
  private failedAttempts = new Map<string, FailedAttempt>();
  private csrfConfig: CSRFConfig = {};
  private sessionExpiredCallbacks: SessionExpiredCallback[] = [];
  private sessionWarningCallbacks: SessionWarningCallback[] = [];
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Sanitized error logging - only in development
        if (process.env.NODE_ENV === "development") {
          console.error("Auth error:", error.message);
        }
        // Generic error message to prevent information leakage
        throw new Error("Authentication failed. Please check your credentials.");
      }

      // Start session refresh on successful login
      this.scheduleSessionRefresh();

      return data;
    } catch (_error) {
      // Ensure consistent error messages
      throw new Error("Authentication failed. Please check your credentials.");
    }
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      // Stop session refresh timer
      this.stopSessionRefresh();

      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Sign out error:", error.message);
        }
        throw new Error("Sign out failed. Please try again.");
      }

      // Perform secure cleanup
      secureCleanup();
    } catch (error) {
      // Ensure cleanup happens even on error
      secureCleanup();
      throw new Error("Sign out failed. Please try again.");
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Session retrieval error:", error.message);
      }
      return null;
    }

    return session;
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    const session = await this.getSession();
    return session?.user || null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  }

  /**
   * Require authentication - throws if not authenticated
   */
  async requireAuth() {
    const session = await this.getSession();

    if (!session) {
      throw new Error("Authentication required. Please sign in.");
    }

    return session;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: AuthChangeEvent, session: AuthSession | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Schedule next session refresh with random interval
   */
  private scheduleSessionRefresh() {
    const scheduleNextRefresh = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.refreshSession();

        if (error || !session) {
          this.handleSessionExpired();
          return;
        }

        // Schedule next refresh with random interval
        const interval = getRandomRefreshInterval();
        this.refreshTimeout = setTimeout(scheduleNextRefresh, interval);
      } catch (error) {
        this.handleSessionExpired();
      }
    };

    // Start with random initial interval
    const initialInterval = getRandomRefreshInterval();
    this.refreshTimeout = setTimeout(scheduleNextRefresh, initialInterval);
  }

  /**
   * Handle expired session securely
   */
  private handleSessionExpired() {
    this.stopSessionRefresh();

    // Validate redirect route
    const loginRoute = "/login";
    if (isValidRoute(loginRoute)) {
      // Clear sensitive data before redirect
      secureCleanup();

      // Use location.replace to prevent back button access
      window.location.replace(loginRoute);
    }
  }

  /**
   * Start session refresh (public method for backward compatibility)
   */
  startSessionRefresh() {
    this.scheduleSessionRefresh();
    return () => this.stopSessionRefresh();
  }

  /**
   * Stop session refresh timer (public method for testing)
   */
  stopSessionRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    if (this.warningTimeout) {
      clearTimeout(this.warningTimeout);
      this.warningTimeout = null;
    }
  }

  /**
   * Refresh current session
   */
  async refreshSession() {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error || !session) {
        throw new Error("Session refresh failed");
      }

      return session;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Session refresh failed:", error);
      }
      throw error;
    }
  }

  /**
   * Validate if a route is safe for redirect
   */
  isValidRoute(route: string): boolean {
    return isValidRoute(route);
  }

  /**
   * Handle redirect safely
   */
  handleRedirect(url: string): void {
    safeRedirect(url);
  }

  /**
   * Prevent back button access after logout
   */
  preventBackButtonAccess(): void {
    // Clear history and replace current state
    window.history.pushState(null, "", window.location.href);
    window.history.replaceState(null, "", window.location.href);

    // Handle popstate events
    window.addEventListener("popstate", () => {
      window.history.pushState(null, "", window.location.href);
      window.location.replace("/login");
    });
  }

  /**
   * Clear sensitive data from clipboard
   */
  async clearSensitiveClipboard(): Promise<void> {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText("");
    }
  }

  /**
   * Sanitize authentication errors
   */
  sanitizeAuthError(_error: unknown): string {
    return sanitizeAuthError();
  }

  /**
   * Log authentication errors (development only)
   */
  logAuthError(error: Error): void {
    if (process.env.NODE_ENV === "development") {
      logger.info("Auth Error:", { message: error.message, name: error.name, stack: error.stack });
    }
  }

  /**
   * Register session expired callback
   */
  onSessionExpired(callback: SessionExpiredCallback): void {
    this.sessionExpiredCallbacks.push(callback);
  }

  /**
   * Register session warning callback
   */
  onSessionWarning(callback: SessionWarningCallback): void {
    this.sessionWarningCallbacks.push(callback);
  }

  /**
   * Check session expiry and trigger callbacks
   */
  async checkSessionExpiry(): Promise<void> {
    const session = await this.getSession();

    if (!session) {
      // Session expired
      this.sessionExpiredCallbacks.forEach((callback) => callback());
      this.handleSessionExpired();
      return;
    }

    if (session.expires_at) {
      const expiresAt = session.expires_at * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;

      if (timeUntilExpiry <= 0) {
        // Session expired
        this.sessionExpiredCallbacks.forEach((callback) => callback());
        this.handleSessionExpired();
      } else if (timeUntilExpiry <= SESSION_WARNING_TIME) {
        // Session expiring soon
        const minutesLeft = Math.ceil(timeUntilExpiry / (60 * 1000));
        this.sessionWarningCallbacks.forEach((callback) => callback(minutesLeft));
      }
    }
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(): string {
    const token = generateSecureToken();
    const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour

    this.csrfConfig = { token, expiresAt };
    sessionStorage.setItem("csrf_token", token);

    return token;
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(token: string): boolean {
    const storedToken = sessionStorage.getItem("csrf_token");
    const isValid =
      storedToken === token &&
      this.csrfConfig.token === token &&
      (this.csrfConfig.expiresAt || 0) > Date.now();

    return isValid;
  }

  /**
   * Get secure headers for API requests
   */
  getSecureHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.csrfConfig.token) {
      headers["X-CSRF-Token"] = this.csrfConfig.token;
    }

    return headers;
  }

  /**
   * Validate request with CSRF protection
   */
  validateRequest(request: { headers: Record<string, string> }): boolean {
    const csrfToken = request.headers["X-CSRF-Token"];
    return csrfToken ? this.validateCSRFToken(csrfToken) : false;
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(email: string): void {
    const now = Date.now();
    const attempt = this.failedAttempts.get(email) || { count: 0, lastAttempt: 0 };

    attempt.count += 1;
    attempt.lastAttempt = now;

    if (attempt.count >= MAX_FAILED_ATTEMPTS) {
      attempt.lockedUntil = now + LOCKOUT_DURATION;
    }

    this.failedAttempts.set(email, attempt);
  }

  /**
   * Get failed login attempts count
   */
  getFailedAttempts(email: string): number {
    const attempt = this.failedAttempts.get(email);
    if (!attempt) return 0;

    // Check if lockout has expired
    if (attempt.lockedUntil && attempt.lockedUntil <= Date.now()) {
      this.failedAttempts.delete(email);
      return 0;
    }

    return attempt.count;
  }

  /**
   * Check if account is locked
   */
  isAccountLocked(email: string): boolean {
    const attempt = this.failedAttempts.get(email);
    if (!attempt || !attempt.lockedUntil) return false;

    if (attempt.lockedUntil <= Date.now()) {
      // Lockout expired
      this.failedAttempts.delete(email);
      return false;
    }

    return true;
  }

  /**
   * Reset failed login attempts
   */
  resetFailedAttempts(email: string): void {
    this.failedAttempts.delete(email);
  }

  /**
   * Initialize auth for the application
   */
  async initialize() {
    // Check for existing session on app load
    const session = await this.getSession();

    if (session) {
      // Start session refresh with random intervals
      this.scheduleSessionRefresh();
    }

    // Listen for auth changes
    this.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        this.scheduleSessionRefresh();
      } else if (event === "SIGNED_OUT") {
        this.stopSessionRefresh();
        // Perform comprehensive secure cleanup
        secureCleanup();
      } else if (event === "TOKEN_REFRESHED" && session) {
        // Ensure refresh timer is running after token refresh
        this.stopSessionRefresh();
        this.scheduleSessionRefresh();
      }
    });

    return session;
  }
}

// Export singleton instance
export const auth = new AuthService();

// Export auth guard for protecting routes
export const authGuard = async (): Promise<boolean> => {
  try {
    await auth.requireAuth();
    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Auth guard failed:", error);
    }
    return false;
  }
};

// Export role-based access control helper
export const hasRole = async (_requiredRole: string): Promise<boolean> => {
  try {
    const user = await auth.getCurrentUser();
    // For Phase 1, all authenticated users are considered admins
    // In Phase 2, implement proper role checking from user metadata
    return !!user;
  } catch (error) {
    return false;
  }
};
