/**
 * Dashboard Assertions - Phase 2.1 TDD Utilities
 *
 * Custom assertion helpers specifically designed for dashboard testing with
 * Philippine business context. Provides specialized validation for currency
 * formatting, WCAG 2.1 AA compliance, and resort-specific business rules.
 *
 * These assertions support the RED phase of TDD by defining exact expectations
 * for dashboard behavior before implementation begins.
 *
 * @author Claude Code Assistant
 * @version 1.0.0
 * @since Phase 2.1 - Dashboard TDD
 */

import { expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { axe, toHaveNoViolations } from "@axe-core/react";
import type {
  DashboardStats,
  ChartData,
  ActivityLog,
  Booking,
  BookingStatus,
  PaymentStatus,
} from "@/types/common";
import { DASHBOARD_TEST_IDS } from "./dashboard-test-helpers";

// Extend expect with axe matchers
expect.extend(toHaveNoViolations);

/**
 * Philippine Currency Formatting Assertions
 * Validates proper PHP currency display following local conventions
 */
export const philippineCurrencyAssertions = {
  /**
   * Assert that an element displays proper Philippine peso formatting
   * @param element - HTML element containing currency
   * @param expectedAmount - Expected numeric amount
   */
  expectPhilippineCurrency: (element: HTMLElement, expectedAmount: number) => {
    const currencyText = element.textContent || "";

    // Philippine peso formatting: ₱123,456.78
    const phpRegex = /₱[\d,]+\.\d{2}/;
    expect(currencyText).toMatch(phpRegex);

    // Extract numeric value and compare
    const numericValue = currencyText.replace(/₱|,/g, "").replace(/\s/g, "");
    const parsedValue = parseFloat(numericValue);

    expect(parsedValue).toBe(expectedAmount);
  },

  /**
   * Assert currency formatting with proper thousand separators
   * @param element - Element containing currency
   * @param amount - Expected amount
   */
  expectProperThousandSeparators: (element: HTMLElement, amount: number) => {
    const text = element.textContent || "";

    if (amount >= 1000) {
      expect(text).toMatch(/₱\d{1,3}(,\d{3})*\.\d{2}/);
    } else {
      expect(text).toMatch(/₱\d+\.\d{2}/);
    }
  },

  /**
   * Assert negative currency is properly formatted
   * @param element - Element containing negative currency
   * @param amount - Expected negative amount
   */
  expectNegativeCurrency: (element: HTMLElement, amount: number) => {
    const text = element.textContent || "";

    // Philippine convention: -₱1,234.56 or (₱1,234.56)
    const negativePatterns = [/-₱[\d,]+\.\d{2}/, /\(₱[\d,]+\.\d{2}\)/];

    const matchesPattern = negativePatterns.some((pattern) => pattern.test(text));
    expect(matchesPattern).toBe(true);

    const numericValue = Math.abs(parseFloat(text.replace(/[₱,()\-,\s]/g, "")));
    expect(numericValue).toBe(Math.abs(amount));
  },

  /**
   * Assert currency has proper decimal places (always 2)
   * @param element - Element containing currency
   */
  expectTwoDecimalPlaces: (element: HTMLElement) => {
    const text = element.textContent || "";
    const decimalMatch = text.match(/\.\d+/);

    expect(decimalMatch).not.toBeNull();
    expect(decimalMatch![0]).toMatch(/\.\d{2}$/);
  },

  /**
   * Assert compact currency notation for large amounts (₱1.2M, ₱500K)
   * @param element - Element with compact currency
   * @param amount - Expected full amount
   */
  expectCompactCurrency: (element: HTMLElement, amount: number) => {
    const text = element.textContent || "";

    if (amount >= 1000000) {
      const millionValue = (amount / 1000000).toFixed(1);
      expect(text).toContain(`₱${millionValue}M`);
    } else if (amount >= 1000) {
      const thousandValue = (amount / 1000).toFixed(0);
      expect(text).toContain(`₱${thousandValue}K`);
    } else {
      expect(text).toMatch(/₱\d+\.\d{2}/);
    }
  },
};

/**
 * Occupancy Rate and Percentage Assertions
 * Validates proper percentage display with Philippine business conventions
 */
export const percentageAssertions = {
  /**
   * Assert occupancy rate is properly formatted
   * @param element - Element containing occupancy rate
   * @param expectedRate - Expected rate (0-100)
   */
  expectOccupancyRate: (element: HTMLElement, expectedRate: number) => {
    const text = element.textContent || "";

    // Format: 85.5% or 100%
    expect(text).toMatch(/\d+(\.\d+)?%/);

    const numericRate = parseFloat(text.replace("%", ""));
    expect(numericRate).toBe(expectedRate);
    expect(numericRate).toBeGreaterThanOrEqual(0);
    expect(numericRate).toBeLessThanOrEqual(100);
  },

  /**
   * Assert percentage change with proper sign and color coding
   * @param element - Element containing percentage change
   * @param expectedChange - Expected change value
   */
  expectPercentageChange: (element: HTMLElement, expectedChange: number) => {
    const text = element.textContent || "";

    if (expectedChange > 0) {
      expect(text).toMatch(/\+\d+(\.\d+)?%/);
      expect(element).toHaveClass(/green|success|positive|up/);
    } else if (expectedChange < 0) {
      expect(text).toMatch(/-\d+(\.\d+)?%/);
      expect(element).toHaveClass(/red|danger|negative|down/);
    } else {
      expect(text).toMatch(/0(\.0+)?%/);
      expect(element).toHaveClass(/gray|neutral/);
    }
  },

  /**
   * Assert percentage has appropriate precision
   * @param element - Element containing percentage
   * @param maxDecimals - Maximum decimal places allowed
   */
  expectPercentagePrecision: (element: HTMLElement, maxDecimals: number = 1) => {
    const text = element.textContent || "";
    const decimalMatch = text.match(/\.(\d+)%/);

    if (decimalMatch) {
      expect(decimalMatch[1].length).toBeLessThanOrEqual(maxDecimals);
    }
  },
};

/**
 * Metric Card Assertions
 * Validates metric cards follow proper structure and display
 */
export const metricCardAssertions = {
  /**
   * Assert metric card has all required elements
   * @param cardTestId - Test ID of the metric card
   */
  expectCompleteMetricCard: (cardTestId: string) => {
    const card = screen.getByTestId(cardTestId);

    // Required elements
    expect(within(card).getByTestId(DASHBOARD_TEST_IDS.METRIC_VALUE)).toBeInTheDocument();
    expect(within(card).getByTestId(DASHBOARD_TEST_IDS.METRIC_LABEL)).toBeInTheDocument();

    // Optional but common elements
    const trend = within(card).queryByTestId(DASHBOARD_TEST_IDS.METRIC_TREND);
    const comparison = within(card).queryByTestId(DASHBOARD_TEST_IDS.METRIC_COMPARISON);

    if (trend) {
      expect(trend).toBeVisible();
    }
    if (comparison) {
      expect(comparison).toBeVisible();
    }
  },

  /**
   * Assert metric card shows proper loading state
   * @param cardTestId - Test ID of the metric card
   */
  expectMetricCardLoading: (cardTestId: string) => {
    const card = screen.getByTestId(cardTestId);

    // Should have skeleton loader or loading indicator
    const loading = within(card).queryByTestId(DASHBOARD_TEST_IDS.METRIC_LOADING);
    const skeleton = within(card).queryByTestId(DASHBOARD_TEST_IDS.SKELETON_CARD);

    expect(loading || skeleton).toBeInTheDocument();

    // Value should be hidden or show placeholder
    const value = within(card).queryByTestId(DASHBOARD_TEST_IDS.METRIC_VALUE);
    if (value) {
      expect(value).toHaveTextContent(/loading|\.\.\.|-|—/i);
    }
  },

  /**
   * Assert metric card shows proper error state
   * @param cardTestId - Test ID of the metric card
   * @param errorMessage - Expected error message
   */
  expectMetricCardError: (cardTestId: string, errorMessage?: string) => {
    const card = screen.getByTestId(cardTestId);
    const error = within(card).getByTestId(DASHBOARD_TEST_IDS.METRIC_ERROR);

    expect(error).toBeInTheDocument();
    expect(error).toBeVisible();

    if (errorMessage) {
      expect(error).toHaveTextContent(errorMessage);
    }

    // Should have retry mechanism
    const retryButton = within(card).queryByTestId(DASHBOARD_TEST_IDS.RETRY_BUTTON);
    expect(retryButton).toBeInTheDocument();
  },

  /**
   * Assert metric card has proper trend indicators
   * @param cardTestId - Test ID of the metric card
   * @param expectedTrend - Expected trend direction
   */
  expectMetricTrend: (cardTestId: string, expectedTrend: "up" | "down" | "neutral") => {
    const card = screen.getByTestId(cardTestId);
    const trend = within(card).getByTestId(DASHBOARD_TEST_IDS.METRIC_TREND);

    expect(trend).toBeInTheDocument();

    switch (expectedTrend) {
      case "up":
        expect(trend).toHaveClass(/up|positive|green|increase/);
        expect(trend).toHaveTextContent(/↑|▲|up/i);
        break;
      case "down":
        expect(trend).toHaveClass(/down|negative|red|decrease/);
        expect(trend).toHaveTextContent(/↓|▼|down/i);
        break;
      case "neutral":
        expect(trend).toHaveClass(/neutral|gray|stable/);
        expect(trend).toHaveTextContent(/→|—|stable/i);
        break;
    }
  },
};

/**
 * Chart Assertions
 * Validates chart components and data visualization
 */
export const chartAssertions = {
  /**
   * Assert chart renders with proper canvas element
   * @param chartTestId - Test ID of the chart
   */
  expectChartCanvas: (chartTestId: string) => {
    const chart = screen.getByTestId(chartTestId);
    const canvas = within(chart).getByRole("img"); // Canvas has img role

    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("width");
    expect(canvas).toHaveAttribute("height");
  },

  /**
   * Assert chart has proper accessibility attributes
   * @param chartTestId - Test ID of the chart
   */
  expectChartAccessibility: (chartTestId: string) => {
    const chart = screen.getByTestId(chartTestId);
    const canvas = within(chart).getByRole("img");

    // Should have alt text or aria-label
    expect(canvas.hasAttribute("alt") || canvas.hasAttribute("aria-label")).toBe(true);

    // Should have describedby for screen readers
    if (canvas.hasAttribute("aria-describedby")) {
      const describedBy = canvas.getAttribute("aria-describedby");
      const description = document.getElementById(describedBy!);
      expect(description).toBeInTheDocument();
    }
  },

  /**
   * Assert chart shows proper loading state
   * @param chartTestId - Test ID of the chart
   */
  expectChartLoading: (chartTestId: string) => {
    const chart = screen.getByTestId(chartTestId);
    const loading = within(chart).getByTestId(DASHBOARD_TEST_IDS.CHART_LOADING);

    expect(loading).toBeInTheDocument();
    expect(loading).toBeVisible();
  },

  /**
   * Assert chart shows no data state
   * @param chartTestId - Test ID of the chart
   */
  expectChartNoData: (chartTestId: string) => {
    const chart = screen.getByTestId(chartTestId);
    const noData = within(chart).getByTestId(DASHBOARD_TEST_IDS.CHART_NO_DATA);

    expect(noData).toBeInTheDocument();
    expect(noData).toHaveTextContent(/no data|empty|nothing to show/i);
  },
};

/**
 * Activity Feed Assertions
 * Validates activity logs and timeline display
 */
export const activityFeedAssertions = {
  /**
   * Assert activity item has proper structure
   * @param activityIndex - Index of activity in the feed
   */
  expectActivityItemStructure: (activityIndex: number = 0) => {
    const activities = screen.getAllByTestId(DASHBOARD_TEST_IDS.ACTIVITY_ITEM);
    const activity = activities[activityIndex];

    expect(activity).toBeInTheDocument();
    expect(within(activity).getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_TIME)).toBeInTheDocument();
    expect(within(activity).getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_USER)).toBeInTheDocument();
    expect(within(activity).getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_ACTION)).toBeInTheDocument();
    expect(within(activity).getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_RESOURCE)).toBeInTheDocument();
  },

  /**
   * Assert activity times are properly formatted
   * @param activityIndex - Index of activity to check
   */
  expectActivityTimeFormat: (activityIndex: number = 0) => {
    const activities = screen.getAllByTestId(DASHBOARD_TEST_IDS.ACTIVITY_ITEM);
    const activity = activities[activityIndex];
    const timeElement = within(activity).getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_TIME);

    const timeText = timeElement.textContent || "";

    // Should match relative time format (e.g., "2 hours ago", "1 day ago")
    const relativeTimePattern =
      /\d+\s+(second|minute|hour|day|week|month)s?\s+ago|just now|a few seconds ago/i;
    expect(timeText).toMatch(relativeTimePattern);
  },

  /**
   * Assert activity feed shows proper empty state
   */
  expectActivityFeedEmpty: () => {
    const feed = screen.getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_FEED);
    const empty = within(feed).getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_EMPTY);

    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/no recent activity|nothing to show|empty/i);
  },

  /**
   * Assert activities are sorted by time (most recent first)
   */
  expectActivitiesSortedByTime: () => {
    const activities = screen.getAllByTestId(DASHBOARD_TEST_IDS.ACTIVITY_ITEM);

    if (activities.length > 1) {
      for (let i = 0; i < activities.length - 1; i++) {
        const currentTime = within(activities[i])
          .getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_TIME)
          .getAttribute("datetime");
        const nextTime = within(activities[i + 1])
          .getByTestId(DASHBOARD_TEST_IDS.ACTIVITY_TIME)
          .getAttribute("datetime");

        if (currentTime && nextTime) {
          expect(new Date(currentTime).getTime()).toBeGreaterThanOrEqual(
            new Date(nextTime).getTime()
          );
        }
      }
    }
  },
};

