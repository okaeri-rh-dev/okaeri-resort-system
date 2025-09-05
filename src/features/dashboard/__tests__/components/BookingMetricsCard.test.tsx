/**
 * BookingMetricsCard Component Tests
 * Phase 2.1 - RED Phase: Comprehensive test suite for booking metrics display
 *
 * @description Tests for booking metrics card component displaying occupancy rate,
 * check-ins/check-outs, guest details, and real-time updates for Okaeri Resort
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

// Types and test utilities (these will be created by other agents)
import type { BookingMetrics } from "../../types";
import { DashboardTestProvider } from "@tests/utils/dashboard-providers";
import { DashboardMockGenerator } from "@tests/utils/dashboard-mocks";
import {
  dashboardRenderHelpers,
  loadingStateHelpers,
  errorStateHelpers,
  performanceHelpers,
} from "@tests/utils/dashboard-test-helpers";
import {
  expectBookingMetricCard,
  expectOccupancyRate,
  expectPercentageDisplay,
  expectGuestNameFormatting,
} from "@tests/utils/dashboard-assertions";

// Component under test (does not exist yet - RED phase)
import { BookingMetricsCard } from "../../components/BookingMetricsCard";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe("BookingMetricsCard Component", () => {
  let mockGenerator: DashboardMockGenerator;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockGenerator = new DashboardMockGenerator();
    user = userEvent.setup();
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Basic Rendering and Display", () => {
    it("should render booking metrics card with title", () => {
      const bookingMetrics = mockGenerator.withOccupancy(75).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("booking-metrics-card")).toBeInTheDocument();
      expect(screen.getByText("Bookings Overview")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Booking metrics" })).toBeInTheDocument();
    });

    it("should display current occupancy rate as percentage", () => {
      const bookingMetrics = mockGenerator.withOccupancy(87).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const occupancyElement = screen.getByTestId("occupancy-rate");
      expect(occupancyElement).toHaveTextContent("87%");
      expect(occupancyElement).toHaveAttribute("aria-valuenow", "87");
      expect(occupancyElement).toHaveAttribute("aria-valuemin", "0");
      expect(occupancyElement).toHaveAttribute("aria-valuemax", "100");
    });

    it("should show check-ins and check-outs for today", () => {
      const bookingMetrics = mockGenerator.withCheckIns(5).withCheckOuts(3).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("check-ins-today")).toHaveTextContent("5 Check-ins Today");
      expect(screen.getByTestId("check-outs-today")).toHaveTextContent("3 Check-outs Today");
    });

    it("should display room status breakdown", () => {
      const bookingMetrics = mockGenerator
        .withRoomStatus({ clean: 20, dirty: 5, maintenance: 2, outOfOrder: 1 })
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("rooms-clean")).toHaveTextContent("20 Clean");
      expect(screen.getByTestId("rooms-dirty")).toHaveTextContent("5 Dirty");
      expect(screen.getByTestId("rooms-maintenance")).toHaveTextContent("2 Maintenance");
      expect(screen.getByTestId("rooms-out-of-order")).toHaveTextContent("1 Out of Order");
    });
  });

  describe("Occupancy Rate Visualization", () => {
    it("should display occupancy as progress bar with correct value", () => {
      const bookingMetrics = mockGenerator.withOccupancy(65).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveAttribute("aria-valuenow", "65");
      expect(progressBar).toHaveAttribute("aria-label", "Current occupancy rate");
      expect(progressBar).toHaveStyle("--value: 65");
    });

    it("should show occupancy trend indicator", () => {
      const bookingMetrics = mockGenerator.withOccupancy(75).withTrend("up").build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const trendIndicator = screen.getByTestId("occupancy-trend");
      expect(trendIndicator).toHaveTextContent("↗");
      expect(trendIndicator).toHaveAttribute("aria-label", "Occupancy trending up");
      expect(trendIndicator).toHaveClass("text-green-600");
    });

    it("should display different colors based on occupancy levels", () => {
      const scenarios = [
        { occupancy: 25, color: "red", level: "low" },
        { occupancy: 55, color: "yellow", level: "medium" },
        { occupancy: 85, color: "green", level: "high" },
        { occupancy: 98, color: "orange", level: "critical" },
      ];

      scenarios.forEach(({ occupancy, color, level }) => {
        const bookingMetrics = mockGenerator.withOccupancy(occupancy).build().booking;

        const { unmount } = render(
          <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
            <BookingMetricsCard />
          </DashboardTestProvider>
        );

        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toHaveClass(`bg-${color}-500`);
        expect(progressBar).toHaveAttribute("data-level", level);

        unmount();
      });
    });
  });

  describe("Guest Information Display", () => {
    it("should display upcoming arrivals with Filipino guest names", () => {
      const bookingMetrics = mockGenerator
        .withUpcomingArrivals([
          {
            id: "BK-2024-001",
            guestName: "Juan Dela Cruz",
            roomNumber: "203",
            expectedTime: new Date(),
            contactNumber: "+63 917 123 4567",
            nationalityCode: "PH",
            adultsCount: 2,
            childrenCount: 1,
            paymentStatus: "paid",
          },
        ])
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("upcoming-arrivals")).toBeInTheDocument();
      expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
      expect(screen.getByText("Room 203")).toBeInTheDocument();
      expect(screen.getByText("BK-2024-001")).toBeInTheDocument();
    });

    it("should display guest count and nationality properly", () => {
      const bookingMetrics = mockGenerator
        .withUpcomingArrivals([
          {
            id: "BK-2024-002",
            guestName: "Maria Santos",
            roomNumber: "105",
            expectedTime: new Date(),
            contactNumber: "+63 918 987 6543",
            nationalityCode: "PH",
            adultsCount: 2,
            childrenCount: 0,
            paymentStatus: "partial",
          },
        ])
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByText("2 adults")).toBeInTheDocument();
      expect(screen.getByTestId("payment-status-partial")).toHaveTextContent("Partial Payment");
      expect(screen.getByTestId("guest-nationality-PH")).toBeInTheDocument();
    });

    it("should handle international guests with proper formatting", () => {
      const bookingMetrics = mockGenerator
        .withUpcomingArrivals([
          {
            id: "BK-2024-003",
            guestName: "John Smith",
            roomNumber: "301",
            expectedTime: new Date(),
            contactNumber: "+1 555 123 4567",
            nationalityCode: "US",
            adultsCount: 2,
            childrenCount: 2,
            paymentStatus: "paid",
          },
        ])
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByText("John Smith")).toBeInTheDocument();
      expect(screen.getByText("2 adults, 2 children")).toBeInTheDocument();
      expect(screen.getByTestId("guest-nationality-US")).toBeInTheDocument();
    });
  });

  describe("Booking Sources and Channels", () => {
    it("should display booking source breakdown", () => {
      const bookingMetrics = mockGenerator
        .withBookingSources({
          direct: 15,
          booking_com: 25,
          agoda: 20,
          airbnb: 10,
          walk_in: 5,
          referral: 3,
        })
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("source-direct")).toHaveTextContent("15");
      expect(screen.getByTestId("source-booking-com")).toHaveTextContent("25");
      expect(screen.getByTestId("source-agoda")).toHaveTextContent("20");
      expect(screen.getByTestId("source-airbnb")).toHaveTextContent("10");
      expect(screen.getByTestId("source-walk-in")).toHaveTextContent("5");
    });

    it("should calculate booking source percentages", () => {
      const bookingMetrics = mockGenerator
        .withBookingSources({
          direct: 20,
          booking_com: 30,
          agoda: 25,
          airbnb: 15,
          walk_in: 10,
          referral: 0,
        })
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("source-direct-percentage")).toHaveTextContent("20.0%");
      expect(screen.getByTestId("source-booking-com-percentage")).toHaveTextContent("30.0%");
      expect(screen.getByTestId("source-agoda-percentage")).toHaveTextContent("25.0%");
    });
  });

  describe("Loading and Error States", () => {
    it("should display loading skeleton when data is loading", () => {
      render(
        <DashboardTestProvider loading={true}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("booking-metrics-skeleton")).toBeInTheDocument();
      expect(screen.getByLabelText("Loading booking metrics")).toBeInTheDocument();

      // Should show skeleton placeholders
      expect(screen.getAllByTestId("skeleton-line")).toHaveLength(4);
      expect(screen.getByTestId("skeleton-progress-bar")).toBeInTheDocument();
    });

    it("should handle error state gracefully", () => {
      const error = "Failed to load booking metrics";

      render(
        <DashboardTestProvider error={error}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("booking-metrics-error")).toBeInTheDocument();
      expect(screen.getByText("Error loading booking data")).toBeInTheDocument();
      expect(screen.getByText(error)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("should allow retry when error occurs", async () => {
      const retryMock = vi.fn();

      render(
        <DashboardTestProvider error="Network error" onRetry={retryMock}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const retryButton = screen.getByRole("button", { name: "Retry" });
      await user.click(retryButton);

      expect(retryMock).toHaveBeenCalledOnce();
    });

    it("should show empty state when no booking data available", () => {
      render(
        <DashboardTestProvider initialBookingMetrics={null}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("booking-metrics-empty")).toBeInTheDocument();
      expect(screen.getByText("No booking data available")).toBeInTheDocument();
      expect(screen.getByText("Start by creating your first booking")).toBeInTheDocument();
    });
  });

  describe("Real-time Updates and WebSocket Integration", () => {
    it("should update occupancy rate when receiving real-time data", async () => {
      const { rerender } = render(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(60).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("occupancy-rate")).toHaveTextContent("60%");

      // Simulate real-time update
      const updatedMetrics = mockGenerator.withOccupancy(75).build().booking;

      rerender(
        <DashboardTestProvider initialBookingMetrics={updatedMetrics} realtimeUpdate={true}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      // Should show update animation
      expect(screen.getByTestId("occupancy-rate")).toHaveTextContent("75%");
      expect(screen.getByTestId("occupancy-rate")).toHaveClass("animate-pulse");
    });

    it("should display new check-in notification", async () => {
      render(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withCheckIns(3).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      // Simulate new check-in via WebSocket
      act(() => {
        window.dispatchEvent(
          new CustomEvent("dashboard-update", {
            detail: {
              type: "check_in",
              guestName: "Pedro Rodriguez",
              roomNumber: "205",
            },
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId("check-ins-today")).toHaveTextContent("4 Check-ins Today");
        expect(screen.getByTestId("new-checkin-notification")).toBeInTheDocument();
        expect(screen.getByText("Pedro Rodriguez checked in")).toBeInTheDocument();
      });
    });

    it("should animate occupancy changes smoothly", async () => {
      const { rerender } = render(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(70).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const progressBar = screen.getByRole("progressbar");
      expect(progressBar).toHaveStyle("--value: 70");

      // Update occupancy
      rerender(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(80).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      // Should have smooth transition animation
      expect(progressBar).toHaveClass("transition-all", "duration-500", "ease-in-out");

      await waitFor(() => {
        expect(progressBar).toHaveStyle("--value: 80");
      });
    });
  });

  describe("Accessibility (WCAG 2.1 AA Compliance)", () => {
    it("should have no accessibility violations", async () => {
      const bookingMetrics = mockGenerator.withOccupancy(75).withCheckIns(5).build().booking;

      const { container } = render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper ARIA labels and roles", () => {
      const bookingMetrics = mockGenerator.withOccupancy(65).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByRole("region", { name: "Booking metrics" })).toBeInTheDocument();
      expect(
        screen.getByRole("progressbar", { name: "Current occupancy rate" })
      ).toBeInTheDocument();
      expect(screen.getByLabelText("65% occupancy rate")).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const bookingMetrics = mockGenerator
        .withOccupancy(75)
        .withUpcomingArrivals([
          {
            id: "BK-2024-001",
            guestName: "Juan Dela Cruz",
            roomNumber: "203",
            expectedTime: new Date(),
            contactNumber: "+63 917 123 4567",
            nationalityCode: "PH",
            adultsCount: 2,
            childrenCount: 1,
            paymentStatus: "paid",
          },
        ])
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const card = screen.getByTestId("booking-metrics-card");
      const guestList = screen.getByTestId("upcoming-arrivals");

      // Should be focusable
      card.focus();
      expect(card).toHaveFocus();

      // Should navigate to guest list
      await user.tab();
      expect(guestList).toHaveFocus();
    });

    it("should announce occupancy changes to screen readers", async () => {
      const { rerender } = render(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(70).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      // Update occupancy
      rerender(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(80).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      await waitFor(() => {
        const liveRegion = screen.getByRole("status");
        expect(liveRegion).toHaveTextContent("Occupancy rate increased to 80%");
      });
    });
  });

  describe("Mobile Responsiveness and Touch Interaction", () => {
    it("should adapt layout for mobile viewport", () => {
      // Mock mobile viewport
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const bookingMetrics = mockGenerator.withOccupancy(75).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics} isMobile={true}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const card = screen.getByTestId("booking-metrics-card");
      expect(card).toHaveClass("mobile-layout", "flex-col");

      // Should stack elements vertically on mobile
      const occupancySection = screen.getByTestId("occupancy-section");
      const guestSection = screen.getByTestId("guest-section");

      expect(occupancySection).toHaveClass("w-full");
      expect(guestSection).toHaveClass("w-full", "mt-4");
    });

    it("should support touch gestures for refresh", async () => {
      const refreshMock = vi.fn();

      render(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(75).build().booking}
          onRefresh={refreshMock}
          isMobile={true}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const card = screen.getByTestId("booking-metrics-card");

      // Simulate pull-to-refresh gesture
      fireEvent.touchStart(card, {
        touches: [{ clientY: 100 }],
      });

      fireEvent.touchMove(card, {
        touches: [{ clientY: 150 }],
      });

      fireEvent.touchEnd(card);

      await waitFor(() => {
        expect(refreshMock).toHaveBeenCalledOnce();
      });
    });

    it("should have appropriate touch targets (44x44px minimum)", () => {
      const bookingMetrics = mockGenerator.withOccupancy(75).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics} isMobile={true}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const touchTargets = screen.getAllByRole("button");

      touchTargets.forEach((target) => {
        const styles = window.getComputedStyle(target);
        const minSize = parseInt(styles.minHeight) || parseInt(styles.height);
        expect(minSize).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe("Philippine Business Context Integration", () => {
    it("should display Filipino guest names with proper capitalization", () => {
      const bookingMetrics = mockGenerator
        .withUpcomingArrivals([
          {
            id: "BK-2024-001",
            guestName: "JUAN DELA CRUZ",
            roomNumber: "203",
            expectedTime: new Date(),
            contactNumber: "+63 917 123 4567",
            nationalityCode: "PH",
            adultsCount: 2,
            childrenCount: 1,
            paymentStatus: "paid",
          },
        ])
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      // Should display with proper capitalization
      expect(screen.getByText("Juan Dela Cruz")).toBeInTheDocument();
    });

    it("should format Philippine mobile numbers correctly", () => {
      const bookingMetrics = mockGenerator
        .withUpcomingArrivals([
          {
            id: "BK-2024-002",
            guestName: "Maria Santos",
            roomNumber: "105",
            expectedTime: new Date(),
            contactNumber: "09171234567", // Raw Philippine mobile
            nationalityCode: "PH",
            adultsCount: 1,
            childrenCount: 0,
            paymentStatus: "paid",
          },
        ])
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      // Should format as international
      expect(screen.getByText("+63 917 123 4567")).toBeInTheDocument();
    });

    it("should handle typhoon season occupancy warnings", () => {
      const bookingMetrics = mockGenerator.withSeason("typhoon").withOccupancy(95).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("typhoon-warning")).toBeInTheDocument();
      expect(screen.getByText("Monitor weather conditions for guest safety")).toBeInTheDocument();
      expect(screen.getByTestId("occupancy-rate")).toHaveClass("border-yellow-500");
    });
  });

  describe("Performance and Optimization", () => {
    it("should render within performance budget (< 100ms)", () => {
      const startTime = performance.now();

      const bookingMetrics = mockGenerator
        .withOccupancy(75)
        .withCheckIns(10)
        .withUpcomingArrivals(
          Array(20)
            .fill(null)
            .map((_, i) => ({
              id: `BK-2024-${String(i + 1).padStart(3, "0")}`,
              guestName: `Guest ${i + 1}`,
              roomNumber: `${200 + i}`,
              expectedTime: new Date(),
              contactNumber: "+63 917 123 4567",
              nationalityCode: "PH",
              adultsCount: 2,
              childrenCount: 0,
              paymentStatus: "paid",
            }))
        )
        .build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(100);
    });

    it("should virtualize large guest lists for performance", () => {
      const largeGuestList = Array(100)
        .fill(null)
        .map((_, i) => ({
          id: `BK-2024-${String(i + 1).padStart(3, "0")}`,
          guestName: `Guest ${i + 1}`,
          roomNumber: `${200 + i}`,
          expectedTime: new Date(),
          contactNumber: "+63 917 123 4567",
          nationalityCode: "PH",
          adultsCount: 2,
          childrenCount: 0,
          paymentStatus: "paid",
        }));

      const bookingMetrics = mockGenerator.withUpcomingArrivals(largeGuestList).build().booking;

      render(
        <DashboardTestProvider initialBookingMetrics={bookingMetrics}>
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      const virtualizedContainer = screen.getByTestId("virtualized-guest-list");
      expect(virtualizedContainer).toBeInTheDocument();

      // Should only render visible items
      const visibleItems = screen.getAllByTestId(/guest-item-\d+/);
      expect(visibleItems.length).toBeLessThan(20); // Only render visible items
    });

    it("should maintain 60fps during occupancy animations", async () => {
      const frameRateMonitor = performanceHelpers.createFrameRateMonitor();

      const { rerender } = render(
        <DashboardTestProvider
          initialBookingMetrics={mockGenerator.withOccupancy(60).build().booking}
        >
          <BookingMetricsCard />
        </DashboardTestProvider>
      );

      frameRateMonitor.start();

      // Trigger multiple rapid updates to test animation performance
      for (let i = 61; i <= 80; i++) {
        rerender(
          <DashboardTestProvider
            initialBookingMetrics={mockGenerator.withOccupancy(i).build().booking}
          >
            <BookingMetricsCard />
          </DashboardTestProvider>
        );

        await new Promise((resolve) => requestAnimationFrame(resolve));
      }

      const averageFrameRate = frameRateMonitor.stop();
      expect(averageFrameRate).toBeGreaterThanOrEqual(58); // Allow small variance from 60fps
    });
  });
});
