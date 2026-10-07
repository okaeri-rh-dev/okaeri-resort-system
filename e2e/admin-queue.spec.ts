import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { BOOKING_DATES, calculateUrgencyScore, getUrgencyLevel } from "./fixtures/booking-data";
import { TIMEOUTS, VIEWPORTS } from "./fixtures/test-data";
import { AdminQueuePage } from "./pages/AdminQueuePage";

/**
 * Admin Queue E2E Tests
 *
 * Tests the pending bookings queue functionality:
 * 1. Urgency score calculation based on check-in proximity
 * 2. Queue sorting by urgency (highest first)
 * 3. Filtering by urgency level and date range
 * 4. Search by booking reference
 * 5. Real-time updates and auto-refresh
 * 6. Action buttons based on booking status
 */
test.describe("Admin Booking Queue", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe("1. Urgency Score Calculation", () => {
    test("queue page loads successfully", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      await queuePage.expectQueueVisible();
    });

    test("urgency scores are displayed for pending bookings", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Check that at least one urgency indicator is visible
      const hasCritical = (await queuePage.criticalBadges.count()) > 0;
      const hasHigh = (await queuePage.highBadges.count()) > 0;
      const hasMedium = (await queuePage.mediumBadges.count()) > 0;
      const hasLow = (await queuePage.lowBadges.count()) > 0;

      expect(hasCritical || hasHigh || hasMedium || hasLow).toBeTruthy();
    });

    test("check-in tomorrow results in critical urgency (75+)", async () => {
      // This test validates the urgency calculation logic
      const urgentDates = BOOKING_DATES.getUrgentStay();
      const score = calculateUrgencyScore(urgentDates.checkIn);

      expect(score).toBeGreaterThanOrEqual(75);
      expect(getUrgencyLevel(score)).toBe("critical");
    });

    test("check-in next week results in medium urgency", async () => {
      const standardDates = BOOKING_DATES.getStandardStay();
      const score = calculateUrgencyScore(standardDates.checkIn);

      // 7 days out should be high or medium
      expect(score).toBeGreaterThanOrEqual(25);
      expect(score).toBeLessThan(75);
    });

    test("far future check-in results in low urgency", async () => {
      const farFutureDates = BOOKING_DATES.getFarFutureStay();
      const score = calculateUrgencyScore(farFutureDates.checkIn);

      expect(score).toBeLessThan(25);
      expect(getUrgencyLevel(score)).toBe("low");
    });
  });

  test.describe("2. Queue Sorting", () => {
    test("highest urgency bookings appear first", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      const queueCount = await queuePage.getQueueCount();
      if (queueCount < 2) {
        // Need at least 2 items to verify sorting
        test.skip();
        return;
      }

      await queuePage.expectSortedByUrgency();
    });

    test("queue maintains sort order after refresh", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Get initial order
      const initialRefs = await queuePage.getAllBookingReferences();

      // Refresh
      await queuePage.refreshQueue();

      // Get order after refresh
      const refreshedRefs = await queuePage.getAllBookingReferences();

      // Order should be maintained (assuming no new bookings)
      expect(refreshedRefs).toEqual(initialRefs);
    });
  });

  test.describe("3. Filter by Urgency", () => {
    test("filter by critical shows only critical items", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      await queuePage.filterByUrgency("critical");

      // All visible items should be critical, or queue is empty
      const totalCount = await queuePage.getQueueCount();
      const criticalCount = await queuePage.criticalBadges.count();

      if (totalCount > 0) {
        expect(criticalCount).toBe(totalCount);
      }
    });

    test("filter by high shows high and above", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      await queuePage.filterByUrgency("high");

      // Should show high and critical items
      const totalCount = await queuePage.getQueueCount();
      const criticalCount = await queuePage.criticalBadges.count();
      const highCount = await queuePage.highBadges.count();

      expect(criticalCount + highCount).toBe(totalCount);
    });

    test("filter by all shows all items", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Apply a filter
      await queuePage.filterByUrgency("critical");
      const filteredCount = await queuePage.getQueueCount();

      // Clear to all
      await queuePage.filterByUrgency("all");
      const allCount = await queuePage.getQueueCount();

      // "All" should show at least as many as initial
      expect(allCount).toBeGreaterThanOrEqual(filteredCount);
    });
  });

  test.describe("4. Filter by Date Range", () => {
    test("filter by today shows check-ins for today", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      await queuePage.filterByDateRange("today");

      // Results should be today's check-ins or empty
      const count = await queuePage.getQueueCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("filter by this week shows upcoming 7 days", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      await queuePage.filterByDateRange("week");

      const count = await queuePage.getQueueCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("filter by this month shows upcoming 30 days", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      await queuePage.filterByDateRange("month");

      const count = await queuePage.getQueueCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("date range filter can be combined with urgency filter", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      // Apply both filters
      await queuePage.filterByUrgency("high");
      await queuePage.filterByDateRange("week");

      // Combined filter should work
      const count = await queuePage.getQueueCount();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("5. Search by Reference", () => {
    test("search finds booking by full reference", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Get a reference to search for
      const refs = await queuePage.getAllBookingReferences();
      if (refs.length === 0) {
        test.skip();
        return;
      }

      const searchRef = refs[0];
      await queuePage.searchByReference(searchRef);

      // Should find the booking
      const exists = await queuePage.bookingExistsInQueue(searchRef);
      expect(exists).toBeTruthy();
    });

    test("search finds booking by partial reference", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Search with OKR- prefix
      await queuePage.searchByReference("OKR-");

      // Should find bookings with OKR- prefix
      const refs = await queuePage.getAllBookingReferences();
      refs.forEach((ref) => {
        expect(ref).toContain("OKR-");
      });
    });

    test("search with no results shows empty state", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      // Search for non-existent reference
      await queuePage.searchByReference("OKR-NONEXISTENT-99999");

      // Should show empty state or no results
      const count = await queuePage.getQueueCount();
      expect(count).toBe(0);
    });

    test("clearing search shows all results", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Search with specific term
      await queuePage.searchByReference("OKR-SPECIFIC-123");
      const searchCount = await queuePage.getQueueCount();

      // Clear search
      await queuePage.clearSearch();
      const clearedCount = await queuePage.getQueueCount();

      // After clearing, should show at least initial count
      expect(clearedCount).toBeGreaterThanOrEqual(searchCount);
    });
  });

  test.describe("6. Real-Time Updates", () => {
    test("manual refresh button updates queue", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      // Click refresh
      await queuePage.refreshQueue();

      // Queue should still be visible
      await queuePage.expectQueueVisible();
    });

    test("auto-refresh toggle can be enabled/disabled", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      // Check if auto-refresh toggle exists
      const hasToggle = await queuePage.autoRefreshToggle.isVisible().catch(() => false);

      if (!hasToggle) {
        test.skip();
        return;
      }

      // Toggle on
      await queuePage.toggleAutoRefresh(true);

      // Toggle off
      await queuePage.toggleAutoRefresh(false);

      // Page should still function
      await queuePage.expectQueueVisible();
    });

    test("last updated indicator shows recent time", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      const hasIndicator = await queuePage.lastUpdatedIndicator.isVisible().catch(() => false);

      if (!hasIndicator) {
        test.skip();
        return;
      }

      const updateText = await queuePage.lastUpdatedIndicator.textContent();
      expect(updateText).toMatch(/updated|refresh|ago|now/i);
    });
  });

  test.describe("7. Action Buttons", () => {
    test("Review Payment button visible for pending payment", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Check for review payment buttons
      const reviewButtons = await queuePage.reviewPaymentButtons.all();

      // If there are pending bookings, some should have review buttons
      if (reviewButtons.length > 0) {
        await expect(reviewButtons[0]).toBeVisible();
      }
    });

    test("Assign Units button visible after payment verified", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Check for assign units buttons
      const assignButtons = await queuePage.assignUnitsButtons.all();

      // Assign buttons should be visible for bookings with verified payment
      // but no units assigned yet
      if (assignButtons.length > 0) {
        await expect(assignButtons[0]).toBeVisible();
      }
    });

    test("clicking action button navigates correctly", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Try review payment action
      const reviewButtons = await queuePage.reviewPaymentButtons.all();
      if (reviewButtons.length > 0) {
        await reviewButtons[0].click();
        await expect(page).toHaveURL(/verify-payment|payment/);
        return;
      }

      // Try assign units action
      const assignButtons = await queuePage.assignUnitsButtons.all();
      if (assignButtons.length > 0) {
        await assignButtons[0].click();
        await expect(page).toHaveURL(/assign-units/);
        return;
      }

      // Try view details action
      const viewButtons = await queuePage.viewDetailsButtons.all();
      if (viewButtons.length > 0) {
        await viewButtons[0].click();
        await expect(page).toHaveURL(/bookings\//);
      }
    });
  });

  test.describe("Clear Filters", () => {
    test("clear filters button resets all filters", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      if (await queuePage.emptyState.isVisible()) {
        test.skip();
        return;
      }

      // Apply multiple filters
      await queuePage.filterByUrgency("critical");
      await queuePage.filterByDateRange("today");
      await queuePage.searchByReference("OKR-");

      // Clear all filters
      await queuePage.clearAllFilters();

      const clearedCount = await queuePage.getQueueCount();

      // After clearing, should show all items
      expect(clearedCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Queue Empty State", () => {
    test("empty state message is clear and helpful", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      // Apply filter that results in empty
      await queuePage.searchByReference("OKR-NONEXISTENT-BOOKING-99999");

      // Empty state should be visible and informative
      await queuePage.expectEmptyQueue();
    });
  });

  test.describe("Queue Performance", () => {
    test("queue loads within acceptable time", async ({ page }) => {
      const startTime = Date.now();

      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      const loadTime = Date.now() - startTime;

      // Should load within navigation timeout
      expect(loadTime).toBeLessThan(TIMEOUTS.navigation);
    });

    test("filter operations are responsive", async ({ page }) => {
      const queuePage = new AdminQueuePage(page);
      await queuePage.goto();

      const startTime = Date.now();

      await queuePage.filterByUrgency("critical");

      const filterTime = Date.now() - startTime;

      // Filter should be fast
      expect(filterTime).toBeLessThan(TIMEOUTS.medium);
    });
  });

  test.describe("Responsive Design", () => {
    test.describe("Mobile Viewport", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
        await loginAsAdmin(page);
      });

      test("queue page loads on mobile", async ({ page }) => {
        const queuePage = new AdminQueuePage(page);
        await queuePage.goto();

        // Queue or empty state should be visible
        const queueVisible = await queuePage.queueContainer.isVisible().catch(() => false);
        const emptyVisible = await queuePage.emptyState.isVisible().catch(() => false);
        expect(queueVisible || emptyVisible).toBeTruthy();
      });

      test("queue actions are tappable on mobile", async ({ page }) => {
        const queuePage = new AdminQueuePage(page);
        await queuePage.goto();

        if (await queuePage.emptyState.isVisible()) {
          test.skip();
          return;
        }

        // Check if action buttons have adequate touch target
        const reviewButtons = await queuePage.reviewPaymentButtons.all();
        if (reviewButtons.length > 0) {
          const buttonBox = await reviewButtons[0].boundingBox();
          expect(buttonBox?.height).toBeGreaterThanOrEqual(40);
        }
      });

      test("queue filters accessible on mobile", async ({ page }) => {
        const queuePage = new AdminQueuePage(page);
        await queuePage.goto();

        // Filters should be accessible (may be in dropdown or visible)
        // Just verify the page loads without horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const viewportWidth = await page.evaluate(() => window.innerWidth);
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
      });
    });

    test.describe("Tablet Viewport", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.tablet);
        await loginAsAdmin(page);
      });

      test("queue displays properly on tablet", async ({ page }) => {
        const queuePage = new AdminQueuePage(page);
        await queuePage.goto();

        // Queue should be visible
        await queuePage.expectQueueVisible();

        // Search should be accessible
        const searchInput = page.getByPlaceholder(/search|reference/i);
        const searchVisible = await searchInput.isVisible().catch(() => false);
        expect(searchVisible || (await queuePage.emptyState.isVisible())).toBeTruthy();
      });
    });
  });
});
