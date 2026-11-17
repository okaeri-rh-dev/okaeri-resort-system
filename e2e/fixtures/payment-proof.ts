import { expect, type Page } from "@playwright/test";

import type { serviceClient } from "./service-client";

// 1x1 PNG the payment-proofs bucket (accept image/*) takes
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** Picks "Record payment" in an open actions menu, which asks for a proof file. */
export async function uploadPaymentProof(page: Page) {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: /record payment/i }).click(),
  ]);
  await fileChooser.setFiles({ name: "proof.png", mimeType: "image/png", buffer: PNG_1X1 });
}

// Success is silent in the UI, so the payment row is the evidence
export async function expectPaymentRecorded(
  db: ReturnType<typeof serviceClient>,
  bookingId: string
) {
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
}
