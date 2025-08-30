/**
 * Critical User Flows E2E Tests
 * @since Phase 1.7 - End-to-End Validation
 *
 * Comprehensive E2E testing for resort management critical workflows
 * including booking creation, expense tracking, and multi-project operations
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { format, addDays } from "date-fns";

// Test data
const TEST_RESORT = {
  name: "E2E Test Resort",
  location: "Batangas",
  businessType: "resort",
  currency: "PHP",
};

const TEST_USER = {
  email: "e2e.test@okaeri.ph",
  password: "E2ETestPass123!",
  firstName: "E2E",
  lastName: "Tester",
};

const GUEST_DATA = {
  name: "Juan Dela Cruz",
  email: "juan@example.com",
  phone: "+639171234567",
  address: "123 Beach Road, Batangas",
  notes: "VIP guest, requires airport pickup",
};

// Helper functions
async function login(
  page: Page,
  email: string = TEST_USER.email,
  password: string = TEST_USER.password
) {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/dashboard/);
}

async function logout(page: Page) {
  await page.click('[data-testid="user-menu"]');
  await page.click("text=Logout");
  await expect(page).toHaveURL("/login");
}

async function waitForNetworkIdle(page: Page) {
  await page.waitForLoadState("networkidle");
}

async function formatCurrency(amount: number): Promise<string> {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

// Main test suite
test.describe("Critical User Flows", () => {
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: "en-PH",
      timezoneId: "Asia/Manila",
    });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.describe("Complete Booking Management Flow", () => {
    let bookingId: string;

    test("should create a new booking with all details", async () => {
      await login(page);

      // Navigate to bookings
      await page.click('[data-testid="nav-bookings"]');
      await expect(page).toHaveURL(/bookings/);

      // Click new booking button
      await page.click('[data-testid="new-booking-btn"]');
      await expect(page).toHaveURL(/bookings\/new/);

      // Fill booking form
      const checkinDate = format(addDays(new Date(), 7), "yyyy-MM-dd");
      const checkoutDate = format(addDays(new Date(), 10), "yyyy-MM-dd");

      await page.fill('input[name="guestName"]', GUEST_DATA.name);
      await page.fill('input[name="guestEmail"]', GUEST_DATA.email);
      await page.fill('input[name="guestPhone"]', GUEST_DATA.phone);
      await page.fill('input[name="checkinDate"]', checkinDate);
      await page.fill('input[name="checkoutDate"]', checkoutDate);
      await page.fill('input[name="guestCount"]', "2");
      await page.fill('input[name="roomNumber"]', "Villa 5");
      await page.selectOption('select[name="roomType"]', "deluxe");
      await page.fill('input[name="totalAmount"]', "15000");
      await page.selectOption('select[name="paymentStatus"]', "partial");
      await page.fill('input[name="amountPaid"]', "5000");
      await page.selectOption('select[name="source"]', "direct");
      await page.fill('textarea[name="specialRequests"]', GUEST_DATA.notes);

      // Submit form
      await page.click('button[type="submit"]');

      // Wait for success message
      await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Booking created successfully"
      );

      // Should redirect to booking details
      await expect(page).toHaveURL(/bookings\/[a-f0-9-]+$/);

      // Extract booking ID from URL
      const url = page.url();
      bookingId = url.split("/").pop()!;

      // Verify booking details are displayed
      await expect(page.locator("h1")).toContainText("Booking Details");
      await expect(page.locator('[data-testid="guest-name"]')).toContainText(GUEST_DATA.name);
      await expect(page.locator('[data-testid="booking-status"]')).toContainText("Confirmed");
      await expect(page.locator('[data-testid="payment-status"]')).toContainText("Partial");
      await expect(page.locator('[data-testid="balance-due"]')).toContainText("₱10,000");
    });

    test("should add payment to booking", async () => {
      // Navigate to booking
      await page.goto(`/bookings/${bookingId}`);
      await waitForNetworkIdle(page);

      // Click add payment button
      await page.click('[data-testid="add-payment-btn"]');

      // Fill payment form
      await page.fill('input[name="amount"]', "5000");
      await page.selectOption('select[name="paymentMethod"]', "gcash");
      await page.fill('input[name="referenceNumber"]', "GC123456789");
      await page.fill('textarea[name="notes"]', "Second payment via GCash");

      // Upload receipt (mock file)
      const fileInput = await page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: "receipt.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake-image-data"),
      });

      // Submit payment
      await page.click('[data-testid="submit-payment-btn"]');

      // Verify payment added
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Payment added successfully"
      );
      await expect(page.locator('[data-testid="payment-list"]')).toContainText("₱5,000");
      await expect(page.locator('[data-testid="payment-list"]')).toContainText("GCash");
      await expect(page.locator('[data-testid="balance-due"]')).toContainText("₱5,000");
    });

    test("should check in guest", async () => {
      await page.goto(`/bookings/${bookingId}`);
      await waitForNetworkIdle(page);

      // Click check-in button
      await page.click('[data-testid="checkin-btn"]');

      // Confirm check-in dialog
      await page.click('[data-testid="confirm-checkin-btn"]');

      // Verify checked in
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Guest checked in successfully"
      );
      await expect(page.locator('[data-testid="booking-status"]')).toContainText("Checked In");
      await expect(page.locator('[data-testid="checkin-time"]')).toBeVisible();
    });

    test("should checkout guest and complete booking", async () => {
      await page.goto(`/bookings/${bookingId}`);
      await waitForNetworkIdle(page);

      // Add final payment
      await page.click('[data-testid="add-payment-btn"]');
      await page.fill('input[name="amount"]', "5000");
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.click('[data-testid="submit-payment-btn"]');

      // Click checkout button
      await page.click('[data-testid="checkout-btn"]');

      // Fill checkout form
      await page.fill('textarea[name="checkoutNotes"]', "Guest satisfied with stay");
      await page.check('input[name="roomCleaned"]');
      await page.check('input[name="minibarChecked"]');

      // Confirm checkout
      await page.click('[data-testid="confirm-checkout-btn"]');

      // Verify checkout
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Guest checked out successfully"
      );
      await expect(page.locator('[data-testid="booking-status"]')).toContainText("Completed");
      await expect(page.locator('[data-testid="payment-status"]')).toContainText("Paid");
    });

    test("should view booking in calendar view", async () => {
      await page.goto("/bookings");
      await waitForNetworkIdle(page);

      // Switch to calendar view
      await page.click('[data-testid="view-calendar"]');

      // Verify booking appears in calendar
      await expect(page.locator('[data-testid="calendar-view"]')).toBeVisible();
      await expect(page.locator(`[data-booking-id="${bookingId}"]`)).toBeVisible();
      await expect(page.locator(`[data-booking-id="${bookingId}"]`)).toContainText(GUEST_DATA.name);

      // Click booking in calendar to view details
      await page.click(`[data-booking-id="${bookingId}"]`);
      await expect(page).toHaveURL(`/bookings/${bookingId}`);
    });
  });

  test.describe("Expense Tracking Flow", () => {
    let expenseId: string;

    test("should create expense with receipt upload", async () => {
      await login(page);

      // Navigate to expenses
      await page.click('[data-testid="nav-expenses"]');
      await expect(page).toHaveURL(/expenses/);

      // Click new expense button
      await page.click('[data-testid="new-expense-btn"]');

      // Fill expense form
      await page.fill('input[name="description"]', "Cleaning supplies for villas");
      await page.fill('input[name="amount"]', "3500");
      await page.selectOption('select[name="category"]', "supplies");
      await page.fill('input[name="vendor"]', "ABC Supplies Store");
      await page.fill('input[name="expenseDate"]', format(new Date(), "yyyy-MM-dd"));
      await page.selectOption('select[name="paymentMethod"]', "cash");
      await page.fill('textarea[name="notes"]', "Monthly cleaning supplies purchase");

      // Upload receipt
      const fileInput = await page.locator('input[name="receipt"]');
      await fileInput.setInputFiles({
        name: "receipt.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake-receipt-image"),
      });

      // Submit expense
      await page.click('button[type="submit"]');

      // Verify expense created
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Expense recorded successfully"
      );
      await expect(page).toHaveURL(/expenses\/[a-f0-9-]+$/);

      // Extract expense ID
      const url = page.url();
      expenseId = url.split("/").pop()!;

      // Verify expense details
      await expect(page.locator('[data-testid="expense-description"]')).toContainText(
        "Cleaning supplies for villas"
      );
      await expect(page.locator('[data-testid="expense-amount"]')).toContainText("₱3,500");
      await expect(page.locator('[data-testid="expense-category"]')).toContainText("Supplies");
      await expect(page.locator('[data-testid="receipt-preview"]')).toBeVisible();
    });

    test("should edit expense details", async () => {
      await page.goto(`/expenses/${expenseId}`);
      await waitForNetworkIdle(page);

      // Click edit button
      await page.click('[data-testid="edit-expense-btn"]');

      // Update expense
      await page.fill('input[name="amount"]', "3800");
      await page.fill('textarea[name="notes"]', "Updated: Included additional items");

      // Save changes
      await page.click('[data-testid="save-expense-btn"]');

      // Verify update
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Expense updated successfully"
      );
      await expect(page.locator('[data-testid="expense-amount"]')).toContainText("₱3,800");
      await expect(page.locator('[data-testid="expense-notes"]')).toContainText(
        "Updated: Included additional items"
      );
    });

    test("should filter and search expenses", async () => {
      await page.goto("/expenses");
      await waitForNetworkIdle(page);

      // Filter by category
      await page.selectOption('[data-testid="filter-category"]', "supplies");
      await waitForNetworkIdle(page);

      // Verify filtered results
      await expect(
        page.locator('[data-testid="expense-list"] [data-testid="expense-item"]')
      ).toHaveCount(1);
      await expect(page.locator('[data-testid="expense-item"]').first()).toContainText(
        "Cleaning supplies"
      );

      // Search expenses
      await page.fill('[data-testid="search-expenses"]', "cleaning");
      await page.keyboard.press("Enter");
      await waitForNetworkIdle(page);

      // Verify search results
      await expect(page.locator('[data-testid="expense-item"]')).toHaveCount(1);

      // Filter by date range
      await page.fill(
        '[data-testid="filter-start-date"]',
        format(addDays(new Date(), -7), "yyyy-MM-dd")
      );
      await page.fill('[data-testid="filter-end-date"]', format(new Date(), "yyyy-MM-dd"));
      await page.click('[data-testid="apply-filters-btn"]');
      await waitForNetworkIdle(page);

      // Verify date filtered results
      await expect(page.locator('[data-testid="expense-item"]')).toHaveCount(1);
    });

    test("should generate expense report", async () => {
      await page.goto("/expenses");
      await waitForNetworkIdle(page);

      // Click generate report
      await page.click('[data-testid="generate-report-btn"]');

      // Select report options
      await page.selectOption('[data-testid="report-type"]', "monthly");
      await page.selectOption('[data-testid="report-month"]', format(new Date(), "yyyy-MM"));
      await page.check('input[name="includeReceipts"]');

      // Generate report
      await page.click('[data-testid="generate-btn"]');

      // Wait for report generation
      await expect(page.locator('[data-testid="report-status"]')).toContainText(
        "Generating report..."
      );
      await expect(page.locator('[data-testid="download-report-btn"]')).toBeVisible({
        timeout: 10000,
      });

      // Verify report details
      await expect(page.locator('[data-testid="report-total"]')).toContainText("₱3,800");
      await expect(page.locator('[data-testid="report-categories"]')).toContainText(
        "Supplies: ₱3,800"
      );
    });
  });

  test.describe("Multi-Project Management Flow", () => {
    let project1Id: string;
    let project2Id: string;

    test("should create second resort project", async () => {
      await login(page);

      // Click project switcher
      await page.click('[data-testid="project-switcher"]');
      await expect(page.locator('[data-testid="project-menu"]')).toBeVisible();

      // Click create new project
      await page.click('[data-testid="create-project-btn"]');
      await expect(page).toHaveURL(/projects\/new/);

      // Fill project form
      await page.fill('input[name="projectName"]', "Beach Paradise Resort");
      await page.selectOption('select[name="businessType"]', "resort");
      await page.fill('input[name="location"]', "Palawan");
      await page.selectOption('select[name="currency"]', "PHP");
      await page.fill('input[name="address"]', "456 Island Road, Palawan");
      await page.fill('input[name="phone"]', "+639181234567");
      await page.fill('input[name="email"]', "info@beachparadise.ph");
      await page.fill('input[name="website"]', "https://beachparadise.ph");
      await page.fill('textarea[name="description"]', "Luxury beachfront resort in Palawan");

      // Submit form
      await page.click('button[type="submit"]');

      // Verify project created
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Project created successfully"
      );
      await expect(page).toHaveURL(/dashboard/);
      await expect(page.locator('[data-testid="current-project"]')).toContainText(
        "Beach Paradise Resort"
      );

      // Extract project ID
      project2Id =
        (await page.getAttribute('[data-testid="current-project"]', "data-project-id")) || "";
    });

    test("should switch between projects", async () => {
      // Get first project ID
      await page.click('[data-testid="project-switcher"]');
      const firstProject = page.locator('[data-testid="project-item"]').first();
      project1Id = (await firstProject.getAttribute("data-project-id")) || "";

      // Switch to first project
      await firstProject.click();
      await waitForNetworkIdle(page);

      // Verify switched to first project
      await expect(page.locator('[data-testid="current-project"]')).toContainText(
        "E2E Test Resort"
      );

      // Create booking in first project
      await page.goto("/bookings/new");
      await page.fill('input[name="guestName"]', "Project 1 Guest");
      await page.fill('input[name="checkinDate"]', format(addDays(new Date(), 1), "yyyy-MM-dd"));
      await page.fill('input[name="checkoutDate"]', format(addDays(new Date(), 3), "yyyy-MM-dd"));
      await page.fill('input[name="guestCount"]', "2");
      await page.fill('input[name="totalAmount"]', "8000");
      await page.click('button[type="submit"]');

      // Switch to second project
      await page.click('[data-testid="project-switcher"]');
      await page.click(`[data-project-id="${project2Id}"]`);
      await waitForNetworkIdle(page);

      // Verify switched to second project
      await expect(page.locator('[data-testid="current-project"]')).toContainText(
        "Beach Paradise Resort"
      );

      // Create booking in second project
      await page.goto("/bookings/new");
      await page.fill('input[name="guestName"]', "Project 2 Guest");
      await page.fill('input[name="checkinDate"]', format(addDays(new Date(), 2), "yyyy-MM-dd"));
      await page.fill('input[name="checkoutDate"]', format(addDays(new Date(), 4), "yyyy-MM-dd"));
      await page.fill('input[name="guestCount"]', "3");
      await page.fill('input[name="totalAmount"]', "12000");
      await page.click('button[type="submit"]');
    });

    test("should verify data isolation between projects", async () => {
      // Check bookings in project 1
      await page.click('[data-testid="project-switcher"]');
      await page.click(`[data-project-id="${project1Id}"]`);
      await page.goto("/bookings");
      await waitForNetworkIdle(page);

      // Verify project 1 bookings
      await expect(page.locator('[data-testid="booking-list"]')).toContainText("Project 1 Guest");
      await expect(page.locator('[data-testid="booking-list"]')).not.toContainText(
        "Project 2 Guest"
      );

      // Check bookings in project 2
      await page.click('[data-testid="project-switcher"]');
      await page.click(`[data-project-id="${project2Id}"]`);
      await page.goto("/bookings");
      await waitForNetworkIdle(page);

      // Verify project 2 bookings
      await expect(page.locator('[data-testid="booking-list"]')).toContainText("Project 2 Guest");
      await expect(page.locator('[data-testid="booking-list"]')).not.toContainText(
        "Project 1 Guest"
      );

      // Check expenses isolation
      await page.goto("/expenses");
      await waitForNetworkIdle(page);

      // Project 2 should have no expenses
      await expect(page.locator('[data-testid="no-expenses-message"]')).toBeVisible();

      // Switch back to project 1
      await page.click('[data-testid="project-switcher"]');
      await page.click(`[data-project-id="${project1Id}"]`);
      await page.goto("/expenses");
      await waitForNetworkIdle(page);

      // Project 1 should have expenses
      await expect(page.locator('[data-testid="expense-list"]')).toContainText("Cleaning supplies");
    });

    test("should manage project settings", async () => {
      // Navigate to project settings
      await page.goto("/settings/project");
      await waitForNetworkIdle(page);

      // Update project details
      await page.fill('input[name="projectName"]', "E2E Test Resort Updated");
      await page.fill('input[name="phone"]', "+639191234567");
      await page.selectOption('select[name="timezone"]', "Asia/Manila");
      await page.check('input[name="enableNotifications"]');

      // Save settings
      await page.click('[data-testid="save-settings-btn"]');

      // Verify settings saved
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Settings updated successfully"
      );
      await expect(page.locator('[data-testid="current-project"]')).toContainText(
        "E2E Test Resort Updated"
      );
    });

    test("should manage team members", async () => {
      await page.goto("/team");
      await waitForNetworkIdle(page);

      // Add team member
      await page.click('[data-testid="add-member-btn"]');

      // Fill team member form
      await page.fill('input[name="email"]', "staff@okaeri.ph");
      await page.fill('input[name="firstName"]', "Staff");
      await page.fill('input[name="lastName"]', "Member");
      await page.selectOption('select[name="role"]', "staff");
      await page.check('input[name="canViewBookings"]');
      await page.check('input[name="canManageExpenses"]');

      // Send invitation
      await page.click('[data-testid="send-invitation-btn"]');

      // Verify invitation sent
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Invitation sent successfully"
      );
      await expect(page.locator('[data-testid="team-list"]')).toContainText("staff@okaeri.ph");
      await expect(page.locator('[data-testid="team-list"]')).toContainText("Pending");
    });
  });

  test.describe("Offline Functionality", () => {
    test("should work offline with cached data", async () => {
      await login(page);

      // Load dashboard to cache data
      await page.goto("/dashboard");
      await waitForNetworkIdle(page);

      // Go offline
      await context.setOffline(true);

      // Navigation should still work
      await page.click('[data-testid="nav-bookings"]');
      await expect(page).toHaveURL(/bookings/);

      // Cached data should be visible
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="booking-list"]')).toBeVisible();

      // Try to create booking offline
      await page.click('[data-testid="new-booking-btn"]');
      await page.fill('input[name="guestName"]', "Offline Guest");
      await page.fill('input[name="checkinDate"]', format(addDays(new Date(), 5), "yyyy-MM-dd"));
      await page.fill('input[name="checkoutDate"]', format(addDays(new Date(), 7), "yyyy-MM-dd"));
      await page.fill('input[name="guestCount"]', "2");
      await page.fill('input[name="totalAmount"]', "10000");
      await page.click('button[type="submit"]');

      // Should queue for sync
      await expect(page.locator('[data-testid="sync-queue-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="sync-queue-indicator"]')).toContainText("1 pending");

      // Go back online
      await context.setOffline(false);

      // Wait for sync
      await expect(page.locator('[data-testid="sync-queue-indicator"]')).not.toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="toast-success"]')).toContainText(
        "Data synced successfully"
      );

      // Verify booking was created
      await page.reload();
      await expect(page.locator('[data-testid="booking-list"]')).toContainText("Offline Guest");
    });
  });

  test.describe("Performance Metrics", () => {
    test("should load dashboard within performance budget", async () => {
      const startTime = Date.now();
      await page.goto("/dashboard");
      await page.waitForLoadState("domcontentloaded");
      const loadTime = Date.now() - startTime;

      expect(loadTime).toBeLessThan(3000); // 3 seconds max

      // Check for Web Vitals
      const metrics = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals: any = {};

            entries.forEach((entry: any) => {
              if (entry.name === "FCP") vitals.fcp = entry.value;
              if (entry.name === "LCP") vitals.lcp = entry.value;
              if (entry.name === "INP") vitals.inp = entry.value;
              if (entry.name === "CLS") vitals.cls = entry.value;
            });

            resolve(vitals);
          }).observe({
            entryTypes: ["paint", "largest-contentful-paint", "first-input", "layout-shift"],
          });

          // Trigger observation
          setTimeout(() => resolve({}), 5000);
        });
      });

      // Verify Core Web Vitals
      if (metrics.fcp) expect(metrics.fcp).toBeLessThan(1500);
      if (metrics.lcp) expect(metrics.lcp).toBeLessThan(2500);
      if (metrics.cls) expect(metrics.cls).toBeLessThan(0.1);
    });

    test("should handle rapid navigation without performance degradation", async () => {
      const pages = ["/dashboard", "/bookings", "/expenses", "/properties", "/reports"];
      const times: number[] = [];

      for (const path of pages) {
        const startTime = Date.now();
        await page.goto(path);
        await waitForNetworkIdle(page);
        times.push(Date.now() - startTime);
      }

      // Average load time should be under 1 second
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(avgTime).toBeLessThan(1000);

      // No individual page should take more than 2 seconds
      times.forEach((time) => expect(time).toBeLessThan(2000));
    });
  });
});

// Clean up test data
test.afterAll(async () => {
  console.log("E2E Critical flows tests completed");
});
