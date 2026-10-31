import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { BrowserContext, Page } from "@playwright/test";

import { ROUTES, TIMEOUTS } from "./test-data";

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

export const loginAsAdmin = (page: Page) => restoreSession(page, "admin");
export const loginAsOwner = (page: Page) => restoreSession(page, "owner");
export const loginAsManager = (page: Page) => restoreSession(page, "manager");
export const loginAsStaff = (page: Page) => restoreSession(page, "staff");
