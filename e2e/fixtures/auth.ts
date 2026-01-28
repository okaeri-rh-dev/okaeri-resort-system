import { test as base, type Page } from "@playwright/test";

import { LoginPage } from "../pages/LoginPage";
import { TEST_USERS } from "./test-data";

/**
 * Authentication fixtures for E2E tests
 *
 * This file provides authenticated test contexts that can be used
 * across test files to avoid repeating login logic.
 */

/**
 * Helper to login as admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
    throw new Error("Admin test credentials not configured in environment");
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(TEST_USERS.admin.email, TEST_USERS.admin.password);
}

/**
 * Helper to login as owner user
 */
export async function loginAsOwner(page: Page): Promise<void> {
  if (!process.env.TEST_OWNER_EMAIL || !process.env.TEST_OWNER_PASSWORD) {
    throw new Error("Owner test credentials not configured in environment");
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(TEST_USERS.owner.email, TEST_USERS.owner.password);
}

/**
 * Helper to login as staff user
 */
export async function loginAsStaff(page: Page): Promise<void> {
  if (!process.env.TEST_STAFF_EMAIL || !process.env.TEST_STAFF_PASSWORD) {
    throw new Error("Staff test credentials not configured in environment");
  }

  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.loginAndWaitForDashboard(TEST_USERS.staff.email, TEST_USERS.staff.password);
}

/**
 * Type for authenticated user roles
 */
export type UserRole = "owner" | "admin" | "staff";

/**
 * Login as a specific role
 */
export async function loginAs(page: Page, role: UserRole): Promise<void> {
  switch (role) {
    case "owner":
      return loginAsOwner(page);
    case "admin":
      return loginAsAdmin(page);
    case "staff":
      return loginAsStaff(page);
    default:
      throw new Error(`Unknown role: ${role}`);
  }
}

/**
 * Extended test fixture with pre-authenticated admin session
 */
export const adminTest = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await loginAsAdmin(page);
    await use(page);
  },
});

/**
 * Extended test fixture with pre-authenticated owner session
 */
export const ownerTest = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await loginAsOwner(page);
    await use(page);
  },
});

/**
 * Extended test fixture with pre-authenticated staff session
 */
export const staffTest = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await loginAsStaff(page);
    await use(page);
  },
});
