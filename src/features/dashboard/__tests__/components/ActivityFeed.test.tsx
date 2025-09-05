/**
 * ActivityFeed Component Tests
 * Phase 2.1 - RED Phase: Comprehensive test suite for activity feed display
 *
 * @description Tests for activity feed component displaying real-time resort
 * operations, guest activities, financial events, and compliance alerts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";

// Types and test utilities
import type { DashboardActivity, ActivityFeedState } from "../../types";
import { DashboardTestProvider } from "@tests/utils/dashboard-providers";
import { DashboardMockGenerator } from "@tests/utils/dashboard-mocks";
import { WebSocketEventSimulator } from "@tests/utils/websocket-mocks";
import {
  expectActivityTimeline,
  expectActivityPriority,
  expectActivityCategory,
  expectLiveRegion,
} from "@tests/utils/dashboard-assertions";

// Component under test (does not exist yet - RED phase)
import { ActivityFeed } from "../../components/ActivityFeed";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe("ActivityFeed Component", () => {
  let mockGenerator: DashboardMockGenerator;
  let wsSimulator: WebSocketEventSimulator;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockGenerator = new DashboardMockGenerator();
    wsSimulator = new WebSocketEventSimulator();
    user = userEvent.setup();
    vi.clearAllMocks();
    cleanup();
  });

  afterEach(() => {
    wsSimulator.cleanup();
    cleanup();
  });

  describe("Basic Rendering and Display", () => {
    it("should render activity feed with title", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withBookingActivities(3)
        .withFinancialActivities(2)
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("activity-feed")).toBeInTheDocument();
      expect(screen.getByText("Recent Activities")).toBeInTheDocument();
      expect(screen.getByRole("feed", { name: "Recent resort activities" })).toBeInTheDocument();
    });

    it("should display activities in chronological order", () => {
      const activities = mockGenerator.createActivityFeed().withBookingActivities(5).build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const activityItems = screen.getAllByTestId(/activity-item-\d+/);
      expect(activityItems).toHaveLength(5);

      // Verify chronological order (newest first)
      const timestamps = activityItems.map((item) => item.getAttribute("data-timestamp"));

      for (let i = 0; i < timestamps.length - 1; i++) {
        const current = new Date(timestamps[i]!);
        const next = new Date(timestamps[i + 1]!);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
    });

    it("should display activity category icons", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "booking",
          type: "check_in",
          guestName: "Juan Dela Cruz",
          roomNumber: "203",
        })
        .withActivity({
          category: "financial",
          type: "payment_received",
          amount: 3500,
          method: "gcash",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("icon-booking")).toHaveAttribute("aria-label", "Booking activity");
      expect(screen.getByTestId("icon-financial")).toHaveAttribute(
        "aria-label",
        "Financial activity"
      );
    });
  });

  describe("Booking Activities Display", () => {
    it("should display check-in activities with guest details", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "booking",
          type: "check_in",
          guestName: "Maria Santos",
          roomNumber: "105",
          bookingId: "BK-2024-001",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Maria Santos checked into Room 105")).toBeInTheDocument();
      expect(screen.getByText("BK-2024-001")).toBeInTheDocument();
      expect(screen.getByTestId("activity-priority-medium")).toBeInTheDocument();
    });

    it("should display check-out activities with final bill", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "booking",
          type: "check_out",
          guestName: "Pedro Rodriguez",
          roomNumber: "301",
          finalBill: 8500,
          paymentMethod: "gcash",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Pedro Rodriguez checked out of Room 301")).toBeInTheDocument();
      expect(screen.getByText("₱8,500.00")).toBeInTheDocument();
      expect(screen.getByText("via GCash")).toBeInTheDocument();
    });

    it("should highlight cancellations and no-shows", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "booking",
          type: "booking_cancelled",
          guestName: "Ana Reyes",
          bookingId: "BK-2024-002",
          refundAmount: 2500,
        })
        .withActivity({
          category: "booking",
          type: "no_show",
          guestName: "Carlos Garcia",
          bookingId: "BK-2024-003",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const cancellation = screen.getByText(/Ana Reyes.*cancelled/);
      expect(cancellation.closest('[data-testid^="activity-item"]')).toHaveClass("bg-yellow-50");

      const noShow = screen.getByText(/Carlos Garcia.*no-show/);
      expect(noShow.closest('[data-testid^="activity-item"]')).toHaveClass("bg-red-50");
    });
  });

  describe("Financial Activities Display", () => {
    it("should display payment received with Philippine payment methods", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "financial",
          type: "payment_received",
          amount: 5500,
          method: "gcash",
          reference: "GC-2024-1234",
          guestName: "Juan Dela Cruz",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Payment received: ₱5,500.00")).toBeInTheDocument();
      expect(screen.getByText("via GCash")).toBeInTheDocument();
      expect(screen.getByText("GC-2024-1234")).toBeInTheDocument();
      expect(screen.getByText("from Juan Dela Cruz")).toBeInTheDocument();
    });

    it("should display expense entries with categories", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "financial",
          type: "expense_logged",
          amount: 12500,
          description: "Monthly electricity bill",
          category: "utilities",
          receiptNumber: "RCP-2024-0456",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Expense logged: ₱12,500.00")).toBeInTheDocument();
      expect(screen.getByText("Monthly electricity bill")).toBeInTheDocument();
      expect(screen.getByText("Utilities")).toBeInTheDocument();
      expect(screen.getByText("RCP-2024-0456")).toBeInTheDocument();
    });

    it("should highlight revenue milestones", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "financial",
          type: "revenue_milestone",
          amount: 1000000,
          description: "Monthly revenue target reached",
          priority: "high",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const milestone = screen.getByText("Monthly revenue target reached");
      expect(milestone.closest('[data-testid^="activity-item"]')).toHaveClass("bg-green-50");
      expect(screen.getByText("₱1,000,000.00")).toBeInTheDocument();
      expect(screen.getByTestId("activity-priority-high")).toBeInTheDocument();
    });
  });

  describe("Operational Activities Display", () => {
    it("should display room cleaning activities", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "operational",
          type: "room_cleaned",
          roomNumber: "203",
          staffName: "Maria Reyes",
          duration: 45,
          qualityScore: 5,
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Room 203 cleaned")).toBeInTheDocument();
      expect(screen.getByText("by Maria Reyes")).toBeInTheDocument();
      expect(screen.getByText("45 minutes")).toBeInTheDocument();
      expect(screen.getByTestId("quality-score-5")).toBeInTheDocument();
    });

    it("should display maintenance activities with urgency", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "operational",
          type: "maintenance_required",
          location: "Pool area",
          description: "Pool pump malfunction",
          urgency: "high",
          estimatedCost: 15000,
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Maintenance required: Pool area")).toBeInTheDocument();
      expect(screen.getByText("Pool pump malfunction")).toBeInTheDocument();
      expect(screen.getByTestId("urgency-high")).toBeInTheDocument();
      expect(screen.getByText("Est. cost: ₱15,000.00")).toBeInTheDocument();
    });
  });

  describe("Compliance Activities (Philippine Context)", () => {
    it("should display BIR filing reminders", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "compliance",
          type: "bir_filing_due",
          filingType: "2551Q Quarterly VAT",
          dueDate: new Date("2024-04-20"),
          status: "upcoming",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("BIR Filing Due: 2551Q Quarterly VAT")).toBeInTheDocument();
      expect(screen.getByText("Due: Apr 20, 2024")).toBeInTheDocument();
      expect(screen.getByTestId("compliance-warning")).toBeInTheDocument();
    });

    it("should display DOH inspections and permits", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "compliance",
          type: "doh_inspection",
          inspector: "Dr. Santos",
          result: "passed",
          certificateNumber: "DOH-2024-0123",
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("DOH Inspection: Passed")).toBeInTheDocument();
      expect(screen.getByText("Inspector: Dr. Santos")).toBeInTheDocument();
      expect(screen.getByText("DOH-2024-0123")).toBeInTheDocument();
    });

    it("should highlight overdue compliance items", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "compliance",
          type: "business_permit_renewal",
          status: "overdue",
          daysOverdue: 5,
          penaltyAmount: 2500,
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const overdueItem = screen.getByText(/Business Permit.*overdue/);
      expect(overdueItem.closest('[data-testid^="activity-item"]')).toHaveClass(
        "bg-red-100",
        "border-red-500"
      );
      expect(screen.getByText("5 days overdue")).toBeInTheDocument();
      expect(screen.getByText("Penalty: ₱2,500.00")).toBeInTheDocument();
    });
  });

  describe("Emergency Activities", () => {
    it("should display emergency activities with critical priority", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "emergency",
          type: "medical_emergency",
          location: "Pool area",
          description: "Guest slip and fall injury",
          responseTime: 3,
          ambulanceCalled: true,
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const emergency = screen.getByText(/Medical Emergency.*Pool area/);
      expect(emergency.closest('[data-testid^="activity-item"]')).toHaveClass(
        "bg-red-200",
        "border-red-600",
        "animate-pulse"
      );
      expect(screen.getByTestId("activity-priority-critical")).toBeInTheDocument();
      expect(screen.getByText("Response time: 3 minutes")).toBeInTheDocument();
    });

    it("should display typhoon warnings", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          category: "emergency",
          type: "natural_disaster",
          subtype: "typhoon_warning",
          signal: 3,
          expectedLandfall: new Date("2024-07-15T14:00:00"),
          guestsEvacuated: 45,
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByText("Typhoon Warning: Signal #3")).toBeInTheDocument();
      expect(screen.getByText("Expected landfall: Jul 15, 2:00 PM")).toBeInTheDocument();
      expect(screen.getByText("45 guests evacuated")).toBeInTheDocument();
    });
  });

  describe("Activity Filtering and Search", () => {
    it("should filter activities by category", async () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withBookingActivities(3)
        .withFinancialActivities(2)
        .withOperationalActivities(2)
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      // Initially show all 7 activities
      expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(7);

      // Filter to booking only
      const bookingFilter = screen.getByRole("checkbox", { name: "Booking" });
      await user.click(bookingFilter);

      expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(3);
    });

    it("should filter by priority level", async () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({ priority: "critical" })
        .withActivity({ priority: "high" })
        .withActivity({ priority: "medium" })
        .withActivity({ priority: "low" })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      // Filter to high and critical only
      const priorityFilter = screen.getByRole("combobox", { name: "Priority filter" });
      await user.selectOptions(priorityFilter, ["critical", "high"]);

      expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(2);
    });

    it("should search activities by text", async () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({ guestName: "Juan Dela Cruz" })
        .withActivity({ guestName: "Maria Santos" })
        .withActivity({ description: "Pool maintenance" })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const searchInput = screen.getByRole("searchbox", { name: "Search activities" });
      await user.type(searchInput, "Juan");

      expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(1);
      expect(screen.getByText(/Juan Dela Cruz/)).toBeInTheDocument();
    });
  });

  describe("Real-time Updates and WebSocket", () => {
    it("should add new activities via WebSocket", async () => {
      const activities = mockGenerator.createActivityFeed().withBookingActivities(2).build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(2);

      // Simulate new activity via WebSocket
      act(() => {
        wsSimulator.simulateBookingActivity({
          type: "check_in",
          guestName: "New Guest",
          roomNumber: "404",
        });
      });

      await waitFor(() => {
        expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(3);
        expect(screen.getByText(/New Guest.*Room 404/)).toBeInTheDocument();
      });
    });

    it("should show live indicator during real-time updates", async () => {
      render(
        <DashboardTestProvider realtimeEnabled={true}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getByTestId("live-indicator")).toBeInTheDocument();
      expect(screen.getByText("Live")).toHaveClass("animate-pulse");
    });

    it("should handle high-frequency updates efficiently", async () => {
      const activities = mockGenerator.createActivityFeed().build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      // Simulate 50 rapid updates
      act(() => {
        wsSimulator.simulateHighFrequencyUpdates(50, 100); // 50 events over 100ms
      });

      await waitFor(() => {
        // Should batch and throttle updates
        const items = screen.getAllByTestId(/activity-item-\d+/);
        expect(items.length).toBeLessThanOrEqual(20); // Max visible items
      });

      // Should show "Load more" for additional items
      expect(screen.getByRole("button", { name: /Load more/ })).toBeInTheDocument();
    });
  });

  describe("Pagination and Infinite Scroll", () => {
    it("should implement virtual scrolling for large lists", () => {
      const activities = mockGenerator.createActivityFeed().withBookingActivities(100).build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const virtualContainer = screen.getByTestId("virtual-scroller");
      expect(virtualContainer).toBeInTheDocument();

      // Should only render visible items
      const visibleItems = screen.getAllByTestId(/activity-item-\d+/);
      expect(visibleItems.length).toBeLessThan(20); // Only render viewport items
    });

    it("should load more activities on scroll", async () => {
      const activities = mockGenerator.createActivityFeed().withBookingActivities(25).build();

      render(
        <DashboardTestProvider initialActivities={activities} pageSize={10}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(10);

      // Scroll to bottom
      const container = screen.getByTestId("activity-feed");
      fireEvent.scroll(container, { target: { scrollTop: container.scrollHeight } });

      await waitFor(() => {
        expect(screen.getAllByTestId(/activity-item-\d+/)).toHaveLength(20);
      });
    });
  });

  describe("Accessibility (WCAG 2.1 AA)", () => {
    it("should have no accessibility violations", async () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withBookingActivities(3)
        .withFinancialActivities(2)
        .build();

      const { container } = render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should announce new activities to screen readers", async () => {
      render(
        <DashboardTestProvider>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      // Simulate new activity
      act(() => {
        wsSimulator.simulateBookingActivity({
          type: "check_in",
          guestName: "Juan Dela Cruz",
          roomNumber: "203",
        });
      });

      await waitFor(() => {
        const liveRegion = screen.getByRole("status");
        expect(liveRegion).toHaveTextContent("New activity: Juan Dela Cruz checked into Room 203");
      });
    });

    it("should support keyboard navigation", async () => {
      const activities = mockGenerator.createActivityFeed().withBookingActivities(3).build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const firstActivity = screen.getAllByTestId(/activity-item-\d+/)[0];
      firstActivity.focus();
      expect(firstActivity).toHaveFocus();

      // Navigate with arrow keys
      await user.keyboard("{ArrowDown}");
      const secondActivity = screen.getAllByTestId(/activity-item-\d+/)[1];
      expect(secondActivity).toHaveFocus();
    });

    it("should provide time context for screen readers", () => {
      const activities = mockGenerator
        .createActivityFeed()
        .withActivity({
          timestamp: new Date("2024-03-15T10:30:00"),
        })
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const timeElement = screen.getByTestId("activity-time");
      expect(timeElement).toHaveAttribute("datetime", "2024-03-15T10:30:00");
      expect(timeElement).toHaveAttribute("aria-label", "March 15, 2024 at 10:30 AM");
    });
  });

  describe("Mobile Responsiveness", () => {
    it("should adapt layout for mobile viewport", () => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 375,
      });

      const activities = mockGenerator.createActivityFeed().withBookingActivities(5).build();

      render(
        <DashboardTestProvider initialActivities={activities} isMobile={true}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const feed = screen.getByTestId("activity-feed");
      expect(feed).toHaveClass("mobile-layout");

      // Should use compact display
      expect(screen.queryByTestId("activity-avatar")).not.toBeInTheDocument();
      expect(screen.getByTestId("compact-timestamp")).toBeInTheDocument();
    });

    it("should support swipe to dismiss on mobile", async () => {
      const onDismiss = vi.fn();

      const activities = mockGenerator.createActivityFeed().withBookingActivities(3).build();

      render(
        <DashboardTestProvider
          initialActivities={activities}
          isMobile={true}
          onActivityDismiss={onDismiss}
        >
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const firstActivity = screen.getAllByTestId(/activity-item-\d+/)[0];

      // Simulate swipe gesture
      fireEvent.touchStart(firstActivity, {
        touches: [{ clientX: 200, clientY: 100 }],
      });

      fireEvent.touchMove(firstActivity, {
        touches: [{ clientX: 50, clientY: 100 }],
      });

      fireEvent.touchEnd(firstActivity);

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalledWith(
          expect.objectContaining({
            activityId: expect.any(String),
          })
        );
      });
    });
  });

  describe("Performance", () => {
    it("should render efficiently with large datasets", () => {
      const startTime = performance.now();

      const activities = mockGenerator
        .createActivityFeed()
        .withBookingActivities(50)
        .withFinancialActivities(30)
        .withOperationalActivities(20)
        .build();

      render(
        <DashboardTestProvider initialActivities={activities}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(200); // Should render 100 items in < 200ms
    });

    it("should throttle rapid updates", async () => {
      const updateSpy = vi.fn();

      render(
        <DashboardTestProvider onActivityUpdate={updateSpy}>
          <ActivityFeed />
        </DashboardTestProvider>
      );

      // Simulate 100 rapid updates
      for (let i = 0; i < 100; i++) {
        act(() => {
          wsSimulator.simulateBookingActivity({
            type: "check_in",
            guestName: `Guest ${i}`,
            roomNumber: `${100 + i}`,
          });
        });
      }

      await waitFor(() => {
        // Should throttle updates
        expect(updateSpy.mock.calls.length).toBeLessThan(20);
      });
    });
  });
});
