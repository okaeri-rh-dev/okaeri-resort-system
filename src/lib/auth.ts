import { supabase } from "./supabase";

/**
 * Authentication module for Phase 1
 * Provides basic admin authentication using Supabase Auth
 */

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

class AuthService {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Log generic error for debugging without exposing sensitive details
      console.log("Authentication failed");
      throw new Error("Invalid email or password");
    }

    return data;
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("Sign out failed");
      throw new Error("Sign out failed");
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
      console.log("Session retrieval failed");
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
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Set up session refresh interval
   */
  startSessionRefresh() {
    // Refresh session every 50 minutes (tokens typically expire in 60 minutes)
    const refreshInterval = setInterval(
      async () => {
        const {
          data: { session: _ },
          error,
        } = await supabase.auth.refreshSession();

        if (error) {
          console.log("Session refresh failed");
          clearInterval(refreshInterval);
          // Redirect to login if refresh fails
          window.location.href = "/login";
        }
      },
      50 * 60 * 1000
    ); // 50 minutes

    return () => clearInterval(refreshInterval);
  }

  /**
   * Initialize auth for the application
   */
  async initialize() {
    // Check for existing session on app load
    const session = await this.getSession();

    if (session) {
      // Start session refresh
      this.startSessionRefresh();
    }

    // Listen for auth changes
    this.onAuthStateChange((event, _session) => {
      if (event === "SIGNED_IN") {
        this.startSessionRefresh();
      } else if (event === "SIGNED_OUT") {
        // Clear any cached data from session storage (security improvement)
        sessionStorage.removeItem("booking-store");
        sessionStorage.removeItem("guest-store");
        sessionStorage.removeItem("unit-store");
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
    console.log("Authentication required");
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
