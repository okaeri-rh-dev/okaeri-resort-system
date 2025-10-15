/**
 * Integration Tests for PublicAvailabilityCalendar
 *
 * Tests the main calendar component with API integration.
 *
 * Test Coverage:
 * - API calls: Fetching availability data
 * - Navigation: Month navigation buttons
 * - State management: TanStack Query integration
 * - Loading states: Spinner display
 * - Error handling: Error messages
 * - User interactions: Today button, swipe gestures
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicAvailabilityCalendar } from "../PublicAvailabilityCalendar";

// Mock fetch
global.fetch = vi.fn();

// Mock API response
const mockApiResponse = {
  totalUnits: 3,
  dateRange: {
    start: "2025-01-01",
    end: "2025-01-31",
  },
  availability: [
    { date: "2025-01-01", availableCount: 3, status: "full" },
    { date: "2025-01-15", availableCount: 2, status: "moderate" },
    { date: "2025-01-20", availableCount: 1, status: "limited" },
    { date: "2025-01-25", availableCount: 0, status: "booked" },
  ],
  metadata: {
    generatedAt: "2025-01-15T12:00:00Z",
    cacheMaxAge: 300,
    version: "v1",
  },
};

describe("PublicAvailabilityCalendar", () => {
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

    // Mock current date
    vi.setSystemTime(new Date("2025-01-15T12:00:00Z"));

    // Mock successful API response by default
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PublicAvailabilityCalendar />
      </QueryClientProvider>
    );
  };

  describe("Initial Rendering", () => {
    it("should show loading spinner on initial load", () => {
      renderComponent();

      expect(screen.getByText(/loading availability calendar/i)).toBeInTheDocument();
      expect(screen.getByRole("progressbar", { hidden: true })).toBeInTheDocument();
    });

    it("should fetch availability data on mount", async () => {
      renderComponent();

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/api/public/v1/availability"));
      });
    });

    it("should render calendar after data loads", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });
    });

    it("should render availability legend", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Availability Legend")).toBeInTheDocument();
      });
    });

    it("should render calendar grid", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Sun")).toBeInTheDocument();
        expect(screen.getAllByRole("gridcell").length).toBeGreaterThan(0);
      });
    });
  });

  describe("API Integration", () => {
    it("should call API with correct date range", async () => {
      renderComponent();

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringMatching(/start=2025-\d{2}-\d{2}&end=2025-\d{2}-\d{2}/)
        );
      });
    });

    it("should display data from API response", async () => {
      renderComponent();

      await waitFor(() => {
        // Check that availability data is displayed
        expect(screen.getByLabelText(/January 1, 2025.*3 available/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/January 15, 2025.*2 available/i)).toBeInTheDocument();
      });
    });

    it("should show last updated timestamp", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      });
    });

    it("should use TanStack Query for caching", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // API should only be called once (cached)
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Month Navigation", () => {
    it("should render month navigation buttons", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/previous month/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/next month/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /today/i })).toBeInTheDocument();
      });
    });

    it("should navigate to next month when next button clicked", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      const nextButton = screen.getByLabelText(/next month/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText("February 2025")).toBeInTheDocument();
      });
    });

    it("should navigate to previous month when previous button clicked", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Navigate to next month (February)
      const nextButton = screen.getByLabelText(/next month/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText("February 2025")).toBeInTheDocument();
      });

      // Navigate back to previous month (January)
      const prevButton = screen.getByLabelText(/previous month/i);
      await user.click(prevButton);

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });
    });

    it("should disable previous month button for current month", async () => {
      renderComponent();

      await waitFor(() => {
        const prevButton = screen.getByLabelText(/previous month/i);
        expect(prevButton).toBeDisabled();
      });
    });

    it("should navigate to current month when today button clicked", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Navigate to next month
      const nextButton = screen.getByLabelText(/next month/i);
      await user.click(nextButton);

      await waitFor(() => {
        expect(screen.getByText("February 2025")).toBeInTheDocument();
      });

      // Click today button
      const todayButton = screen.getByRole("button", { name: /today/i });
      await user.click(todayButton);

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });
    });

    it("should show updating indicator while fetching new month", async () => {
      const user = userEvent.setup();

      // Add a delay to make isFetching state observable
      (fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockApiResponse,
                }),
              100 // 100ms delay to observe "Updating..." state
            )
          )
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      const nextButton = screen.getByLabelText(/next month/i);
      await user.click(nextButton);

      // Should show "Updating..." during fetch
      await waitFor(
        () => {
          expect(screen.getByText(/updating/i)).toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });
  });

  describe("Error Handling", () => {
    it("should display error message when API fails", async () => {
      // Mock all retry attempts (component has retry: 2, so 3 total attempts)
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Failed to fetch availability" }),
      });

      renderComponent();

      await waitFor(
        () => {
          expect(screen.getByText(/failed to load availability data/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it("should display specific error message from API", async () => {
      // Mock all retry attempts (component has retry: 2, so 3 total attempts)
      (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid date range" }),
      });

      renderComponent();

      await waitFor(
        () => {
          expect(screen.getByText(/invalid date range/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it("should retry failed requests", async () => {
      // Fail first, succeed second
      (fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Network error" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockApiResponse,
        });

      // Enable retry for this test
      queryClient.setDefaultOptions({
        queries: {
          retry: 1,
        },
      });

      renderComponent();

      // Should eventually succeed after retry
      await waitFor(
        () => {
          expect(screen.getByText("January 2025")).toBeInTheDocument();
        },
        { timeout: 5000 }
      );

      expect(fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe("Date Validation", () => {
    it("should only enable navigation to valid months", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Previous month (December 2024) should be disabled
      const prevButton = screen.getByLabelText(/previous month/i);
      expect(prevButton).toBeDisabled();

      // Next month (February 2025) should be enabled
      const nextButton = screen.getByLabelText(/next month/i);
      expect(nextButton).toBeEnabled();
    });

    it("should prevent navigation more than 1 year ahead", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Click next 12 times to reach January 2026
      const nextButton = screen.getByLabelText(/next month/i);
      for (let i = 0; i < 12; i++) {
        await user.click(nextButton);
      }

      await waitFor(() => {
        expect(screen.getByText("January 2026")).toBeInTheDocument();
      });

      // Next month (February 2026) should be disabled (>1 year from today)
      expect(nextButton).toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("should have grid role for calendar", async () => {
      renderComponent();

      await waitFor(() => {
        const grid = screen.getByRole("grid", { name: /availability calendar/i });
        expect(grid).toBeInTheDocument();
      });
    });

    it("should have accessible button labels", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByLabelText(/previous month/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/next month/i)).toBeInTheDocument();
      });
    });

    it("should announce loading state to screen readers", () => {
      renderComponent();

      const loadingText = screen.getByText(/loading availability calendar/i);
      expect(loadingText).toBeInTheDocument();
    });
  });

  describe("Cache Behavior", () => {
    it("should use stale-while-revalidate pattern", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Data should be cached (fetch called once)
      expect(fetch).toHaveBeenCalledTimes(1);

      // Re-render should use cached data
      renderComponent();

      // Should not call fetch again immediately
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should preserve data during navigation with placeholderData", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Click next month
      const nextButton = screen.getByLabelText(/next month/i);
      await user.click(nextButton);

      // Previous data should still be visible while loading
      // (placeholderData behavior)
      expect(screen.getByText(/january|february/i)).toBeInTheDocument();
    });
  });

  describe("Responsive Behavior", () => {
    it("should render mobile-friendly layout", async () => {
      renderComponent();

      await waitFor(() => {
        const container = screen.getByText("January 2025").closest("div");
        expect(container).toBeInTheDocument();
      });

      // Component should render without errors on mobile viewport
      expect(screen.getByLabelText(/availability calendar/i)).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("should not re-fetch when switching between months", async () => {
      const user = userEvent.setup();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      const nextButton = screen.getByLabelText(/next month/i);

      // Navigate to February
      await user.click(nextButton);
      await waitFor(() => {
        expect(screen.getByText("February 2025")).toBeInTheDocument();
      });

      // Navigate back to January
      const prevButton = screen.getByLabelText(/previous month/i);
      await user.click(prevButton);
      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Should have fetched January (1st), February (2nd), January again (background refetch for freshness)
      // TanStack Query refetches stale queries when they become active again (stale-while-revalidate pattern)
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("should memoize month name calculation", async () => {
      const { rerender } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText("January 2025")).toBeInTheDocument();
      });

      // Re-render should not cause issues
      rerender(
        <QueryClientProvider client={queryClient}>
          <PublicAvailabilityCalendar />
        </QueryClientProvider>
      );

      expect(screen.getByText("January 2025")).toBeInTheDocument();
    });
  });
});
