/**
 * Authentication Routes Tests
 * Tests for protected route guards, redirects, and role-based access control
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "@tanstack/react-router";
import { renderWithProviders, MOCK_AUTH_STATES, MOCK_USERS } from "@tests/utils/test-utils";

// Mock components for testing
const MockDashboard = () => <div data-testid="dashboard-page">Dashboard</div>;
const MockLogin = () => <div data-testid="login-page">Login</div>;
const MockSettings = () => <div data-testid="settings-page">Settings</div>;
const MockAdminSettings = () => <div data-testid="admin-settings-page">Admin Settings</div>;
const MockUnauthorized = () => <div data-testid="unauthorized-page">Unauthorized</div>;

// Mock auth store
const mockAuthStore = {
  user: null,
  isAuthenticated: false,
  token: null,
  isLoading: false,
  error: null,
  checkAuth: vi.fn(() => false),
  hasRole: vi.fn(() => false),
  hasPermission: vi.fn(() => false),
};

vi.mock("@/stores/authStore", () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
  useUser: vi.fn(() => mockAuthStore.user),
  useIsAuthenticated: vi.fn(() => mockAuthStore.isAuthenticated),
}));

// Mock route components
vi.mock("@/pages/DashboardPage", () => ({
  default: MockDashboard,
}));

vi.mock("@/pages/LoginPage", () => ({
  default: MockLogin,
}));

vi.mock("@/pages/SettingsPage", () => ({
  default: MockSettings,
}));

vi.mock("@/pages/AdminSettingsPage", () => ({
  default: MockAdminSettings,
}));

// Route Guard Component
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: string;
}) {
  const { useAuthStore } = require("@/stores/authStore");
  const { isAuthenticated, user, hasRole } = useAuthStore();

  if (!isAuthenticated) {
    return <div data-testid="redirect-login">Redirecting to login...</div>;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return <MockUnauthorized />;
  }

  return <>{children}</>;
}

// Permission Guard Component
function PermissionGuard({
  children,
  resource,
  action,
}: {
  children: React.ReactNode;
  resource: string;
  action: string;
}) {
  const { useAuthStore } = require("@/stores/authStore");
  const { hasPermission, isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <div data-testid="redirect-login">Redirecting to login...</div>;
  }

  if (!hasPermission(resource, action)) {
    return <MockUnauthorized />;
  }

  return <>{children}</>;
}

describe("Authentication Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset auth store mock
    Object.assign(mockAuthStore, {
      user: null,
      isAuthenticated: false,
      token: null,
      isLoading: false,
      error: null,
      checkAuth: vi.fn(() => false),
      hasRole: vi.fn(() => false),
      hasPermission: vi.fn(() => false),
    });

    // Reset useAuthStore implementations
    const { useAuthStore, useUser, useIsAuthenticated } = require("@/stores/authStore");
    useAuthStore.mockReturnValue(mockAuthStore);
    useUser.mockReturnValue(mockAuthStore.user);
    useIsAuthenticated.mockReturnValue(mockAuthStore.isAuthenticated);
  });

  describe("Public Routes", () => {
    it("should allow access to login page when not authenticated", () => {
      const router = createMemoryRouter(
        [
          {
            path: "/login",
            element: <MockLogin />,
          },
        ],
        {
          initialEntries: ["/login"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("login-page")).toBeInTheDocument();
    });

    it("should redirect authenticated users away from login page", () => {
      // Mock authenticated state
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
      });

      const { useAuthStore, useIsAuthenticated } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);
      useIsAuthenticated.mockReturnValue(true);

      const AuthRedirectRoute = ({ children }: { children: React.ReactNode }) => {
        const { isAuthenticated } = mockAuthStore;
        if (isAuthenticated) {
          return <div data-testid="redirect-dashboard">Redirecting to dashboard...</div>;
        }
        return <>{children}</>;
      };

      const router = createMemoryRouter(
        [
          {
            path: "/login",
            element: (
              <AuthRedirectRoute>
                <MockLogin />
              </AuthRedirectRoute>
            ),
          },
        ],
        {
          initialEntries: ["/login"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("redirect-dashboard")).toBeInTheDocument();
    });
  });

  describe("Protected Routes", () => {
    it("should redirect unauthenticated users to login", () => {
      const router = createMemoryRouter(
        [
          {
            path: "/dashboard",
            element: (
              <ProtectedRoute>
                <MockDashboard />
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/dashboard"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("redirect-login")).toBeInTheDocument();
    });

    it("should allow authenticated users to access protected routes", () => {
      // Mock authenticated state
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
        checkAuth: vi.fn(() => true),
      });

      const { useAuthStore, useIsAuthenticated } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);
      useIsAuthenticated.mockReturnValue(true);

      const router = createMemoryRouter(
        [
          {
            path: "/dashboard",
            element: (
              <ProtectedRoute>
                <MockDashboard />
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/dashboard"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // Mock loading state
      Object.assign(mockAuthStore, {
        isLoading: true,
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const LoadingRoute = ({ children }: { children: React.ReactNode }) => {
        const { isLoading } = mockAuthStore;
        if (isLoading) {
          return <div data-testid="auth-loading">Loading authentication...</div>;
        }
        return <>{children}</>;
      };

      const router = createMemoryRouter(
        [
          {
            path: "/dashboard",
            element: (
              <LoadingRoute>
                <ProtectedRoute>
                  <MockDashboard />
                </ProtectedRoute>
              </LoadingRoute>
            ),
          },
        ],
        {
          initialEntries: ["/dashboard"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("auth-loading")).toBeInTheDocument();
    });
  });

  describe("Role-Based Access Control", () => {
    it("should allow access for users with correct role", () => {
      // Mock authenticated owner
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
        hasRole: vi.fn((role) => role === "OWNER"),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const router = createMemoryRouter(
        [
          {
            path: "/admin",
            element: (
              <ProtectedRoute requiredRole="OWNER">
                <MockAdminSettings />
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/admin"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("admin-settings-page")).toBeInTheDocument();
    });

    it("should deny access for users without required role", () => {
      // Mock authenticated staff user
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.STAFF,
        hasRole: vi.fn((role) => role === "STAFF"), // Staff trying to access owner-only route
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const router = createMemoryRouter(
        [
          {
            path: "/admin",
            element: (
              <ProtectedRoute requiredRole="OWNER">
                <MockAdminSettings />
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/admin"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("unauthorized-page")).toBeInTheDocument();
    });

    it("should handle multiple role requirements", () => {
      // Test manager access
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.MANAGER,
        hasRole: vi.fn((role) => ["OWNER", "MANAGER"].includes(role) && role === "MANAGER"),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const MultiRoleRoute = ({ children }: { children: React.ReactNode }) => {
        const { hasRole } = mockAuthStore;
        const allowedRoles = ["OWNER", "MANAGER"];
        const hasAccess = allowedRoles.some((role) => hasRole(role));

        if (!hasAccess) {
          return <MockUnauthorized />;
        }

        return <>{children}</>;
      };

      const router = createMemoryRouter(
        [
          {
            path: "/management",
            element: (
              <ProtectedRoute>
                <MultiRoleRoute>
                  <MockSettings />
                </MultiRoleRoute>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/management"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    });
  });

  describe("Permission-Based Access Control", () => {
    it("should allow access for users with required permissions", () => {
      // Mock authenticated user with permissions
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
        hasPermission: vi.fn((resource, action) => resource === "settings" && action === "read"),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const router = createMemoryRouter(
        [
          {
            path: "/settings",
            element: (
              <PermissionGuard resource="settings" action="read">
                <MockSettings />
              </PermissionGuard>
            ),
          },
        ],
        {
          initialEntries: ["/settings"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      expect(mockAuthStore.hasPermission).toHaveBeenCalledWith("settings", "read");
    });

    it("should deny access for users without required permissions", () => {
      // Mock authenticated user without permissions
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.STAFF,
        hasPermission: vi.fn(() => false), // No permissions
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const router = createMemoryRouter(
        [
          {
            path: "/admin/delete",
            element: (
              <PermissionGuard resource="admin" action="delete">
                <MockAdminSettings />
              </PermissionGuard>
            ),
          },
        ],
        {
          initialEntries: ["/admin/delete"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("unauthorized-page")).toBeInTheDocument();
      expect(mockAuthStore.hasPermission).toHaveBeenCalledWith("admin", "delete");
    });

    it("should handle complex permission checks", () => {
      // Mock user with specific permissions
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.MANAGER,
        hasPermission: vi.fn((resource, action) => {
          // Manager can read bookings but not delete them
          if (resource === "bookings" && action === "read") return true;
          if (resource === "bookings" && action === "delete") return false;
          return false;
        }),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      // Test read permission (should work)
      const readRouter = createMemoryRouter(
        [
          {
            path: "/bookings",
            element: (
              <PermissionGuard resource="bookings" action="read">
                <div data-testid="bookings-read">Bookings List</div>
              </PermissionGuard>
            ),
          },
        ],
        {
          initialEntries: ["/bookings"],
        }
      );

      const { unmount } = renderWithProviders(<RouterProvider router={readRouter} />);

      expect(screen.getByTestId("bookings-read")).toBeInTheDocument();

      unmount();

      // Test delete permission (should fail)
      const deleteRouter = createMemoryRouter(
        [
          {
            path: "/bookings/delete",
            element: (
              <PermissionGuard resource="bookings" action="delete">
                <div data-testid="bookings-delete">Delete Booking</div>
              </PermissionGuard>
            ),
          },
        ],
        {
          initialEntries: ["/bookings/delete"],
        }
      );

      renderWithProviders(<RouterProvider router={deleteRouter} />);

      expect(screen.getByTestId("unauthorized-page")).toBeInTheDocument();
    });
  });

  describe("Route Guards Integration", () => {
    it("should handle nested route protection", () => {
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
        hasRole: vi.fn((role) => role === "OWNER"),
        hasPermission: vi.fn(() => true),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const NestedProtectedRoute = ({ children }: { children: React.ReactNode }) => (
        <ProtectedRoute>
          <PermissionGuard resource="admin" action="read">
            {children}
          </PermissionGuard>
        </ProtectedRoute>
      );

      const router = createMemoryRouter(
        [
          {
            path: "/admin/nested",
            element: (
              <NestedProtectedRoute>
                <div data-testid="nested-protected">Nested Protected Content</div>
              </NestedProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/admin/nested"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("nested-protected")).toBeInTheDocument();
    });

    it("should handle route guards with query parameters", () => {
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.MANAGER,
        hasPermission: vi.fn((resource) => resource === "bookings"),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const router = createMemoryRouter(
        [
          {
            path: "/bookings/:id",
            element: (
              <ProtectedRoute>
                <PermissionGuard resource="bookings" action="read">
                  <div data-testid="booking-detail">Booking Detail</div>
                </PermissionGuard>
              </ProtectedRoute>
            ),
          },
        ],
        {
          initialEntries: ["/bookings/123?tab=details"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("booking-detail")).toBeInTheDocument();
    });
  });

  describe("Error Boundaries and Fallbacks", () => {
    it("should handle authentication errors gracefully", () => {
      // Mock authentication error
      Object.assign(mockAuthStore, {
        isAuthenticated: false,
        error: "Authentication failed",
        isLoading: false,
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const ErrorBoundaryRoute = ({ children }: { children: React.ReactNode }) => {
        const { error } = mockAuthStore;
        if (error) {
          return <div data-testid="auth-error">Authentication Error: {error}</div>;
        }
        return <>{children}</>;
      };

      const router = createMemoryRouter(
        [
          {
            path: "/dashboard",
            element: (
              <ErrorBoundaryRoute>
                <ProtectedRoute>
                  <MockDashboard />
                </ProtectedRoute>
              </ErrorBoundaryRoute>
            ),
          },
        ],
        {
          initialEntries: ["/dashboard"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("auth-error")).toBeInTheDocument();
      expect(screen.getByText("Authentication Error: Authentication failed")).toBeInTheDocument();
    });

    it("should handle route guard failures", () => {
      // Mock function that throws an error
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
        hasPermission: vi.fn(() => {
          throw new Error("Permission check failed");
        }),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const SafePermissionGuard = ({
        children,
        resource,
        action,
      }: {
        children: React.ReactNode;
        resource: string;
        action: string;
      }) => {
        try {
          const { hasPermission, isAuthenticated } = mockAuthStore;

          if (!isAuthenticated) {
            return <div data-testid="redirect-login">Redirecting to login...</div>;
          }

          const hasAccess = hasPermission(resource, action);
          if (!hasAccess) {
            return <MockUnauthorized />;
          }

          return <>{children}</>;
        } catch (error) {
          return <div data-testid="permission-error">Permission check failed</div>;
        }
      };

      const router = createMemoryRouter(
        [
          {
            path: "/protected",
            element: (
              <SafePermissionGuard resource="test" action="read">
                <div data-testid="protected-content">Protected Content</div>
              </SafePermissionGuard>
            ),
          },
        ],
        {
          initialEntries: ["/protected"],
        }
      );

      renderWithProviders(<RouterProvider router={router} />);

      expect(screen.getByTestId("permission-error")).toBeInTheDocument();
    });
  });

  describe("Route Transition and Navigation", () => {
    it("should handle navigation between protected routes", async () => {
      Object.assign(mockAuthStore, {
        isAuthenticated: true,
        user: MOCK_USERS.OWNER,
        hasRole: vi.fn(() => true),
        hasPermission: vi.fn(() => true),
      });

      const { useAuthStore } = require("@/stores/authStore");
      useAuthStore.mockReturnValue(mockAuthStore);

      const NavigationTest = () => {
        const [currentPath, setCurrentPath] = React.useState("/dashboard");

        return (
          <div>
            <button data-testid="nav-settings" onClick={() => setCurrentPath("/settings")}>
              Go to Settings
            </button>
            <button data-testid="nav-dashboard" onClick={() => setCurrentPath("/dashboard")}>
              Go to Dashboard
            </button>

            {currentPath === "/dashboard" && (
              <ProtectedRoute>
                <MockDashboard />
              </ProtectedRoute>
            )}
            {currentPath === "/settings" && (
              <ProtectedRoute>
                <MockSettings />
              </ProtectedRoute>
            )}
          </div>
        );
      };

      renderWithProviders(<NavigationTest />);

      // Initially on dashboard
      expect(screen.getByTestId("dashboard-page")).toBeInTheDocument();

      // Navigate to settings
      const settingsButton = screen.getByTestId("nav-settings");
      settingsButton.click();

      await waitFor(() => {
        expect(screen.getByTestId("settings-page")).toBeInTheDocument();
      });
    });
  });
});
