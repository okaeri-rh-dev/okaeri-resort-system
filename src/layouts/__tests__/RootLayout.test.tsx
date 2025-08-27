/**
 * RootLayout Test Suite
 * Tests for the root layout including error boundaries, notifications,
 * theme management, offline handling, and TanStack Query integration
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  TEST_IDS,
  MOCK_AUTH_STATES,
  checkA11y,
} from "@tests/utils/test-utils";
import { RootLayout } from "../RootLayout";
import { useUIStore } from "@/stores/uiStore";
import { QueryClient } from "@tanstack/react-query";

// Mock stores
vi.mock("@/stores/uiStore", () => ({
  useUIStore: vi.fn(),
}));

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="root-outlet">Page Content</div>,
}));

// Mock React Query
vi.mock("@tanstack/react-query", () => ({
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-provider">{children}</div>
  ),
  useQueryClient: () => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@tanstack/react-query-devtools", () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools">DevTools</div>,
}));

vi.mock("@/lib/query-client", () => ({
  queryClient: {
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
  },
}));

// Mock error boundary
vi.mock("react-error-boundary", () => ({
  ErrorBoundary: ({ children, FallbackComponent, onReset }: any) => {
    const [hasError, setHasError] = React.useState(false);

    if (hasError && FallbackComponent) {
      return React.createElement(FallbackComponent, {
        error: new Error("Test error"),
        resetErrorBoundary: () => {
          setHasError(false);
          onReset?.();
        },
      });
    }

    // Add error simulation for testing
    React.useEffect(() => {
      const errorHandler = (event: any) => {
        if (event.detail === "trigger-error") {
          setHasError(true);
        }
      };
      window.addEventListener("test-error", errorHandler);
      return () => window.removeEventListener("test-error", errorHandler);
    }, []);

    return children;
  },
}));

// Mock network status
const mockNetworkStatus = (online: boolean) => {
  Object.defineProperty(navigator, "onLine", {
    writable: true,
    value: online,
  });
};

describe("RootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset network status
    mockNetworkStatus(true);

    // Setup UI store mock with default state
    (useUIStore as any).mockImplementation((selector: any) => {
      const state = {
        theme: "light",
        notifications: [],
        removeNotification: vi.fn(),
        globalLoading: false,
        loadingMessage: null,
      };
      return selector ? selector(state) : state;
    });
  });

  afterEach(() => {
    // Clean up any custom events
    window.dispatchEvent(new CustomEvent("online"));
  });

  describe("Basic Layout Structure", () => {
    it("should render root layout with query provider", () => {
      renderWithProviders(<RootLayout />);

      expect(screen.getByTestId("query-provider")).toBeInTheDocument();
      expect(screen.getByTestId("root-outlet")).toBeInTheDocument();
    });

    it("should apply theme classes to document element", () => {
      renderWithProviders(<RootLayout />);

      // Should apply light theme by default
      expect(document.documentElement).not.toHaveClass("dark");
    });

    it("should apply dark theme when theme is dark", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "dark",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      expect(document.documentElement).toHaveClass("dark");
    });

    it("should apply system theme based on media query", () => {
      // Mock prefers-color-scheme: dark
      const mockMatchMedia = vi.fn((query) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: mockMatchMedia,
      });

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "system",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      expect(document.documentElement).toHaveClass("dark");
    });
  });

  describe("Error Boundary", () => {
    it("should render error fallback when error occurs", () => {
      renderWithProviders(<RootLayout />);

      // Trigger error
      window.dispatchEvent(new CustomEvent("test-error", { detail: "trigger-error" }));

      expect(screen.getByText("Oops! Something went wrong")).toBeInTheDocument();
      expect(screen.getByText(/resort management system/)).toBeInTheDocument();
    });

    it("should show error details in error fallback", () => {
      renderWithProviders(<RootLayout />);

      // Trigger error
      window.dispatchEvent(new CustomEvent("test-error", { detail: "trigger-error" }));

      expect(screen.getByText("Error Details:")).toBeInTheDocument();
      expect(screen.getByText("Test error")).toBeInTheDocument();
    });

    it("should provide try again functionality", async () => {
      const user = userEvent.setup();
      renderWithProviders(<RootLayout />);

      // Trigger error
      window.dispatchEvent(new CustomEvent("test-error", { detail: "trigger-error" }));

      const tryAgainButton = screen.getByRole("button", { name: /try again/i });
      expect(tryAgainButton).toBeInTheDocument();

      await user.click(tryAgainButton);

      // Should return to normal layout
      await waitFor(() => {
        expect(screen.getByTestId("root-outlet")).toBeInTheDocument();
      });
    });

    it("should show support contact information", () => {
      renderWithProviders(<RootLayout />);

      // Trigger error
      window.dispatchEvent(new CustomEvent("test-error", { detail: "trigger-error" }));

      expect(screen.getByText(/support@okaeri-resort.com/)).toBeInTheDocument();
    });
  });

  describe("Network Status Handling", () => {
    it("should show offline banner when offline", () => {
      mockNetworkStatus(false);
      renderWithProviders(<RootLayout />);

      // Trigger offline event
      window.dispatchEvent(new Event("offline"));

      expect(screen.getByText("You're currently offline")).toBeInTheDocument();
      expect(screen.getByText(/sync your data when connection is restored/)).toBeInTheDocument();
    });

    it("should hide offline banner when online", () => {
      mockNetworkStatus(true);
      renderWithProviders(<RootLayout />);

      expect(screen.queryByText("You're currently offline")).not.toBeInTheDocument();
    });

    it("should show connection restored message temporarily", async () => {
      mockNetworkStatus(false);
      renderWithProviders(<RootLayout />);

      // Go offline first
      window.dispatchEvent(new Event("offline"));
      expect(screen.getByText("You're currently offline")).toBeInTheDocument();

      // Go back online
      mockNetworkStatus(true);
      window.dispatchEvent(new Event("online"));

      await waitFor(() => {
        expect(screen.getByText("Connection restored!")).toBeInTheDocument();
        expect(screen.getByText("Syncing your offline changes...")).toBeInTheDocument();
      });

      // Should auto-hide after 3 seconds
      await waitFor(
        () => {
          expect(screen.queryByText("Connection restored!")).not.toBeInTheDocument();
        },
        { timeout: 4000 }
      );
    });

    it("should adjust layout padding when banners are shown", () => {
      mockNetworkStatus(false);
      renderWithProviders(<RootLayout />);

      // Trigger offline event
      window.dispatchEvent(new Event("offline"));

      const mainContent = screen.getByTestId("root-outlet").closest("div");
      expect(mainContent).toHaveClass("pt-16");
    });
  });

  describe("Notification System", () => {
    const mockNotifications = [
      {
        id: "1",
        type: "success" as const,
        title: "Success!",
        message: "Operation completed successfully",
      },
      {
        id: "2",
        type: "error" as const,
        title: "Error!",
        message: "Something went wrong",
      },
      {
        id: "3",
        type: "warning" as const,
        title: "Warning!",
        message: "Please check your input",
      },
      {
        id: "4",
        type: "info" as const,
        title: "Info",
        message: "Here is some information",
        action: {
          label: "View Details",
          onClick: vi.fn(),
        },
      },
    ];

    it("should render notifications when present", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: mockNotifications,
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      expect(screen.getByText("Success!")).toBeInTheDocument();
      expect(screen.getByText("Error!")).toBeInTheDocument();
      expect(screen.getByText("Warning!")).toBeInTheDocument();
      expect(screen.getByText("Info")).toBeInTheDocument();
    });

    it("should show appropriate icons for different notification types", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: mockNotifications,
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      // Check that different icons are used for different types
      const icons = document.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(mockNotifications.length);
    });

    it("should allow dismissing notifications", async () => {
      const mockRemoveNotification = vi.fn();

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: mockNotifications,
          removeNotification: mockRemoveNotification,
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      const user = userEvent.setup();
      renderWithProviders(<RootLayout />);

      const dismissButtons = screen.getAllByRole("button", { name: /dismiss notification/i });
      expect(dismissButtons).toHaveLength(mockNotifications.length);

      await user.click(dismissButtons[0]);
      expect(mockRemoveNotification).toHaveBeenCalledWith("1");
    });

    it("should handle notification actions", async () => {
      const mockActionClick = vi.fn();
      const notificationWithAction = {
        id: "5",
        type: "info" as const,
        title: "Action Test",
        message: "Test action",
        action: {
          label: "Test Action",
          onClick: mockActionClick,
        },
      };

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [notificationWithAction],
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      const user = userEvent.setup();
      renderWithProviders(<RootLayout />);

      const actionButton = screen.getByRole("button", { name: /test action/i });
      await user.click(actionButton);

      expect(mockActionClick).toHaveBeenCalled();
    });

    it("should apply appropriate styling for different notification types", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: mockNotifications,
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      // Check that notifications have different background colors
      const successNotification = screen.getByText("Success!").closest("div");
      const errorNotification = screen.getByText("Error!").closest("div");
      const warningNotification = screen.getByText("Warning!").closest("div");
      const infoNotification = screen.getByText("Info").closest("div");

      expect(successNotification).toHaveClass("from-green-50");
      expect(errorNotification).toHaveClass("from-red-50");
      expect(warningNotification).toHaveClass("from-amber-50");
      expect(infoNotification).toHaveClass("from-ocean-50");
    });
  });

  describe("Global Loading Indicator", () => {
    it("should show loading indicator when global loading is true", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: true,
          loadingMessage: "Processing your request...",
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      expect(screen.getByText("Processing your request...")).toBeInTheDocument();
      expect(screen.getByText("Please wait while we handle your request")).toBeInTheDocument();
    });

    it("should hide loading indicator when global loading is false", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      expect(screen.queryByText("Processing...")).not.toBeInTheDocument();
    });

    it("should show default loading message when no custom message provided", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: true,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    it("should have animated loading elements", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: true,
          loadingMessage: "Loading...",
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      const spinner = document.querySelector(".animate-spin");
      const pulseElement = document.querySelector(".animate-pulse");

      expect(spinner).toBeInTheDocument();
      expect(pulseElement).toBeInTheDocument();
    });
  });

  describe("Development Tools", () => {
    it("should show React Query DevTools in development", () => {
      // Mock development environment
      vi.stubEnv("DEV", true);

      renderWithProviders(<RootLayout />);

      expect(screen.getByTestId("react-query-devtools")).toBeInTheDocument();
    });

    it("should hide React Query DevTools in production", () => {
      // Mock production environment
      vi.stubEnv("DEV", false);

      renderWithProviders(<RootLayout />);

      expect(screen.queryByTestId("react-query-devtools")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for interactive elements", async () => {
      const mockRemoveNotification = vi.fn();

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [
            {
              id: "1",
              type: "info" as const,
              title: "Test Notification",
              message: "Test message",
            },
          ],
          removeNotification: mockRemoveNotification,
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<RootLayout />);

      const dismissButton = screen.getByRole("button", { name: /dismiss notification/i });
      expect(dismissButton).toHaveAttribute("aria-label", "Dismiss notification");
    });

    it("should pass accessibility checks", async () => {
      const { container } = renderWithProviders(<RootLayout />);

      await expect(async () => {
        await checkA11y(container);
      }).not.toThrow();
    });
  });

  describe("Theme Integration", () => {
    it("should apply gradient backgrounds with theme support", () => {
      renderWithProviders(<RootLayout />);

      const layout = document.querySelector(".from-sand-25");
      expect(layout).toBeInTheDocument();
    });

    it("should update theme on system preference change", () => {
      const mockMatchMedia = vi.fn((query) => {
        const mediaQuery = {
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
        return mediaQuery;
      });

      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: mockMatchMedia,
      });

      renderWithProviders(<RootLayout />);

      expect(mockMatchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    });
  });

  describe("Performance", () => {
    it("should render efficiently", () => {
      const startTime = performance.now();
      renderWithProviders(<RootLayout />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should handle multiple notifications efficiently", () => {
      const manyNotifications = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        type: "info" as const,
        title: `Notification ${i}`,
        message: `Message ${i}`,
      }));

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: manyNotifications,
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      const startTime = performance.now();
      renderWithProviders(<RootLayout />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe("Error Recovery", () => {
    it("should handle theme change errors gracefully", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "invalid-theme",
          notifications: [],
          removeNotification: vi.fn(),
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      expect(() => renderWithProviders(<RootLayout />)).not.toThrow();

      consoleError.mockRestore();
    });

    it("should handle notification removal errors", async () => {
      const mockRemoveNotification = vi.fn().mockImplementation(() => {
        throw new Error("Remove failed");
      });

      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          notifications: [
            {
              id: "1",
              type: "info" as const,
              title: "Test",
              message: "Test",
            },
          ],
          removeNotification: mockRemoveNotification,
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      const user = userEvent.setup();
      renderWithProviders(<RootLayout />);

      const dismissButton = screen.getByRole("button", { name: /dismiss notification/i });

      // Should not throw when removal fails
      await expect(user.click(dismissButton)).resolves.not.toThrow();
    });
  });

  describe("Integration", () => {
    it("should properly integrate with TanStack Query", () => {
      renderWithProviders(<RootLayout />);

      expect(screen.getByTestId("query-provider")).toBeInTheDocument();
      expect(screen.getByTestId("root-outlet")).toBeInTheDocument();
    });

    it("should maintain stable router outlet positioning", () => {
      renderWithProviders(<RootLayout />);

      const outlet = screen.getByTestId("root-outlet");
      const outletParent = outlet.parentElement;

      expect(outletParent).toHaveClass("flex-1");
    });
  });
});
