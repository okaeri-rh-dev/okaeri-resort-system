import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { test as base, type BrowserContext, type Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "./test-data";

/**
 * Authentication fixtures for E2E tests
 *
 * This file provides authenticated test contexts that can be used
 * across test files to avoid repeating login logic.
 */

export const SESSION_ROLES = ["admin", "owner", "manager", "staff"] as const;
type SessionRole = (typeof SESSION_ROLES)[number];

export const authFile = (role: SessionRole) =>
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".auth", `${role}.json`);

/**
 * Restores the session that e2e/auth.setup.ts saved for the role, then opens the dashboard,
 * so the page ends where the UI login would have left it.
 * shortcut: every navigation re-applies the saved token, and it lives for jwt_expiry (1h); runs longer than that need setup to log in again.
 */
async function restoreSession(page: Page, role: SessionRole): Promise<void> {
  const state = JSON.parse(await readFile(authFile(role), "utf8")) as Awaited<
    ReturnType<BrowserContext["storageState"]>
  >;
  // Only the Supabase session: other saved keys (e.g. theme) would undo what the test set up.
  const session = state.origins
    .flatMap((origin) => origin.localStorage)
    .find((item) => item.name.endsWith("-auth-token"));
  if (!session) throw new Error(`No Supabase session in ${authFile(role)}`);
  await page.addInitScript(({ name, value }) => window.localStorage.setItem(name, value), session);
  await page.goto(ROUTES.admin.dashboard);
  await page.waitForURL(/\/admin\/dashboard/, { timeout: TIMEOUTS.navigation });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
    throw new Error("Admin test credentials not configured in environment");
  }
  await restoreSession(page, "admin");
}

export async function loginAsOwner(page: Page): Promise<void> {
  if (!process.env.TEST_OWNER_EMAIL || !process.env.TEST_OWNER_PASSWORD) {
    throw new Error("Owner test credentials not configured in environment");
  }
  await restoreSession(page, "owner");
}

/** Manager credentials default to the seed.sql user, so no env check is needed. */
export async function loginAsManager(page: Page): Promise<void> {
  await restoreSession(page, "manager");
}

export async function loginAsStaff(page: Page): Promise<void> {
  if (!process.env.TEST_STAFF_EMAIL || !process.env.TEST_STAFF_PASSWORD) {
    throw new Error("Staff test credentials not configured in environment");
  }
  await restoreSession(page, "staff");
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
