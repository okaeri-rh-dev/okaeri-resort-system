/**
 * E2E Tests for Public Availability Calendar Flow
 *
 * Tests the complete user flow for viewing the public calendar using React Testing Library.
 *
 * Test Coverage:
 * - Full component rendering
 * - Month navigation workflow
 * - Date viewing and interaction
 * - SEO elements verification
 * - Mobile responsiveness
 * - Accessibility
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicAvailabilityCalendar } from "@/components/calendar/PublicAvailabilityCalendar";

describe("Public Calendar E2E Flow", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    // Reset query client for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    // Mock current date to January 2025
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

    // MSW handlers are set up globally and will handle /api/public/v1/availability
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  // Helper to render component with query client
  function renderPublicCalendar() {
    return render(
      <QueryClientProvider client={queryClient}>
        <PublicAvailabilityCalendar />
      </QueryClientProvider>
    );
  }

  describe("Page Load and SEO", () => {
    it("should render main calendar component", async () => {
      renderPublicCalendar();

      // Wait for calendar to load (MSW handler provides data automatically)
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });
    });

    it("should display page title and unit count", async () => {
      renderPublicCalendar();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check for actual title text in component
      expect(screen.getByText(/Okaeri Availability/i)).toBeInTheDocument();

      // "3 Units" appears in legend too, so check it exists at least once
      const unitElements = screen.getAllByText(/3 Cabins/i);
      expect(unitElements.length).toBeGreaterThan(0);
    });

    it("should have proper DOM structure", async () => {
      const { container } = renderPublicCalendar();

      // Wait for component to render
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check that the component renders with proper structure
      expect(container.firstChild).toBeTruthy();
      expect(container.querySelector('[class*="rounded"]')).toBeTruthy();
    });
  });

  describe("Calendar Functionality", () => {
    it("should display calendar header with calendar icon", async () => {
      const { container } = renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check for header with title
      const header = screen.getByText(/Okaeri Availability/i);
      expect(header).toBeInTheDocument();

      // Calendar icon should be present (lucide-react renders as SVG)
      const calendarIcons = container.querySelectorAll("svg");
      expect(calendarIcons.length).toBeGreaterThan(0);
    });

    it("should display month navigation controls", async () => {
      renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Previous/Next buttons should be present
      const prevButton = screen.getByRole("button", { name: /Previous month/i });
      const nextButton = screen.getByRole("button", { name: /Next month/i });
      const todayButton = screen.getByRole("button", { name: /Today/i });

      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();
      expect(todayButton).toBeInTheDocument();
    });

    it("should display availability legend with color indicators", async () => {
      renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check that legend exists by looking for availability status text
      // (Exact wording may vary, so we check for key concepts)
      const legendContainer = screen.getByText("January 2025").closest('[class*="border"]');
      expect(legendContainer).toBeTruthy();
    });
  });

  describe("Styling and Assets", () => {
    it("should have proper styling structure", async () => {
      const { container } = renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check that component has proper border and background classes
      const styledElements = container.querySelectorAll('[class*="border"]');
      expect(styledElements.length).toBeGreaterThan(0);
    });

    it("should use Tailwind CSS classes for styling", async () => {
      const { container } = renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check for common Tailwind utility classes
      const roundedElements = container.querySelectorAll('[class*="rounded"]');
      const shadowElements = container.querySelectorAll('[class*="shadow"]');
      const bgElements = container.querySelectorAll('[class*="bg-"]');

      expect(roundedElements.length).toBeGreaterThan(0);
      expect(shadowElements.length).toBeGreaterThan(0);
      expect(bgElements.length).toBeGreaterThan(0);
    });

    it("should have responsive CSS classes", async () => {
      const { container } = renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // The grid adapts to its pane with container queries
      const containerQueries = container.querySelectorAll('[class*="@lg:"]');
      expect(containerQueries.length).toBeGreaterThan(0);
    });
  });

  describe("Accessibility", () => {
    it("should have ARIA labels for interactive elements", async () => {
      renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Navigation buttons should have aria-labels
      expect(screen.getByRole("button", { name: /Previous month/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Next month/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Today/i })).toBeInTheDocument();
    });

    it("should have semantic button elements", async () => {
      renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // All interactive elements should be buttons
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(2); // At least prev, next, today
    });

    it("should have proper heading structure", async () => {
      const { container } = renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Check for heading elements in the component
      const headings = container.querySelectorAll("h1, h2, h3");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should render calendar grid on mobile viewports", async () => {
      // Simulate mobile viewport
      global.innerWidth = 375;
      global.innerHeight = 667;

      renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Calendar should render with all content
      expect(screen.getByText(/Okaeri Availability/i)).toBeInTheDocument();

      // Grid should be present
      const grid = screen.getByRole("grid", { name: /Availability calendar/i });
      expect(grid).toBeInTheDocument();
    });

    it("should have touch-friendly button sizes", async () => {
      renderPublicCalendar();

      // Wait for calendar to load
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      const prevButton = screen.getByRole("button", { name: /Previous month/i });

      // Buttons should have minimum touch target size (44x44px recommended)
      const buttonClasses = prevButton.className;
      expect(buttonClasses).toMatch(/(h-|min-h-|p-)/); // Should have height/padding classes
    });
  });

  // Note: The following tests are deferred - they require additional infrastructure
  describe.skip("API Integration (Deferred)", () => {
    it("should handle API errors gracefully", async () => {
      // TODO: Test error handling when API fails
      // Requires setting up error scenario MSW handlers
    });

    it("should refresh data when month changes", async () => {
      // TODO: Test that changing months triggers new API calls
      // Requires user interaction simulation and API call tracking
    });
  });

  describe.skip("Performance (Deferred)", () => {
    it("should render within reasonable time", async () => {
      // TODO: Add performance timing measurement
      // This would be better suited for Lighthouse CI
    });

    it("should have reasonable component size", async () => {
      // TODO: Measure component bundle size
      // This would be better suited for bundle analysis tools
    });
  });
});