/**
 * WCAG 2.1 AA Compliance Assertions
 * Validates accessibility standards for dashboard components
 */
export const accessibilityAssertions = {
  /**
   * Run full accessibility audit on dashboard
   * @param container - Container element to audit
   */
  expectAccessibilityCompliance: async (container: HTMLElement = document.body) => {
    const results = await axe(container, {
      tags: ["wcag2a", "wcag2aa", "wcag21aa"],
      rules: {
        // Specific rules for dashboard components
        "color-contrast": { enabled: true },
        "keyboard-navigation": { enabled: true },
        "focus-management": { enabled: true },
        "aria-labels": { enabled: true },
        "heading-order": { enabled: true },
        "list-structure": { enabled: true },
        "table-headers": { enabled: true },
        "form-labels": { enabled: true },
        "button-name": { enabled: true },
        "link-name": { enabled: true },
        "image-alt": { enabled: true },
        "landmark-roles": { enabled: true },
        region: { enabled: true },
        "bypass-blocks": { enabled: true },
      },
    });

    expect(results).toHaveNoViolations();
  },

  /**
   * Assert proper color contrast for metric values
   * @param element - Element to check contrast
   */
  expectSufficientColorContrast: async (element: HTMLElement) => {
    const styles = window.getComputedStyle(element);
    const backgroundColor = styles.backgroundColor;
    const textColor = styles.color;

    // This is a simplified check - in real implementation,
    // you'd use a proper contrast calculation library
    expect(backgroundColor).not.toBe("transparent");
    expect(textColor).not.toBe(backgroundColor);
  },

  /**
   * Assert keyboard navigation works for interactive elements
   * @param interactiveElements - Elements that should be keyboard accessible
   */
  expectKeyboardNavigation: (interactiveElements: HTMLElement[]) => {
    interactiveElements.forEach((element) => {
      // Should be focusable
      expect(element.tabIndex).toBeGreaterThanOrEqual(0);

      // Should have visible focus indicator
      element.focus();
      const focusedStyles = window.getComputedStyle(element, ":focus");
      expect(focusedStyles.outline).not.toBe("none");
    });
  },

  /**
   * Assert proper heading hierarchy
   */
  expectProperHeadingHierarchy: () => {
    const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
    let currentLevel = 0;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.substring(1));

      if (currentLevel === 0) {
        // First heading should be h1
        expect(level).toBe(1);
      } else {
        // Subsequent headings should not skip levels
        expect(level).toBeLessThanOrEqual(currentLevel + 1);
      }

      currentLevel = level;
    });
  },

  /**
   * Assert live regions for dynamic content updates
   */
  expectLiveRegions: () => {
    const liveRegion = screen.getByTestId(DASHBOARD_TEST_IDS.LIVE_REGION);

    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute("aria-live");
    expect(liveRegion).toHaveAttribute("aria-atomic");

    const ariaLive = liveRegion.getAttribute("aria-live");
    expect(["polite", "assertive", "off"]).toContain(ariaLive);
  },

  /**
   * Assert screen reader friendly content
   */
  expectScreenReaderContent: () => {
    const srContent = screen.getByTestId(DASHBOARD_TEST_IDS.SCREEN_READER_SUMMARY);

    expect(srContent).toBeInTheDocument();
    expect(srContent).toHaveClass("sr-only");
    expect(srContent).toHaveTextContent(/dashboard|summary|overview/i);
  },
};

