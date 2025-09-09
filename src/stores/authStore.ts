/**
 * Authentication store using Zustand with enhanced security
 * Implements secure token management, session monitoring, and audit logging
 */

import { apiClient } from "@/lib/api-client";
import { secureTokenManager as tokenManager } from "@/lib/security/secure-token-manager";
import type { AuthState, User } from "@/types/common";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { sessionMonitor } from "@/lib/security/session-monitor";

import { auditLogger } from "@/lib/security/audit-logger";

import { rateLimiter } from "@/lib/security/rate-limiter";

import { permissionGuard } from "@/lib/security/permission-guard";

import { AUDIT_EVENTS, RATE_LIMITS, TOKEN_EXPIRY } from "@/lib/security/constants";

// [PHASE 1-4 MOCK AUTH - Remove in Phase 5.2]
import { config } from "@/config";
import { mockAuthService } from "@/mocks/auth-service";

interface AuthActions {
  // Auth actions - Staff only
  login: (email: string, password: string, options?: { rememberMe?: boolean }) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>; // PHASE 1 TEMPORARY: Renamed to avoid collision
  refreshSession: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<void>;

  // User actions
  updateProfile: (data: Partial<User>) => Promise<void>;
  fetchCurrentUser: () => Promise<void>;

  // State setters
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setRefreshToken: (refreshToken: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;

  // Utility
  checkAuth: () => boolean;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (role: string) => boolean;
  initializeAuth: () => Promise<void>;
}

interface LoginResponse {
  user: User;
  accessToken: string; // Changed from 'token' to match API response
  refreshToken: string;
  expiresIn?: number;
}

// Enhanced auth store without localStorage persistence for security
export const useAuthStore = create<AuthState & AuthActions>()(
  devtools(
    // eslint-disable-next-line max-lines-per-function
    immer((set, get) => ({
      // Initial state
      user: null,
      token: null,
      refreshToken: null,
      sessionExpiry: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Authentication actions with enhanced security
      login: async (email: string, password: string, options?: { rememberMe?: boolean }) => {
        // [PHASE 1-4 MOCK AUTH - Remove this block in Phase 5.2]
        if (import.meta.env.DEV && config.development.mockAuth) {
          set((state) => {
            state.isLoading = true;
            state.error = null;
          });

          try {
            const mockResponse = await mockAuthService.login(email, password);
            const { user, token, refreshToken } = mockResponse;

            // Use existing token management
            tokenManager.storeTokens(token, refreshToken);
            // Token is managed by TokenManager, not directly by apiClient

            // Phase 1-4 Mock Auth: rememberMe extends session timeout only
            // Phase 5.2 Real Auth: Will request longer-lived tokens from backend
            // This maintains consistent UX while preventing test drift
            // Start session monitoring with Remember Me support
            const sessionTimeout = options?.rememberMe
              ? 7 * 24 * 60 * 60 * 1000 // 7 days for Remember Me
              : TOKEN_EXPIRY.SESSION_TIMEOUT; // Default 1 hour

            sessionMonitor.start({
              timeout: sessionTimeout,
              warningTime: TOKEN_EXPIRY.SESSION_WARNING,
              onTimeout: () => {
                get().logout();
              },
              onWarning: (timeLeft) => {
                console.warn(`Session will expire in ${timeLeft / 1000} seconds`);
              },
            });

            set((state) => {
              state.user = user;
              state.token = token;
              state.refreshToken = refreshToken;
              state.sessionExpiry = Date.now() + TOKEN_EXPIRY.ACCESS_TOKEN;
              state.isAuthenticated = true;
              state.isLoading = false;
            });

            // Debug logging for auth state
            console.log("[AUTH] Login successful:", {
              user: user.email,
              isAuthenticated: get().isAuthenticated,
              hasToken: !!tokenManager.getAccessToken(),
            });

            auditLogger.logAuth("login", user, true);
            return;
          } catch (error: any) {
            set((state) => {
              state.isLoading = false;
              state.error = error.message || "Login failed";
            });
            throw error;
          }
        }
        // [END PHASE 1-4 MOCK AUTH]

        // Check rate limit
        const rateLimit = rateLimiter.check("login", {
          max: RATE_LIMITS.LOGIN_ATTEMPTS.MAX,
          window: RATE_LIMITS.LOGIN_ATTEMPTS.WINDOW,
          identifier: email,
        });

        if (!rateLimit.allowed) {
          const error = `Too many login attempts. Please try again in ${rateLimit.retryAfter} seconds.`;
          set((state) => {
            state.error = error;
          });
          auditLogger.logAuth("login", null, false, { reason: "rate_limit" });
          throw new Error(error);
        }

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await apiClient.post<LoginResponse>("/auth/login", {
            email,
            password,
            rememberMe: options?.rememberMe, // Include rememberMe in request
          });

          const { user, accessToken, refreshToken } = response.data; // Use accessToken

          // Validate token structure
          const validation = tokenManager.validateTokenStructure(accessToken);
          if (!validation.valid) {
            throw new Error(validation.error || "Invalid token received");
          }

          // Store tokens securely (not in localStorage)
          tokenManager.storeTokens(accessToken, refreshToken);

          // Set auth token in API client
          // Token is managed by TokenManager, not directly by apiClient

          // Start session monitoring with Remember Me support
          const sessionTimeout = options?.rememberMe
            ? 7 * 24 * 60 * 60 * 1000 // 7 days for Remember Me
            : TOKEN_EXPIRY.SESSION_TIMEOUT; // Default 1 hour

          sessionMonitor.start({
            timeout: sessionTimeout,
            warningTime: TOKEN_EXPIRY.SESSION_WARNING,
            onTimeout: () => {
              get().logout();
            },
            onWarning: (timeLeft) => {
              console.warn(`Session will expire in ${timeLeft / 1000} seconds`);
            },
          });

          // Register token refresh callback
          tokenManager.onTokenRefresh(async () => {
            await get().refreshTokens();
          });

          set((state) => {
            state.user = user;
            state.token = accessToken; // Use accessToken from response
            state.refreshToken = refreshToken;
            state.sessionExpiry = Date.now() + TOKEN_EXPIRY.ACCESS_TOKEN;
            state.isAuthenticated = true;
            state.isLoading = false;
          });

          // Log successful login
          auditLogger.logAuth("login", user, true);
          rateLimiter.trackSuccess("login");
        } catch (error: any) {
          set((state) => {
            state.isLoading = false;
            state.error = error.message || "Login failed";
          });

          // Log failed login
          auditLogger.logAuth("login", null, false, { error: error.message });
          rateLimiter.trackFailure("login");

          throw error;
        }
      },

      logout: async () => {
        // [PHASE 1-4 MOCK AUTH - Remove this block in Phase 5.2]
        if (import.meta.env.DEV && config.development.mockAuth) {
          await mockAuthService.logout();
          sessionMonitor.stop();
          tokenManager.clearTokens();
          // Token clearing is managed by TokenManager, not directly by apiClient

          set((state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.error = null;
          });
          return;
        }
        // [END PHASE 1-4 MOCK AUTH]

        const { token } = get();
        const { user } = get();

        set((state) => {
          state.isLoading = true;
        });

        try {
          if (token) {
            await apiClient.post("/auth/logout");
          }
        } catch (error) {
          console.error("Logout error:", error);
        } finally {
          // Stop session monitoring
          sessionMonitor.stop();

          // Clear tokens securely
          tokenManager.clearTokens();

          // Clear auth token from API client
          // Token clearing is managed by TokenManager, not directly by apiClient

          // Log logout
          auditLogger.logAuth("logout", user, true);

          set((state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
            state.isLoading = false;
            state.error = null;
          });
        }
      },

      // Note: Staff registration removed - admin creates accounts directly in database

      refreshTokens: async () => {
        // PHASE 1 TEMPORARY: Renamed to avoid collision with state property
        const refreshToken = tokenManager.getRefreshToken();
        const { user } = get();

        if (!refreshToken) {
          throw new Error("No refresh token available");
        }

        // [PHASE 1-4 MOCK AUTH - Remove this block in Phase 5.2]
        if (import.meta.env.DEV && config.development.mockAuth) {
          try {
            const response = await mockAuthService.refresh(refreshToken);
            const { token, refreshToken: newRefreshToken } = response;

            tokenManager.storeTokens(token, newRefreshToken);
            // Token is managed by TokenManager, not directly by apiClient

            set((state) => {
              state.token = token;
              state.refreshToken = newRefreshToken;
              state.sessionExpiry = Date.now() + TOKEN_EXPIRY.ACCESS_TOKEN;
            });

            sessionMonitor.extendSession();
            return;
          } catch (error) {
            get().logout();
            throw error;
          }
        }
        // [END PHASE 1-4 MOCK AUTH]

        try {
          const response = await apiClient.post<{
            accessToken: string;
            refreshToken: string;
            expiresIn?: number;
          }>("/auth/refresh", { refreshToken });

          const { accessToken, refreshToken: newRefreshToken } = response.data;

          // Validate new token
          const validation = tokenManager.validateTokenStructure(accessToken);
          if (!validation.valid) {
            throw new Error(validation.error || "Invalid token received");
          }

          // Store new tokens securely
          tokenManager.storeTokens(accessToken, newRefreshToken);

          // Update auth token in API client
          // Token is managed by TokenManager, not directly by apiClient

          set((state) => {
            state.token = accessToken; // Use accessToken from response
            state.refreshToken = newRefreshToken;
            state.sessionExpiry = Date.now() + TOKEN_EXPIRY.ACCESS_TOKEN;
          });

          // Log token refresh
          auditLogger.logAuth("refresh", user, true);

          // Extend session
          sessionMonitor.extendSession();
        } catch (error: any) {
          // Log failed refresh
          auditLogger.logAuth("refresh", user, false, { error: error.message });

          // If refresh fails, logout user
          get().logout();
          throw error;
        }
      },

      refreshSession: async () => {
        // This is a wrapper to maintain compatibility with API client
        // It calls the existing refreshTokens method
        await get().refreshTokens();
      },

      resetPassword: async (email: string) => {
        // Check rate limit
        const rateLimit = rateLimiter.check("password_reset", {
          max: RATE_LIMITS.PASSWORD_RESET.MAX,
          window: RATE_LIMITS.PASSWORD_RESET.WINDOW,
          identifier: email,
        });

        if (!rateLimit.allowed) {
          const error = `Too many password reset attempts. Please try again later.`;
          set((state) => {
            state.error = error;
          });
          throw new Error(error);
        }

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await apiClient.post("/auth/reset-password", { email });
          set((state) => {
            state.isLoading = false;
          });

          // Log password reset request
          auditLogger.logAuth("password_reset", null, true, { email });
        } catch (error: any) {
          set((state) => {
            state.isLoading = false;
            state.error = error.message || "Failed to send reset email";
          });
          throw error;
        }
      },

      updatePassword: async (currentPassword: string, newPassword: string) => {
        const { user } = get();

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          await apiClient.post("/auth/update-password", {
            currentPassword,
            newPassword,
          });
          set((state) => {
            state.isLoading = false;
          });

          // Log password change
          auditLogger.log(AUDIT_EVENTS.AUTH_PASSWORD_CHANGE, {
            userId: user?.id,
            userEmail: user?.email,
            result: "success",
          });
        } catch (error: any) {
          set((state) => {
            state.isLoading = false;
            state.error = error.message || "Failed to update password";
          });
          throw error;
        }
      },

      // User actions
      updateProfile: async (data: Partial<User>) => {
        const { user } = get();

        set((state) => {
          state.isLoading = true;
          state.error = null;
        });

        try {
          const response = await apiClient.patch<User>("/auth/profile", data);
          set((state) => {
            state.user = response.data;
            state.isLoading = false;
          });

          // Log profile update
          auditLogger.logDataOperation("update", "user", user?.id, user);
        } catch (error: any) {
          set((state) => {
            state.isLoading = false;
            state.error = error.message || "Failed to update profile";
          });
          throw error;
        }
      },

      fetchCurrentUser: async () => {
        const token = tokenManager.getAccessToken();

        if (!token) {
          return;
        }

        // [PHASE 1-4 MOCK AUTH - Remove this block in Phase 5.2]
        if (import.meta.env.DEV && config.development.mockAuth) {
          set((state) => {
            state.isLoading = true;
          });

          try {
            const user = await mockAuthService.fetchCurrentUser(token);
            set((state) => {
              state.user = user;
              state.token = token; // Ensure token is set
              state.isAuthenticated = true;
              state.isLoading = false;
            });
            console.log("[AUTH] User fetched successfully:", user.email);
          } catch (error) {
            console.error("[AUTH] Failed to fetch user:", error);
            get().logout();
          }
          return;
        }
        // [END PHASE 1-4 MOCK AUTH]

        set((state) => {
          state.isLoading = true;
        });

        try {
          const response = await apiClient.get<User>("/auth/me");
          set((state) => {
            state.user = response.data;
            state.isAuthenticated = true;
            state.isLoading = false;
          });
        } catch (error: any) {
          // If fetching user fails, clear auth state
          get().logout();
        }
      },

      // State setters
      setUser: (user: User | null) => {
        set((state) => {
          state.user = user;
          state.isAuthenticated = !!user;
        });
      },

      setToken: (token: string | null) => {
        if (token) {
          tokenManager.storeTokens(token, get().refreshToken || "");
        }
        // Token is managed by TokenManager, not directly by apiClient
        set((state) => {
          state.token = token;
        });
      },

      setRefreshToken: (refreshToken: string | null) => {
        if (refreshToken && get().token) {
          tokenManager.storeTokens(get().token!, refreshToken);
        }
        set((state) => {
          state.refreshToken = refreshToken;
        });
      },

      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setError: (error: string | null) => {
        set((state) => {
          state.error = error;
        });
      },

      clearError: () => {
        set((state) => {
          state.error = null;
        });
      },

      // Enhanced utility functions with security checks
      checkAuth: () => {
        const state = get();
        const token = tokenManager.getAccessToken();

        // Check if token exists and is valid
        if (!token || !state.user) return false;

        // Check if token is expired
        if (tokenManager.isTokenExpired(token, 0)) {
          // Token expired, trigger refresh
          get()
            .refreshTokens()
            .catch(() => {
              get().logout();
            });
          return false;
        }

        return true;
      },

      hasPermission: (resource: string, action: string) => {
        const { user } = get();
        const result = permissionGuard.hasPermission(user, {
          resource,
          action,
        });

        // Log access attempt
        auditLogger.logAccess(resource, action, result.allowed, user);

        return result.allowed;
      },

      hasRole: (role: string) => {
        const { user } = get();
        return user?.role === role;
      },

      // Initialize auth on app start
      initializeAuth: async () => {
        console.log("[AUTH] Initializing auth...");
        const token = tokenManager.getAccessToken();
        const refreshToken = tokenManager.getRefreshToken();

        console.log("[AUTH] Found stored tokens:", {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
        });

        if (token && refreshToken) {
          // Check if token is valid
          if (!tokenManager.isTokenExpired(token, 0)) {
            console.log("[AUTH] Token is valid, restoring session...");

            // First, restore tokens to state
            set((state) => {
              state.token = token;
              state.refreshToken = refreshToken;
              state.sessionExpiry = Date.now() + TOKEN_EXPIRY.ACCESS_TOKEN;
            });

            try {
              await get().fetchCurrentUser();

              // Ensure auth state is properly set
              const currentState = get();
              console.log("[AUTH] Session restored:", {
                user: currentState.user?.email,
                isAuthenticated: currentState.isAuthenticated,
              });

              // Restart session monitoring
              sessionMonitor.start({
                timeout: TOKEN_EXPIRY.SESSION_TIMEOUT,
                warningTime: TOKEN_EXPIRY.SESSION_WARNING,
                onTimeout: () => {
                  get().logout();
                },
              });

              // Register token refresh
              tokenManager.onTokenRefresh(async () => {
                await get().refreshTokens();
              });
            } catch (error) {
              console.error("[AUTH] Failed to restore session:", error);
              get().logout();
            }
          } else {
            console.log("[AUTH] Token expired, trying to refresh...");
            // Token expired, try to refresh
            try {
              await get().refreshTokens();
            } catch (error) {
              console.error("[AUTH] Failed to refresh token:", error);
              get().logout();
            }
          }
        } else {
          console.log("[AUTH] No stored tokens found");
        }
      },
    })),
    {
      name: "AuthStore",
    }
  )
);

// Selector hooks for better performance
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
