/**
 * DashboardLayout Test Suite
 * Tests for the main dashboard layout including navigation, responsiveness,
 * TanStack Router integration, and Philippine-specific UI elements
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryHistory } from "@tanstack/react-router";
import {
  renderWithProviders,
  TEST_IDS,
  MOCK_AUTH_STATES,
  MOCK_USERS,
  philippineTestData,
} from "@tests/utils/test-utils";
import { DashboardLayout } from "../DashboardLayout";
import { useUIStore } from "@/stores/uiStore";

// Mock stores
vi.mock("@/stores/authStore", () => ({
  useUser: vi.fn(() => MOCK_USERS.OWNER),
  useAuthStore: vi.fn(() => MOCK_AUTH_STATES.LOGGED_IN_OWNER),
}));

vi.mock("@/stores/uiStore", () => ({
  useUIStore: vi.fn(),
  useSidebar: vi.fn(() => ({
    open: false,
    setOpen: vi.fn(),
  })),
}));

// Mock components
vi.mock("@/components/ui/breadcrumb", () => ({
  ResortBreadcrumb: () => <nav data-testid="breadcrumb">Breadcrumb</nav>,
}));

vi.mock("@/components/navigation", () => ({
  MobileMenu: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="mobile-menu" aria-hidden={!isOpen}>
      {isOpen && (
        <button onClick={onClose} data-testid="close-mobile-menu">
          Close
        </button>
      )}
    </div>
  ),
  UserProfileDropdown: () => <div data-testid="user-profile-dropdown">Profile</div>,
  UserProfileButton: () => <button data-testid="user-profile-button">Profile</button>,
  ProjectSwitcher: ({ variant }: { variant: string }) => (
    <div data-testid={`project-switcher-${variant}`}>Project Switcher</div>
  ),
  NotificationBell: () => <button data-testid="notification-bell">Notifications</button>,
  SearchBar: ({ variant }: { variant: string }) => (
    <input data-testid={`search-bar-${variant}`} placeholder="Search..." />
  ),
}));

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="router-outlet">Page Content</div>,
  Link: ({ to, children, className, title, ...props }: any) => (
    <a href={to} className={className} title={title} {...props}>
      {children}
    </a>
  ),
  useLocation: vi.fn(() => ({ pathname: "/dashboard" })),
  useNavigate: vi.fn(() => vi.fn()),
}));

describe("DashboardLayout", () => {
  const mockSetSidebarOpen = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup UI store mock
    (useUIStore as any).mockImplementation((selector: any) => {
      const state = {
        isMobile: false,
        theme: "light",
        notifications: [],
        globalLoading: false,
        loadingMessage: null,
      };
      return selector ? selector(state) : state;
    });

    // Setup sidebar mock
    const { useSidebar } = require("@/stores/uiStore");
    (useSidebar as any).mockReturnValue({
      open: false,
      setOpen: mockSetSidebarOpen,
    });

    // Setup router mocks
    const { useNavigate } = require("@tanstack/react-router");
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  describe("Desktop Layout", () => {
    it("should render desktop layout with sidebar", () => {
      renderWithProviders(<DashboardLayout />);

      // Check Philippine branding
      expect(screen.getByText("Okaeri Resort")).toBeInTheDocument();
      expect(screen.getByText("Philippines")).toBeInTheDocument();

      // Check desktop sidebar is visible
      expect(screen.getByText("Okaeri Resort")).toBeInTheDocument();
      expect(screen.getByTestId("project-switcher-full")).toBeInTheDocument();

      // Check navigation items
      expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /bookings/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /expenses/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /properties/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /team/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
    });

    it("should highlight active navigation item", () => {
      renderWithProviders(<DashboardLayout />);

      const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
      expect(dashboardLink).toHaveClass("from-ocean-100");
    });

    it("should show navigation item descriptions on active state", () => {
      renderWithProviders(<DashboardLayout />);

      // Dashboard should be active and show description
      expect(screen.getByText("Overview & Analytics")).toBeInTheDocument();
    });

    it("should render user profile dropdown in sidebar", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("user-profile-dropdown")).toBeInTheDocument();
    });
  });

  describe("Mobile Layout", () => {
    beforeEach(() => {
      // Mock mobile viewport
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          isMobile: true,
          theme: "light",
          notifications: [],
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });
    });

    it("should render mobile header with menu button", () => {
      renderWithProviders(<DashboardLayout />);

      // Mobile menu button should be visible
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      expect(menuButton).toBeInTheDocument();

      // Desktop sidebar should be hidden
      expect(screen.queryByTestId("project-switcher-full")).not.toBeInTheDocument();

      // Mobile project switcher should be visible
      expect(screen.getByTestId("project-switcher-compact")).toBeInTheDocument();
    });

    it("should toggle mobile menu when menu button is clicked", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardLayout />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      await user.click(menuButton);

      expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);
    });

    it("should show mobile menu when sidebar is open", () => {
      // Mock sidebar open state
      const { useSidebar } = require("@/stores/uiStore");
      (useSidebar as any).mockReturnValue({
        open: true,
        setOpen: mockSetSidebarOpen,
      });

      renderWithProviders(<DashboardLayout />);

      const mobileMenu = screen.getByTestId("mobile-menu");
      expect(mobileMenu).toHaveAttribute("aria-hidden", "false");
    });

    it("should render mobile user profile button", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("user-profile-button")).toBeInTheDocument();
    });

    it("should close mobile menu when route changes", async () => {
      const { useLocation } = require("@tanstack/react-router");

      // Initial render
      (useLocation as any).mockReturnValue({ pathname: "/dashboard" });
      const { rerender } = renderWithProviders(<DashboardLayout />);

      // Simulate route change
      (useLocation as any).mockReturnValue({ pathname: "/bookings" });
      rerender(<DashboardLayout />);

      // Should close sidebar on mobile when route changes
      await waitFor(() => {
        expect(mockSetSidebarOpen).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("Header Elements", () => {
    it("should render search bar", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("search-bar-button")).toBeInTheDocument();
    });

    it("should render notification bell", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
    });

    it("should render connection status indicator", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByText("Online")).toBeInTheDocument();
    });

    it("should render new booking button with Philippine context", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardLayout />);

      const newBookingButton = screen.getByRole("button", { name: /create new booking/i });
      expect(newBookingButton).toBeInTheDocument();

      await user.click(newBookingButton);
      expect(mockNavigate).toHaveBeenCalledWith({ to: "/bookings" });
    });
  });

  describe("Philippine-specific Features", () => {
    it("should display Philippines location indicator", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByText("Philippines")).toBeInTheDocument();
    });

    it("should show resort branding with Filipino context", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByText("Okaeri Resort")).toBeInTheDocument();

      // Check for wave icon (typical Philippine resort imagery)
      const waveIcon = document.querySelector('[data-lucide="waves"]');
      expect(waveIcon).toBeInTheDocument();
    });

    it("should use appropriate color scheme for tropical theme", () => {
      renderWithProviders(<DashboardLayout />);

      const layout = screen.getByText("Okaeri Resort").closest("div");
      expect(layout).toHaveClass("from-ocean-500", "to-ocean-600");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels for navigation", () => {
      renderWithProviders(<DashboardLayout />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });
      expect(menuButton).toHaveAttribute("aria-label", "Open menu");
    });

    it("should have proper link titles for navigation items", () => {
      renderWithProviders(<DashboardLayout />);

      const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
      expect(dashboardLink).toHaveAttribute("title", "Overview & Analytics");
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<DashboardLayout />);

      const menuButton = screen.getByRole("button", { name: /open menu/i });

      // Focus and activate with keyboard
      menuButton.focus();
      await user.keyboard("[Enter]");

      expect(mockSetSidebarOpen).toHaveBeenCalledWith(true);
    });

    it("should have minimum touch target sizes for mobile", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          isMobile: true,
          theme: "light",
          notifications: [],
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<DashboardLayout />);

      // Check that interactive elements have minimum 44px height
      const menuButton = screen.getByRole("button", { name: /open menu/i });
      expect(menuButton).toHaveClass("min-h-[44px]");
    });
  });

  describe("Responsive Behavior", () => {
    it("should adapt navigation based on screen size", () => {
      // Test desktop
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          isMobile: false,
          theme: "light",
          notifications: [],
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      const { rerender } = renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("project-switcher-full")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /open menu/i })).not.toBeInTheDocument();

      // Test mobile
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          isMobile: true,
          theme: "light",
          notifications: [],
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      rerender(<DashboardLayout />);

      expect(screen.queryByTestId("project-switcher-full")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /open menu/i })).toBeInTheDocument();
    });

    it("should show appropriate button text based on screen size", () => {
      renderWithProviders(<DashboardLayout />);

      // Desktop should show full text
      const newBookingButton = screen.getByRole("button", { name: /create new booking/i });
      expect(newBookingButton).toHaveTextContent("New Booking");
    });
  });

  describe("Theme Support", () => {
    it("should apply dark theme classes when theme is dark", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          isMobile: false,
          theme: "dark",
          notifications: [],
          globalLoading: false,
          loadingMessage: null,
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<DashboardLayout />);

      const layout = document.querySelector(".dark\\:from-gray-950");
      expect(layout).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should handle navigation errors gracefully", async () => {
      const mockNavigateWithError = vi.fn().mockRejectedValue(new Error("Navigation failed"));
      const { useNavigate } = require("@tanstack/react-router");
      (useNavigate as any).mockReturnValue(mockNavigateWithError);

      const user = userEvent.setup();
      renderWithProviders(<DashboardLayout />);

      const newBookingButton = screen.getByRole("button", { name: /create new booking/i });

      // Should not throw error when navigation fails
      await expect(user.click(newBookingButton)).resolves.not.toThrow();
    });
  });

  describe("Performance", () => {
    it("should render efficiently without unnecessary re-renders", () => {
      const { rerender } = renderWithProviders(<DashboardLayout />);

      // Measure render performance
      const startTime = performance.now();
      rerender(<DashboardLayout />);
      const endTime = performance.now();

      // Should render quickly (less than 100ms)
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe("Integration with TanStack Router", () => {
    it("should render router outlet for page content", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("router-outlet")).toBeInTheDocument();
    });

    it("should render breadcrumb component", () => {
      renderWithProviders(<DashboardLayout />);

      expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    });

    it("should handle route-based navigation state", () => {
      const { useLocation } = require("@tanstack/react-router");
      (useLocation as any).mockReturnValue({ pathname: "/bookings" });

      renderWithProviders(<DashboardLayout />);

      const bookingsLink = screen.getByRole("link", { name: /bookings/i });
      expect(bookingsLink).toHaveClass("from-ocean-100");
    });
  });
});
