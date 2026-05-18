import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";

/**
 * Admin dashboard — no horizontal scroll on mobile
 *
 * The mandatory invariant from the mobile overhaul plan:
 *   at no mobile viewport width should document.documentElement.scrollWidth
 *   exceed document.documentElement.clientWidth, AND no Card should clip
 *   its own content horizontally.
 *
 * If this test fails, the failing widths + Card indices in the assertion
 * output tell us which Card(s) overflow. Common culprits:
 *  - a flex parent missing min-w-0 on a text child
 *  - a min-w-[N] or fixed-width style ignoring small viewports
 *  - a TabsList/MenuBar overflowing at narrow widths
 */
const WIDTHS = [320, 375, 390, 414];

test.describe("Admin dashboard — no horizontal scroll on mobile", () => {
  test.beforeEach(async () => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
      test.skip();
    }
  });

  for (const width of WIDTHS) {
    test(`no horizontal scroll at ${width}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });

      await loginAsAdmin(page);
      await page.goto("/admin/dashboard");

      // Wait for the mobile dashboard's h1 to confirm content has rendered.
      // The mobile variant uses `text-xl`; desktop uses `text-3xl`. Either
      // works here because we're not asserting on the heading itself.
      await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

      // Document-level: no horizontal scroll
      const docMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        docMetrics.scrollWidth,
        `document.scrollWidth (${docMetrics.scrollWidth}) must equal clientWidth (${docMetrics.clientWidth}) at ${width}px`
      ).toBe(docMetrics.clientWidth);

      // Card-level: no Card may have clipped horizontal overflow.
      // Card class fingerprint from cardVariants: "rounded-xl border".
      const cardOverflows = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[class*="rounded-xl"][class*="border"]'))
          .map((el, i) => {
            const node = el as HTMLElement;
            return {
              i,
              scrollWidth: node.scrollWidth,
              clientWidth: node.clientWidth,
              overflows: node.scrollWidth > node.clientWidth,
              className: node.className,
            };
          })
          .filter((m) => m.overflows)
      );
      expect(cardOverflows, "no card should have clipped overflow").toEqual([]);
    });
  }
});
