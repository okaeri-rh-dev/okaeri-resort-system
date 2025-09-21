/**
 * Custom hook for authentication operations
 */

import { useCallback, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { queryClient } from "@/lib/query-client";
import { ROUTES } from "@/constants/routes";

interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  projectName?: string;
}

export function useAuth() {
  const navigate = useNavigate();
  const toast = useUIStore((state) => state.toast);

  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: loginStore,
    logout: logoutStore,
    register: registerStore,
    fetchCurrentUser,
    clearError,
  } = useAuthStore();

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      await loginStore(credentials.email, credentials.password);
    },
    onSuccess: () => {
      toast.success("Welcome back!", "You have successfully logged in.");

      // Navigate to dashboard or redirect URL
      const searchParams = new URLSearchParams(window.location.search);
      const redirect = searchParams.get("redirect") || ROUTES.dashboard;
      navigate({ to: redirect });

      // Invalidate and refetch all queries
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast.error("Login failed", error.message || "Invalid email or password");
    },
  });

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      await registerStore(data);
    },
    onSuccess: () => {
      toast.success("Welcome!", "Your account has been created successfully.");
      navigate({ to: ROUTES.dashboard });

      // Invalidate and refetch all queries
      queryClient.invalidateQueries();
    },
    onError: (error: any) => {
      toast.error("Registration failed", error.message || "Unable to create account");
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logoutStore();
    },
    onSuccess: () => {
      toast.info("Logged out", "You have been logged out successfully.");
      navigate({ to: ROUTES.login });

      // Clear all cached data
      queryClient.clear();
    },
    onError: (error: any) => {
      toast.error("Logout failed", error.message || "An error occurred during logout");
    },
  });

  // Login function
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      clearError();
      await loginMutation.mutateAsync(credentials);
    },
    [loginMutation, clearError]
  );

  // Register function
  const register = useCallback(
    async (data: RegisterData) => {
      clearError();
      await registerMutation.mutateAsync(data);
    },
    [registerMutation, clearError]
  );

  // Logout function
  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
  }, [logoutMutation]);

  // Check authentication on mount
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchCurrentUser();
    }
  }, [isAuthenticated, user, fetchCurrentUser]);

  // Permission check helpers
  const hasPermission = useCallback(
    (resource: string, action: string) => {
      if (!user) return false;
      return useAuthStore.getState().hasPermission(resource, action);
    },
    [user]
  );

  const hasRole = useCallback(
    (role: string) => {
      if (!user) return false;
      return useAuthStore.getState().hasRole(role);
    },
    [user]
  );

  const canAccessProject = useCallback(
    (projectId: string) => {
      if (!user) return false;

      // Super admin can access all projects
      if (user.role === "SUPER_ADMIN") return true;

      // Check if user is member of the project
      return user.projects?.some((p) => p.projectId === projectId) || false;
    },
    [user]
  );

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

    // Actions
    login,
    register,
    logout,
    clearError,

    // Permissions
    hasPermission,
    hasRole,
    canAccessProject,

    // Mutation states
    loginPending: loginMutation.isPending,
    registerPending: registerMutation.isPending,
    logoutPending: logoutMutation.isPending,
  };
}

// Hook to require authentication
export function useRequireAuth() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({
        to: ROUTES.login,
        search: {
          redirect: window.location.pathname,
        },
      });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return { isAuthenticated, isLoading };
}

// Hook to check specific permissions
export function usePermission(resource: string, action: string) {
  const { hasPermission } = useAuth();
  return hasPermission(resource, action);
}

// Hook to check role
export function useRole(role: string) {
  const { hasRole } = useAuth();
  return hasRole(role);
}
