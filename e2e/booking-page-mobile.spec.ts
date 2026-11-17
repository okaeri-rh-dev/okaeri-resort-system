import { expect, test } from "@playwright/test";

import { E2E_REF } from "../scripts/e2e/fixtures";
import { loginAsOwner } from "./fixtures/auth";
import { COMPACT } from "./fixtures/contrast";
import { serviceClient } from "./fixtures/service-client";

// 1x1 PNG the payment-proofs bucket accepts
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** On a phone, the booking page edits the stay and records a payment. Needs the E2E-* fixtures. */
test("a phone edits the stay and records a payment from the booking page", async ({ page }) => {
  const db = serviceClient();
  const { data: booking } = await db
    .from("bookings")
    .select("booking_id")
    .eq("booking_reference", E2E_REF.PHONE_EDIT)
    .single();
  test.skip(!booking, "E2E bookings not seeded — run `npm run seed:e2e`.");
  const bookingId = booking!.booking_id;
  // A CI retry starts from the seeded stay
  await db.from("payments").delete().eq("booking_id", bookingId);
  await db.from("booking_units").update({ assigned_guests: 2 }).eq("booking_id", bookingId);
  await db.from("bookings").update({ num_guests: 2 }).eq("booking_id", bookingId);

  await page.setViewportSize(COMPACT);
  await loginAsOwner(page);

  // The retired edit page's old links land on the booking page
  await page.goto(`/admin/bookings/${bookingId}/edit`);
  await expect(page).toHaveURL(new RegExp(`/admin/bookings/${bookingId}$`));

  await page.getByRole("button", { name: "Edit stay" }).click();
  const sheet = page.getByRole("dialog", { name: "Edit stay" });
  await sheet.getByRole("button", { name: "One guest more in E2E Test Unit" }).click();
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(sheet).toBeHidden();
  // The toast sits over the action bar until it goes, and a hovering pointer keeps it
  const toast = page.getByText("Booking updated");
  await expect(toast).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(toast).toBeHidden({ timeout: 10_000 });
  await expect(page.getByRole("list", { name: "Cabins" })).toContainText("3 guests");

  const actions = page.getByRole("button", { name: `Actions for ${E2E_REF.PHONE_EDIT}` });
  await expect(actions, "the action bar sticks to the bottom of the screen").toBeInViewport();
  await actions.click();
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "Record payment" }).click(),
  ]);
  await fileChooser.setFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG_1X1 });

  await expect
    .poll(
      async () => {
        const { count } = await db
          .from("payments")
          .select("payment_id", { count: "exact", head: true })
          .eq("booking_id", bookingId);
        return count ?? 0;
      },
      { timeout: 20_000, message: "expected a payment row after the upload" }
    )
    .toBeGreaterThan(0);
});
