import { test as setup } from "@playwright/test";

import { authFile, SESSION_ROLES } from "./fixtures/auth";
import { TEST_USERS } from "./fixtures/test-data";
import { LoginPage } from "./pages/LoginPage";

for (const role of SESSION_ROLES) {
  setup(`log in as ${role}`, async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.loginAndWaitForDashboard(TEST_USERS[role].email, TEST_USERS[role].password);
    await page.context().storageState({ path: authFile(role) });
  });
}
