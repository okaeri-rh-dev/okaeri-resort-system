/**
 * Enhanced authentication hook with comprehensive security features
 * Implements token management, session monitoring, and audit logging
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { queryClient } from "@/lib/query-client";
import {
  tokenManager,
  sessionMonitor,
  auditLogger,
  rateLimiter,
  permissionGuard,
  RATE_LIMITS,
  PASSWORD_POLICY,
  PERMISSIONS,
} from "@/lib/security";
import type { User } from "@/types/common";

interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
  mfaCode?: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  projectName?: string;
  acceptTerms: boolean;
  consentToDataProcessing: boolean;
}

interface PasswordStrength {
  score: number; // 0-5
  feedback: string[];
  isValid: boolean;
}

export function useSecureAuth() {
  const navigate = useNavigate();
  const toast = useUIStore((state) => state.toast);
  const authStore = useAuthStore();
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);

  const { user, isAuthenticated, isLoading, error, clearError } = authStore;

  // Initialize auth on mount
  useEffect(() => {
    authStore.initializeAuth();
  }, []);

  // Monitor session
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubscribe = sessionMonitor.onActivity(() => {
      // Reset warning when user is active
      if (sessionWarning) {
        setSessionWarning(false);
      }
    });

    // Check session status periodically
    const interval = setInterval(() => {
      const remaining = sessionMonitor.getTimeUntilTimeout();

      if (remaining > 0 && remaining < 5 * 60 * 1000) {
        // Show warning in last 5 minutes
        if (!sessionWarning) {
          setSessionWarning(true);
        }
        setSessionTimeRemaining(Math.floor(remaining / 1000));
      } else {
        if (sessionWarning) {
          setSessionWarning(false);
        }
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isAuthenticated, sessionWarning]);

  // Enhanced login with security checks
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      // Validate input
      if (!credentials.email || !credentials.password) {
        throw new Error("Email and password are required");
      }

      // Check if circuit breaker is open
      if (rateLimiter.isCircuitOpen("login")) {
        const delay = rateLimiter.getRetryDelay("login");
        throw new Error(
          `Too many failed attempts. Please wait ${Math.ceil(delay / 1000)} seconds.`
        );
      }

      await authStore.login(credentials.email, credentials.password);

      // Log consent if remember me is checked
      if (credentials.remember) {
        auditLogger.logConsent("given", "remember_me", authStore.user);
      }
    },
    onSuccess: () => {
      toast.success("Welcome back!", "You have successfully logged in.");

      // Navigate to dashboard or redirect URL
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get("redirect") || "/dashboard";
      navigate({ to: redirect });

      // Invalidate and refetch all queries
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      const message = error.message || "Invalid email or password";
      toast.error("Login failed", message);

      // Check if account is locked
      if (message.includes("Too many login attempts")) {
        toast.warning(
          "Account temporarily locked",
          "Your account has been temporarily locked due to multiple failed login attempts. Please try again later."
        );
      }
    },
  });

  // Enhanced registration with validation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      // Validate password strength
      const strength = checkPasswordStrength(data.password);
      if (!strength.isValid) {
        throw new Error(`Password does not meet requirements: ${strength.feedback.join(", ")}`);
      }

      // Validate consent
      if (!data.acceptTerms || !data.consentToDataProcessing) {
        throw new Error("You must accept the terms and consent to data processing");
      }

      // Log consent
      auditLogger.logConsent("given", "terms_of_service", null, { email: data.email });
      auditLogger.logConsent("given", "data_processing", null, { email: data.email });

      await authStore.register(data);
    },
    onSuccess: () => {
      toast.success("Welcome!", "Your account has been created successfully.");
      navigate({ to: "/dashboard" });
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast.error("Registration failed", error.message || "Unable to create account");
    },
  });

  // Enhanced logout with cleanup
  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Flush any pending audit logs
      await auditLogger.flush();

      // Clear session data
      sessionMonitor.clearSessionEvents();

      await authStore.logout();
    },
    onSuccess: () => {
      toast.info("Logged out", "You have been logged out successfully.");
      navigate({ to: "/login" });
      queryClient.clear();
    },
    onError: (error: any) => {
      toast.error("Logout failed", error.message || "An error occurred during logout");
    },
  });

  // Password reset with rate limiting
  const resetPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      await authStore.resetPassword(email);
    },
    onSuccess: () => {
      toast.success(
        "Password reset email sent",
        "Please check your email for instructions to reset your password."
      );
    },
    onError: (error: any) => {
      if (error.message?.includes("Too many")) {
        toast.error("Too many requests", "Please wait before requesting another password reset.");
      } else {
        toast.error("Password reset failed", error.message || "Unable to send reset email");
      }
    },
  });

  // Update password with validation
  const updatePasswordMutation = useMutation({
    mutationFn: async ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => {
      // Validate new password strength
      const strength = checkPasswordStrength(newPassword);
      if (!strength.isValid) {
        throw new Error(`Password does not meet requirements: ${strength.feedback.join(", ")}`);
      }

      // Check if new password is same as current
      if (currentPassword === newPassword) {
        throw new Error("New password must be different from current password");
      }

      await authStore.updatePassword(currentPassword, newPassword);
    },
    onSuccess: () => {
      toast.success("Password updated", "Your password has been updated successfully.");
    },
    onError: (error: any) => {
      toast.error("Password update failed", error.message || "Unable to update password");
    },
  });

  // Permission checking functions
  const hasPermission = useCallback(
    (resource: string, action: string, projectId?: string) => {
      if (!user) return false;

      const result = permissionGuard.hasPermission(user, {
        resource,
        action,
        projectId,
      });

      return result.allowed;
    },
    [user]
  );

  const hasRole = useCallback(
    (role: string) => {
      return authStore.hasRole(role);
    },
    [authStore]
  );

  const canAccessProject = useCallback(
    (projectId: string) => {
      if (!user) return false;
      return permissionGuard.canAccessProject(user, projectId);
    },
    [user]
  );

  // Session management functions
  const extendSession = useCallback(async () => {
    try {
      await authStore.refreshToken();
      sessionMonitor.extendSession();
      setSessionWarning(false);
      toast.success("Session extended", "Your session has been extended.");
    } catch (error) {
      toast.error("Failed to extend session", "Please log in again.");
      await authStore.logout();
    }
  }, [authStore, toast]);

  // Check password strength
  const checkPasswordStrength = useCallback((password: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= PASSWORD_POLICY.MIN_LENGTH) {
      score++;
    } else {
      feedback.push(`Must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`);
    }

    // Uppercase check
    if (PASSWORD_POLICY.REQUIRE_UPPERCASE && /[A-Z]/.test(password)) {
      score++;
    } else if (PASSWORD_POLICY.REQUIRE_UPPERCASE) {
      feedback.push("Must contain uppercase letter");
    }

    // Lowercase check
    if (PASSWORD_POLICY.REQUIRE_LOWERCASE && /[a-z]/.test(password)) {
      score++;
    } else if (PASSWORD_POLICY.REQUIRE_LOWERCASE) {
      feedback.push("Must contain lowercase letter");
    }

    // Number check
    if (PASSWORD_POLICY.REQUIRE_NUMBER && /\d/.test(password)) {
      score++;
    } else if (PASSWORD_POLICY.REQUIRE_NUMBER) {
      feedback.push("Must contain number");
    }

    // Special character check
    const specialChars = PASSWORD_POLICY.SPECIAL_CHARS.split("")
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("");
    const specialRegex = new RegExp(`[${specialChars}]`);

    if (PASSWORD_POLICY.REQUIRE_SPECIAL && specialRegex.test(password)) {
      score++;
    } else if (PASSWORD_POLICY.REQUIRE_SPECIAL) {
      feedback.push("Must contain special character");
    }

    return {
      score,
      feedback,
      isValid: feedback.length === 0,
    };
  }, []);

  return {
    // State
    user,
    isAuthenticated,
    isLoading:
      isLoading ||
      loginMutation.isPending ||
      registerMutation.isPending ||
      logoutMutation.isPending,
    error,

    // Session state
    sessionWarning,
    sessionTimeRemaining,

    // Actions
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    resetPassword: resetPasswordMutation.mutateAsync,
    updatePassword: updatePasswordMutation.mutateAsync,
    clearError,
    extendSession,

    // Permissions
    hasPermission,
    hasRole,
    canAccessProject,

    // Utilities
    checkPasswordStrength,

    // Mutation states
    loginPending: loginMutation.isPending,
    registerPending: registerMutation.isPending,
    logoutPending: logoutMutation.isPending,
    resetPasswordPending: resetPasswordMutation.isPending,
    updatePasswordPending: updatePasswordMutation.isPending,
  };
}

/**
 * Hook to require authentication with security checks
 */
export function useRequireSecureAuth(
  requiredPermissions?: Array<{ resource: string; action: string }>
) {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, hasPermission } = useSecureAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      navigate({
        to: "/login",
        search: {
          redirect: window.location.pathname,
        },
      });
      return;
    }

    // Check required permissions
    if (requiredPermissions) {
      const hasAllPermissions = requiredPermissions.every((perm) =>
        hasPermission(perm.resource, perm.action)
      );

      if (!hasAllPermissions) {
        auditLogger.logSecurityEvent("violation", {
          path: window.location.pathname,
          requiredPermissions,
        });

        navigate({ to: "/dashboard" });
      }
    }
  }, [isAuthenticated, isLoading, hasPermission, requiredPermissions, navigate]);

  return { isAuthenticated, isLoading };
}
