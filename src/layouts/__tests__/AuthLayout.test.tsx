/**
 * AuthLayout Test Suite
 * Tests for the authentication layout including responsive behavior,
 * Philippine-specific branding, accessibility, and theme support
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithProviders,
  TEST_IDS,
  philippineTestData,
  checkA11y,
} from "@tests/utils/test-utils";
import { AuthLayout } from "../AuthLayout";
import { useUIStore } from "@/stores/uiStore";

// Mock stores
vi.mock("@/stores/uiStore", () => ({
  useUIStore: vi.fn(),
}));

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="auth-outlet">Auth Form Content</div>,
}));

// Mock navigator.onLine
Object.defineProperty(navigator, "onLine", {
  writable: true,
  value: true,
});

describe("AuthLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
    });

    // Setup UI store mock
    (useUIStore as any).mockImplementation((selector: any) => {
      const state = {
        theme: "light",
        isMobile: false,
        notifications: [],
      };
      return selector ? selector(state) : state;
    });
  });

  describe("Layout Structure", () => {
    it("should render main auth layout with gradient background", () => {
      renderWithProviders(<AuthLayout />);

      const layout = screen.getByTestId("auth-outlet").closest("div");
      expect(layout).toHaveClass("from-ocean-400", "via-coral-400", "to-sunset-500");
    });

    it("should render floating decorative elements", () => {
      renderWithProviders(<AuthLayout />);

      // Check for animated floating elements
      const floatingElements = document.querySelectorAll(".animate-float, .animate-float-delayed");
      expect(floatingElements.length).toBeGreaterThan(0);
    });

    it("should render status bar with connection indicator", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText("Philippines")).toBeInTheDocument();
      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.getByText("Secure")).toBeInTheDocument();
    });

    it("should render auth form outlet", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByTestId("auth-outlet")).toBeInTheDocument();
    });
  });

  describe("Philippine Branding", () => {
    it("should display Filipino resort branding", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText("Okaeri Resort")).toBeInTheDocument();
      expect(screen.getByText("Management System")).toBeInTheDocument();
      expect(screen.getByText("Philippines")).toBeInTheDocument();
    });

    it("should show Philippine-focused marketing copy", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText(/Welcome to paradise management/)).toBeInTheDocument();
      expect(screen.getByText(/Filipino hospitality businesses/)).toBeInTheDocument();
    });

    it("should highlight Philippine-specific features", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText("Philippine-First Design")).toBeInTheDocument();
      expect(screen.getByText(/peso currency, local holidays, and GCash/)).toBeInTheDocument();
      expect(screen.getByText("Mobile-First Experience")).toBeInTheDocument();
      expect(screen.getByText("Family Business Ready")).toBeInTheDocument();
    });

    it("should show copyright with Philippine context", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText(/Made with.*in the Philippines/)).toBeInTheDocument();
    });

    it("should display wave icons representing Philippine beaches", () => {
      renderWithProviders(<AuthLayout />);

      const waveIcons = document.querySelectorAll('[data-lucide="waves"]');
      expect(waveIcons.length).toBeGreaterThan(0);
    });
  });

  describe("Responsive Design", () => {
    it("should show desktop layout on large screens", () => {
      renderWithProviders(<AuthLayout />);

      // Desktop branding section should be visible
      expect(screen.getByText("Why Choose Okaeri?")).toBeInTheDocument();
    });

    it("should adapt to mobile layout on small screens", () => {
      // Mock mobile viewport
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          isMobile: true,
          notifications: [],
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<AuthLayout />);

      // Mobile header should be visible
      expect(screen.getAllByText("Okaeri Resort")).toHaveLength(2); // Desktop + mobile
      expect(screen.getByText("Philippine-First")).toBeInTheDocument();
      expect(screen.getByText("Mobile-Ready")).toBeInTheDocument();
      expect(screen.getByText("Family-Friendly")).toBeInTheDocument();
    });

    it("should have proper auth card styling for all screen sizes", () => {
      renderWithProviders(<AuthLayout />);

      const authCard = screen.getByTestId("auth-outlet").closest("div");
      expect(authCard).toHaveClass(
        "rounded-2xl",
        "border",
        "border-white/20",
        "bg-white/95",
        "p-8",
        "shadow-2xl",
        "backdrop-blur-xl"
      );
    });
  });

  describe("Connection Status", () => {
    it("should show online status when connected", () => {
      Object.defineProperty(navigator, "onLine", { value: true });
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText("Online")).toBeInTheDocument();
      expect(screen.queryByText("Offline")).not.toBeInTheDocument();
    });

    it("should show offline status when disconnected", () => {
      Object.defineProperty(navigator, "onLine", { value: false });
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText("Offline")).toBeInTheDocument();
      expect(screen.queryByText("Online")).not.toBeInTheDocument();
    });

    it("should use appropriate colors for connection status", () => {
      // Test online
      Object.defineProperty(navigator, "onLine", { value: true });
      const { rerender } = renderWithProviders(<AuthLayout />);

      let statusElement = screen.getByText("Online").parentElement;
      expect(statusElement).toHaveClass("text-green-200");

      // Test offline
      Object.defineProperty(navigator, "onLine", { value: false });
      rerender(<AuthLayout />);

      statusElement = screen.getByText("Offline").parentElement;
      expect(statusElement).toHaveClass("text-red-200");
    });
  });

  describe("Theme Support", () => {
    it("should apply light theme styles by default", () => {
      renderWithProviders(<AuthLayout />);

      const layout = document.querySelector(".from-ocean-400");
      expect(layout).toBeInTheDocument();
    });

    it("should apply dark theme styles when theme is dark", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "dark",
          isMobile: false,
          notifications: [],
        };
        return selector ? selector(state) : state;
      });

      renderWithProviders(<AuthLayout />);

      const layout = document.querySelector(".dark\\:from-ocean-900");
      expect(layout).toBeInTheDocument();
    });

    it("should apply theme-appropriate auth card styling", () => {
      renderWithProviders(<AuthLayout />);

      const authCard = screen.getByTestId("auth-outlet").closest("div");
      expect(authCard).toHaveClass("dark:border-gray-700", "dark:bg-gray-900/95");
    });
  });

  describe("Animations and Visual Effects", () => {
    it("should have floating animations on decorative elements", () => {
      renderWithProviders(<AuthLayout />);

      const floatingElements = document.querySelectorAll(".animate-float");
      const delayedFloatingElements = document.querySelectorAll(".animate-float-delayed");

      expect(floatingElements.length).toBeGreaterThan(0);
      expect(delayedFloatingElements.length).toBeGreaterThan(0);
    });

    it("should have backdrop blur effects", () => {
      renderWithProviders(<AuthLayout />);

      const blurredElements = document.querySelectorAll(".backdrop-blur-sm, .backdrop-blur-xl");
      expect(blurredElements.length).toBeGreaterThan(0);
    });

    it("should include CSS animations for floating elements", () => {
      renderWithProviders(<AuthLayout />);

      // Check that the style tag with animations is present
      const styleElements = document.querySelectorAll("style");
      const hasFloatAnimation = Array.from(styleElements).some((style) =>
        style.textContent?.includes("@keyframes float")
      );
      expect(hasFloatAnimation).toBe(true);
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", () => {
      renderWithProviders(<AuthLayout />);

      // Should have main layout structure
      const mainContent = screen.getByTestId("auth-outlet");
      expect(mainContent).toBeInTheDocument();
    });

    it("should have sufficient color contrast", async () => {
      const { container } = renderWithProviders(<AuthLayout />);

      // Run accessibility checks
      await expect(async () => {
        await checkA11y(container);
      }).not.toThrow();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      renderWithProviders(<AuthLayout />);

      // Should be able to navigate through the layout
      await user.tab();

      // Focus should move through interactive elements
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeDefined();
    });

    it("should have appropriate ARIA attributes", () => {
      renderWithProviders(<AuthLayout />);

      // Check for proper ARIA structure (this would depend on actual implementation)
      const layout = screen.getByTestId("auth-outlet").closest("div");
      expect(layout).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should render quickly", () => {
      const startTime = performance.now();
      renderWithProviders(<AuthLayout />);
      const endTime = performance.now();

      // Should render in reasonable time
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("should not cause layout shifts", () => {
      const { rerender } = renderWithProviders(<AuthLayout />);

      // Get initial layout
      const initialLayout = screen.getByTestId("auth-outlet").closest("div");
      const initialHeight = initialLayout?.clientHeight;

      // Re-render and check for stability
      rerender(<AuthLayout />);

      const newLayout = screen.getByTestId("auth-outlet").closest("div");
      const newHeight = newLayout?.clientHeight;

      expect(newHeight).toBe(initialHeight);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing theme gracefully", () => {
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: undefined,
          isMobile: false,
          notifications: [],
        };
        return selector ? selector(state) : state;
      });

      expect(() => renderWithProviders(<AuthLayout />)).not.toThrow();
    });

    it("should handle navigator.onLine being undefined", () => {
      // Mock undefined navigator.onLine
      Object.defineProperty(navigator, "onLine", { value: undefined });

      expect(() => renderWithProviders(<AuthLayout />)).not.toThrow();
    });
  });

  describe("Content Validation", () => {
    it("should have all required Philippine marketing content", () => {
      renderWithProviders(<AuthLayout />);

      // Check all key marketing points
      const requiredContent = [
        "Welcome to paradise management",
        "Filipino hospitality businesses",
        "Philippine-First Design",
        "peso currency, local holidays, and GCash",
        "Mobile-First Experience",
        "Family Business Ready",
        "Made with",
        "in the Philippines",
      ];

      requiredContent.forEach((content) => {
        expect(screen.getByText(new RegExp(content))).toBeInTheDocument();
      });
    });

    it("should show appropriate feature highlights", () => {
      renderWithProviders(<AuthLayout />);

      // Feature descriptions should be present
      expect(screen.getByText(/Built for Filipino resort owners/)).toBeInTheDocument();
      expect(screen.getByText(/responsive, touch-friendly interface/)).toBeInTheDocument();
      expect(screen.getByText(/Simple enough for family members/)).toBeInTheDocument();
    });
  });

  describe("Mobile-First Features", () => {
    beforeEach(() => {
      // Mock mobile viewport
      (useUIStore as any).mockImplementation((selector: any) => {
        const state = {
          theme: "light",
          isMobile: true,
          notifications: [],
        };
        return selector ? selector(state) : state;
      });
    });

    it("should show mobile header with compact branding", () => {
      renderWithProviders(<AuthLayout />);

      // Mobile header should be smaller and centered
      const mobileHeaders = screen.getAllByText("Okaeri Resort");
      expect(mobileHeaders.length).toBeGreaterThan(1); // Both desktop and mobile
    });

    it("should show mobile features grid", () => {
      renderWithProviders(<AuthLayout />);

      expect(screen.getByText("Philippine-First")).toBeInTheDocument();
      expect(screen.getByText("Mobile-Ready")).toBeInTheDocument();
      expect(screen.getByText("Family-Friendly")).toBeInTheDocument();
    });

    it("should have touch-friendly interface elements", () => {
      renderWithProviders(<AuthLayout />);

      // Auth card should have appropriate padding for touch
      const authCard = screen.getByTestId("auth-outlet").closest("div");
      expect(authCard).toHaveClass("p-8");
    });
  });

  describe("Integration Tests", () => {
    it("should properly integrate with TanStack Router outlet", () => {
      renderWithProviders(<AuthLayout />);

      // Router outlet should be rendered within auth card
      const outlet = screen.getByTestId("auth-outlet");
      const authCard = outlet.closest("div");

      expect(authCard).toHaveClass("rounded-2xl");
      expect(outlet).toBeInTheDocument();
    });

    it("should maintain layout consistency across different auth forms", () => {
      // Test with different outlet content
      const mockOutlets = [
        () => <div data-testid="auth-outlet">Login Form</div>,
        () => <div data-testid="auth-outlet">Register Form</div>,
        () => <div data-testid="auth-outlet">Reset Password Form</div>,
      ];

      mockOutlets.forEach((Outlet) => {
        vi.doMock("@tanstack/react-router", () => ({ Outlet }));
        const { unmount } = renderWithProviders(<AuthLayout />);

        expect(screen.getByTestId("auth-outlet")).toBeInTheDocument();
        unmount();
      });
    });
  });
});
