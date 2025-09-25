import { supabase } from "./supabase";
import type { AuthSession, AuthChangeEvent } from "@/types/supabase";

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

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
}

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

// ============================================
// AUTH SERVICE CLASS
// ============================================

class AuthService {
  private refreshTimeout: NodeJS.Timeout | null = null;
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
    } catch (error) {
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
   * Stop session refresh timer
   */
  private stopSessionRefresh() {
    if (this.refreshTimeout) {
      clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
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