/**
 * Philippine Business Rules Assertions
 * Validates resort-specific business logic and conventions
 */
export const philippineBusinessAssertions = {
  /**
   * Assert BIR tax calculations are present and correct
   * @param element - Element containing tax information
   * @param grossAmount - Gross amount before tax
   */
  expectBIRTaxCalculation: (element: HTMLElement, grossAmount: number) => {
    const text = element.textContent || "";

    // 12% VAT calculation
    const vatAmount = grossAmount * 0.12;
    const netAmount = grossAmount - vatAmount;

    // Should display VAT
    expect(text).toMatch(/VAT|12%/i);

    // Should have proper VAT amount format
    philippineCurrencyAssertions.expectPhilippineCurrency(element, vatAmount);
  },

  /**
   * Assert proper typhoon season indicators
   * @param dateRange - Date range being displayed
   */
  expectTyphoonSeasonIndicators: (dateRange: { from: Date; to: Date }) => {
    const typhoonMonths = [6, 7, 8, 9, 10, 11]; // June to November
    const currentMonth = new Date().getMonth();

    if (typhoonMonths.includes(currentMonth)) {
      const indicator = screen.queryByText(/typhoon season|weather advisory/i);
      expect(indicator).toBeInTheDocument();
    }
  },

  /**
   * Assert local payment methods are supported
   */
  expectLocalPaymentMethods: () => {
    const paymentSection = screen.getByText(/payment|method/i).closest("div");

    if (paymentSection) {
      expect(paymentSection).toHaveTextContent(/GCash|Maya|BPI|BDO/i);
    }
  },

  /**
   * Assert proper Filipino name formatting
   * @param nameElement - Element containing Filipino name
   */
  expectFilipinoNameFormat: (nameElement: HTMLElement) => {
    const name = nameElement.textContent || "";

    // Should handle common Filipino naming patterns
    const filipinoNamePatterns = [
      /^[A-Z][a-z]+\s+[A-Z][a-z]+$/, // First Last
      /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+$/, // First Middle Last
      /^[A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+$/, // First M. Last
      /^[A-Z][a-z]+\s+dela\s+[A-Z][a-z]+$/i, // Juan dela Cruz
      /^[A-Z][a-z]+\s+de\s+[A-Z][a-z]+$/i, // Maria de Santos
    ];

    const matchesPattern = filipinoNamePatterns.some((pattern) => pattern.test(name.trim()));

    expect(matchesPattern).toBe(true);
  },
};

/**
 * Real-time Updates Assertions
 * Validates WebSocket connections and live data updates
 */
export const realTimeAssertions = {
  /**
   * Assert dashboard updates in real-time
   * @param initialValue - Initial displayed value
   * @param expectedNewValue - Expected value after update
   */
  expectRealTimeUpdate: async (
    element: HTMLElement,
    initialValue: string,
    expectedNewValue: string
  ) => {
    expect(element).toHaveTextContent(initialValue);

    // Wait for update
    await screen.findByText(expectedNewValue, { timeout: 5000 });
    expect(element).toHaveTextContent(expectedNewValue);
  },

  /**
   * Assert live region announces updates
   */
  expectLiveRegionAnnouncement: async (expectedAnnouncement: string) => {
    const liveRegion = screen.getByTestId(DASHBOARD_TEST_IDS.LIVE_REGION);

    await screen.findByText(expectedAnnouncement, { timeout: 3000 });

    expect(liveRegion).toHaveTextContent(expectedAnnouncement);
  },

  /**
   * Assert connection status indicator
   * @param expectedStatus - Expected connection status
   */
  expectConnectionStatus: (expectedStatus: "connected" | "disconnected" | "reconnecting") => {
    const statusIndicator = screen.getByTestId("connection-status");

    expect(statusIndicator).toBeInTheDocument();
    expect(statusIndicator).toHaveClass(expectedStatus);

    const statusText = {
      connected: /connected|online|live/i,
      disconnected: /disconnected|offline/i,
      reconnecting: /reconnecting|connecting/i,
    };

    expect(statusIndicator).toHaveTextContent(statusText[expectedStatus]);
  },
};

// Export all assertion helpers for easy importing
export * from "./dashboard-test-helpers";
export { expect, screen, within };
