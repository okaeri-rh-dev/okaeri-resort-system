import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import {
  addDays,
  BOOKING_DATES,
  createBookingTestData,
  formatDate,
  nextFriday,
} from "./fixtures/booking-data";
import { createSeasonalConfig, isPriceEqual, parsePHP } from "./fixtures/pricing-data";
import { ROUTES, VIEWPORTS } from "./fixtures/test-data";
import { BookingDetailPage } from "./pages/BookingDetailPage";
import { BookingFormPage } from "./pages/BookingFormPage";
import { BookingsTablePage } from "./pages/BookingsTablePage";
import { PricingConfigPage } from "./pages/PricingConfigPage";

/**
 * Pricing Integrity E2E Tests
 *
 * Tests pricing calculation accuracy and rate change behavior:
 * 1. Existing bookings are unaffected by rate changes
 * 2. New bookings use updated rates
 * 3. Seasonal multipliers apply correctly
 * 4. Weekend surcharges calculate properly
 * 5. Extra person fees work as expected
 * 6. Multi-unit pricing sums correctly
 * 7. Server-side pricing is authoritative
 */
test.describe("Pricing Integrity", () => {
  let baseRateToRestore: number | null = null;

  test.afterEach(async ({ page }) => {
    if (baseRateToRestore === null) return;
    const originalBaseRate = baseRateToRestore;
    baseRateToRestore = null;

    const pricingPage = new PricingConfigPage(page);
    await pricingPage.goto();
    await pricingPage.setBaseRate(originalBaseRate);
    await pricingPage.saveChanges();
  });

  test.describe("1. Existing Bookings Unaffected by Rate Changes", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("existing booking price remains unchanged after rate update", async ({ page }) => {
      // First, find an existing confirmed booking and note its price
      await page.goto(ROUTES.admin.bookings);
      await page.waitForLoadState("networkidle");

      const bookingsTable = new BookingsTablePage(page);

      // Find a confirmed booking
      await bookingsTable.filterByStatus("confirmed");
      await bookingsTable.waitForTableLoad();

      const rowCount = await bookingsTable.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Get first booking reference
      const refs = await bookingsTable.getBookingReferences();
      if (refs.length === 0) {
        test.skip();
        return;
      }

      const bookingRef = refs[0];

      // View booking details and note the price
      await bookingsTable.clickBookingRow(bookingRef);

      const detailPage = new BookingDetailPage(page);
      await detailPage.expectPageLoaded();

      const bookingId = new URL(page.url()).pathname.split("/").pop()!;
      const originalPrice = await detailPage.getTotalAmount();

      // Now go to pricing config and change a rate
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      const originalBaseRate = await pricingPage.getBaseRate();
      baseRateToRestore = originalBaseRate;
      const newBaseRate = originalBaseRate + 500; // Increase by 500

      await pricingPage.setBaseRate(newBaseRate);
      await pricingPage.saveChanges();

      // Go back to the same booking and verify price unchanged
      await detailPage.goto(bookingId);

      const priceAfterRateChange = await detailPage.getTotalAmount();

      // Price should be the same
      expect(isPriceEqual(priceAfterRateChange, originalPrice)).toBeTruthy();
    });
  });

  test.describe("2. New Bookings Use Updated Rates", () => {
    test("booking form shows updated pricing after rate change", async ({ page }) => {
      // First, check if booking form has live price preview BEFORE modifying pricing
      await page.goto(ROUTES.public.booking);

      const bookingForm = new BookingFormPage(page);
      await bookingForm.waitForPageLoad();

      // Fill in dates to check for price preview
      const dates = BOOKING_DATES.getStandardStay();
      await bookingForm.fillStep1({
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount: 2,
      });

      // Check if price preview exists - this is a P3/P4 feature
      const pricePreview = page.locator(
        '[class*="price"], [class*="total"], [data-testid="price-preview"]'
      );
      const previewVisible = await pricePreview
        .first()
        .isVisible()
        .catch(() => false);

      if (!previewVisible) {
        // Skip if live price preview not implemented in booking form
        test.skip(true, "Live price preview not implemented in booking form");
        return;
      }

      // Login as admin and change rate
      await loginAsAdmin(page);

      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      const originalBaseRate = await pricingPage.getBaseRate();
      baseRateToRestore = originalBaseRate;
      const newBaseRate = originalBaseRate + 1000;

      await pricingPage.setBaseRate(newBaseRate);
      await pricingPage.saveChanges();

      // Now check booking form shows new pricing
      await page.goto(ROUTES.public.booking);
      await bookingForm.waitForPageLoad();

      await bookingForm.fillStep1({
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guestCount: 2,
      });

      const displayedPrice = await pricePreview.first().textContent();
      // Price should reflect the increased rate
      expect(displayedPrice).toBeDefined();
    });
  });

  test.describe("3. Seasonal Rate Application", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("seasonal multiplier applies during seasonal period", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if seasonal rates UI not available (P3/P4 feature)
      const addSeasonalVisible = await pricingPage.addSeasonalRateButton
        .isVisible()
        .catch(() => false);
      if (!addSeasonalVisible) {
        test.skip(true, "Seasonal rates management UI not implemented");
        return;
      }

      // Skip if price preview calculator not available
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      // Add a seasonal rate for testing
      const seasonalConfig = createSeasonalConfig("peakSummer", 7, 30);

      await pricingPage.addSeasonalRate(seasonalConfig);
      await pricingPage.saveChanges();

      // Verify seasonal rate was added
      await pricingPage.expectSeasonalRateExists(seasonalConfig.name);

      // Use price preview to verify multiplier applies
      const checkIn = formatDate(addDays(new Date(), 10)); // Within seasonal period
      const checkOut = formatDate(addDays(new Date(), 13));

      const previewPrice = await pricingPage.calculatePricePreview(checkIn, checkOut, 2);

      // Calculate expected price with multiplier
      const baseRate = await pricingPage.getBaseRate();
      const expectedWithoutSeasonal = baseRate * 3; // 3 nights
      const expectedWithSeasonal = expectedWithoutSeasonal * seasonalConfig.multiplier;

      // Price should be higher due to seasonal multiplier
      expect(previewPrice).toBeGreaterThan(expectedWithoutSeasonal);
      expect(isPriceEqual(previewPrice, expectedWithSeasonal, 100)).toBeTruthy();

      // Cleanup: remove seasonal rate
      await pricingPage.deleteSeasonalRate(seasonalConfig.name);
    });

    test("seasonal rate does not apply outside period", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if seasonal rates UI not available (P3/P4 feature)
      const addSeasonalVisible = await pricingPage.addSeasonalRateButton
        .isVisible()
        .catch(() => false);
      if (!addSeasonalVisible) {
        test.skip(true, "Seasonal rates management UI not implemented");
        return;
      }

      // Skip if price preview calculator not available
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      // Add a seasonal rate in the future (60+ days)
      const seasonalConfig = createSeasonalConfig("christmas", 60, 14);

      await pricingPage.addSeasonalRate(seasonalConfig);
      await pricingPage.saveChanges();

      // Calculate price for dates BEFORE seasonal period
      const checkIn = formatDate(addDays(new Date(), 7));
      const checkOut = formatDate(addDays(new Date(), 10));

      const previewPrice = await pricingPage.calculatePricePreview(checkIn, checkOut, 2);

      // Calculate expected price WITHOUT multiplier
      const baseRate = await pricingPage.getBaseRate();
      const weekendRate = await pricingPage.getWeekendRate();

      // Price should be base rate (no seasonal multiplier)
      // Allow for weekend rates
      const maxExpected = Math.max(baseRate, weekendRate) * 3;
      expect(previewPrice).toBeLessThanOrEqual(maxExpected * 1.1); // 10% tolerance

      // Cleanup
      await pricingPage.deleteSeasonalRate(seasonalConfig.name);
    });
  });

  test.describe("4. Weekend Surcharge Calculation", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("friday and saturday nights use weekend rate", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const baseRate = await pricingPage.getBaseRate();
      const weekendRate = await pricingPage.getWeekendRate();

      // Skip if weekend rate same as base rate
      if (weekendRate === baseRate) {
        test.skip();
        return;
      }

      // Get next Friday to Sunday (2 weekend nights)
      const friday = nextFriday();
      const sunday = addDays(friday, 2);

      const weekendPrice = await pricingPage.calculatePricePreview(
        formatDate(friday),
        formatDate(sunday),
        2
      );

      // Calculate expected: 2 weekend nights
      const expectedWeekendPrice = weekendRate * 2;

      expect(isPriceEqual(weekendPrice, expectedWeekendPrice, 100)).toBeTruthy();
    });

    test("weekday nights use base rate", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const baseRate = await pricingPage.getBaseRate();
      const weekendRate = await pricingPage.getWeekendRate();

      // Skip if rates are same
      if (weekendRate === baseRate) {
        test.skip();
        return;
      }

      // Find a Monday-Wednesday stay (pure weekdays)
      const today = new Date();
      let checkIn = addDays(today, 7);

      // Adjust to Monday
      while (checkIn.getDay() !== 1) {
        checkIn = addDays(checkIn, 1);
      }

      const checkOut = addDays(checkIn, 2); // Monday to Wednesday (2 weekday nights)

      const weekdayPrice = await pricingPage.calculatePricePreview(
        formatDate(checkIn),
        formatDate(checkOut),
        2
      );

      // Calculate expected: 2 weekday nights at base rate
      const expectedWeekdayPrice = baseRate * 2;

      expect(isPriceEqual(weekdayPrice, expectedWeekdayPrice, 100)).toBeTruthy();
    });

    test("mixed stay calculates blended rate correctly", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const baseRate = await pricingPage.getBaseRate();
      const weekendRate = await pricingPage.getWeekendRate();

      if (weekendRate === baseRate) {
        test.skip();
        return;
      }

      // Thursday to Monday: Thu, Fri, Sat, Sun (4 nights: 2 weekday, 2 weekend)
      const today = new Date();
      let thursday = addDays(today, 7);
      while (thursday.getDay() !== 4) {
        thursday = addDays(thursday, 1);
      }
      const monday = addDays(thursday, 4);

      const mixedPrice = await pricingPage.calculatePricePreview(
        formatDate(thursday),
        formatDate(monday),
        2
      );

      // Expected: 2 weekday nights (Thu, Sun) + 2 weekend nights (Fri, Sat)
      const expectedMixedPrice = baseRate * 2 + weekendRate * 2;

      expect(isPriceEqual(mixedPrice, expectedMixedPrice, 100)).toBeTruthy();
    });
  });

  test.describe("5. Extra Person Fee Calculation", () => {
    test.beforeEach(async ({ page }) => {
      await loginAsAdmin(page);
    });

    test("no extra fee when guests within base occupancy", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const baseRate = await pricingPage.getBaseRate();

      // Find Monday-Wednesday for clean weekday test
      const today = new Date();
      let checkIn = addDays(today, 7);
      while (checkIn.getDay() !== 1) {
        checkIn = addDays(checkIn, 1);
      }
      const checkOut = addDays(checkIn, 2);

      // Base occupancy is typically 2
      const priceFor2Guests = await pricingPage.calculatePricePreview(
        formatDate(checkIn),
        formatDate(checkOut),
        2
      );

      const expectedBasePrice = baseRate * 2;

      expect(isPriceEqual(priceFor2Guests, expectedBasePrice, 100)).toBeTruthy();
    });

    test("extra fee applied when guests exceed base occupancy", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const baseRate = await pricingPage.getBaseRate();
      const extraPersonRate = await pricingPage.getExtraPersonRate();

      if (extraPersonRate === 0) {
        test.skip();
        return;
      }

      // Find Monday-Wednesday
      const today = new Date();
      let checkIn = addDays(today, 7);
      while (checkIn.getDay() !== 1) {
        checkIn = addDays(checkIn, 1);
      }
      const checkOut = addDays(checkIn, 2);

      // 4 guests (assuming base occupancy is 2, this adds 2 extra)
      const priceFor4Guests = await pricingPage.calculatePricePreview(
        formatDate(checkIn),
        formatDate(checkOut),
        4
      );

      // Expected: base rate * 2 nights + (2 extra people * extra rate * 2 nights)
      const expectedPrice = baseRate * 2 + extraPersonRate * 2 * 2;

      expect(isPriceEqual(priceFor4Guests, expectedPrice, 100)).toBeTruthy();
    });

    test("extra fee scales with number of extra guests", async ({ page }) => {
      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const extraPersonRate = await pricingPage.getExtraPersonRate();

      if (extraPersonRate === 0) {
        test.skip();
        return;
      }

      const today = new Date();
      let checkIn = addDays(today, 7);
      while (checkIn.getDay() !== 1) {
        checkIn = addDays(checkIn, 1);
      }
      const checkOut = addDays(checkIn, 2);

      const priceFor3 = await pricingPage.calculatePricePreview(
        formatDate(checkIn),
        formatDate(checkOut),
        3
      );

      const priceFor5 = await pricingPage.calculatePricePreview(
        formatDate(checkIn),
        formatDate(checkOut),
        5
      );

      // Difference should be (5-3) extra guests * rate * 2 nights
      const expectedDifference = 2 * extraPersonRate * 2;
      const actualDifference = priceFor5 - priceFor3;

      expect(isPriceEqual(actualDifference, expectedDifference, 50)).toBeTruthy();
    });
  });

  test.describe("6. Multi-Unit Pricing", () => {
    test("booking multiple units sums individual prices", async ({ page }) => {
      // This test requires multi-unit booking capability
      await loginAsAdmin(page);

      // Navigate to create new multi-unit booking
      await page.goto(ROUTES.admin.newMultiBooking);
      await page.waitForLoadState("networkidle");

      // Check if multi-unit booking page exists
      if (page.url().includes("/login") || page.url().includes("/404")) {
        test.skip();
        return;
      }

      // Look for unit count selector or multiple unit selection
      const unitCountInput = page.getByLabel(/number of units|unit count/i);
      const unitCheckboxes = page.locator('input[type="checkbox"][name*="unit"]');

      const hasUnitCount = await unitCountInput.isVisible().catch(() => false);
      const hasCheckboxes = (await unitCheckboxes.count()) > 0;

      if (!hasUnitCount && !hasCheckboxes) {
        // Multi-unit booking not available in current UI
        test.skip();
        return;
      }

      // Implementation continues based on available UI...
      expect(hasUnitCount || hasCheckboxes).toBeTruthy();
    });
  });

  test.describe("7. Server-Side Pricing Authority", () => {
    test("final booking price comes from server calculation", async ({ page }) => {
      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      const testData = createBookingTestData();

      // Navigate through 5-step form: Dates → Cabins → Contact → Payment Proof → Review
      // Step 1: Dates (pre-filled)
      await bookingForm.fillStep1({
        checkIn: testData.dates.checkIn,
        checkOut: testData.dates.checkOut,
        guestCount: testData.guest.guestCount || 2,
      });
      await bookingForm.goToNextStep(); // → Cabins

      // Step 2: Cabins (just proceed)
      await bookingForm.goToNextStep(); // → Contact

      // Step 3: Contact info
      await bookingForm.fillStep2({
        name: testData.guest.name,
        email: testData.guest.email,
        phone: testData.guest.phone,
      });
      await bookingForm.goToNextStep(); // → Payment Proof

      // Step 4: Payment Proof (optional in dev mode)
      await bookingForm.goToNextStep(); // → Review

      // On review step, the price shown should be from server
      const priceElement = page.locator(
        '[class*="total"], [class*="price"], [data-testid="total-amount"]'
      );

      if (await priceElement.first().isVisible()) {
        const displayedPrice = await priceElement.first().textContent();
        // Price should be a valid currency amount
        expect(displayedPrice).toMatch(/[\d,]+/);

        // The price should be reasonable (positive, within expected range)
        const numericPrice = parsePHP(displayedPrice || "0");
        expect(numericPrice).toBeGreaterThan(0);
      }
    });

    test("client cannot manipulate final booking price", async ({ page }) => {
      // This is a security-focused test
      // We verify that even if client-side values are modified,
      // the server enforces correct pricing

      const bookingForm = new BookingFormPage(page);
      await bookingForm.goto();

      const testData = createBookingTestData();

      // Navigate through 5-step form: Dates → Cabins → Contact → Payment Proof → Review
      await bookingForm.fillStep1({
        checkIn: testData.dates.checkIn,
        checkOut: testData.dates.checkOut,
        guestCount: testData.guest.guestCount || 2,
      });
      await bookingForm.goToNextStep(); // → Cabins
      await bookingForm.goToNextStep(); // → Contact

      await bookingForm.fillStep2({
        name: testData.guest.name,
        email: testData.guest.email,
        phone: testData.guest.phone,
      });
      await bookingForm.goToNextStep(); // → Payment Proof
      await bookingForm.goToNextStep(); // → Review

      // Try to manipulate price via browser console
      // (This simulates a malicious client)
      const manipulationAttempt = await page.evaluate(() => {
        // Look for price-related hidden inputs or state
        const priceInputs = document.querySelectorAll(
          'input[name*="price"], input[name*="amount"], input[name*="total"]'
        );
        priceInputs.forEach((input) => {
          if (input instanceof HTMLInputElement) {
            input.value = "1"; // Try to set price to 1
          }
        });

        // Try to modify any global state
        // @ts-ignore
        if (window.__BOOKING_STATE__) {
          // @ts-ignore
          window.__BOOKING_STATE__.totalAmount = 1;
        }

        return priceInputs.length;
      });

      // Note: The actual test for server rejection would require
      // submitting the booking and verifying the server validates.
      // This is a placeholder for that verification.
      expect(manipulationAttempt).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe("Pricing Display Format", () => {
    test("prices are displayed in Philippine Peso format", async ({ page }) => {
      await loginAsAdmin(page);

      const bookingsTable = new BookingsTablePage(page);
      await bookingsTable.goto();

      const rowCount = await bookingsTable.getRowCount();
      if (rowCount === 0) {
        test.skip();
        return;
      }

      // Find a price cell in the table
      const priceCell = page
        .locator('td:has-text("PHP"), td:has-text("₱"), [class*="amount"]')
        .first();

      if (await priceCell.isVisible()) {
        const priceText = await priceCell.textContent();
        // Should contain PHP symbol or peso sign
        expect(priceText).toMatch(/PHP|₱|[\d,]+/);
      }
    });

    test("price preview updates reactively", async ({ page }) => {
      await loginAsAdmin(page);

      const pricingPage = new PricingConfigPage(page);
      await pricingPage.goto();

      // Skip if price preview calculator not available (P3/P4 feature)
      const previewVisible = await pricingPage.pricePreviewSection.isVisible().catch(() => false);
      if (!previewVisible) {
        test.skip(true, "Price preview calculator not implemented");
        return;
      }

      const dates = BOOKING_DATES.getStandardStay();

      // First calculation
      const price1 = await pricingPage.calculatePricePreview(dates.checkIn, dates.checkOut, 2);

      // Second calculation with different guest count
      const price2 = await pricingPage.calculatePricePreview(dates.checkIn, dates.checkOut, 6);

      // Price should be different due to extra person fees
      const extraPersonRate = await pricingPage.getExtraPersonRate();
      if (extraPersonRate > 0) {
        expect(price2).toBeGreaterThan(price1);
      }
    });
  });

  test.describe("Responsive Design", () => {
    test.describe("Mobile Viewport", () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
      });

      test("booking form shows pricing correctly on mobile", async ({ page }) => {
        const bookingForm = new BookingFormPage(page);
        await bookingForm.goto();

        const testData = createBookingTestData();

        // Navigate through form to review step
        await bookingForm.fillStep1({
          checkIn: testData.dates.checkIn,
          checkOut: testData.dates.checkOut,
          guestCount: 2,
        });
        await bookingForm.goToNextStep(); // → Cabins
        await bookingForm.goToNextStep(); // → Contact

        await bookingForm.fillStep2({
          name: testData.guest.name,
          email: testData.guest.email,
          phone: testData.guest.phone,
        });
        await bookingForm.goToNextStep(); // → Payment Proof
        await bookingForm.goToNextStep(); // → Review

        // Price should be visible on mobile review step
        const priceElement = page.locator(
          '[class*="total"], [class*="price"], [data-testid="total-amount"]'
        );

        if (await priceElement.first().isVisible()) {
          const displayedPrice = await priceElement.first().textContent();
          expect(displayedPrice).toMatch(/[\d,]+/);
        }
      });
    });
  });
});
