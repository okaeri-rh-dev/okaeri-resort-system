/**
 * Online booking, manager side: verify the guest's downpayment and confirm it with
 * a cabin in one dialog from the bookings list. Seeds the guest booking through
 * create_guest_booking (service role), as the Worker does.
 */

import { expect, test } from "@playwright/test";

import { loginAsAdmin } from "./fixtures/auth";
import { serviceClient } from "./fixtures/service-client";

// 1x1 PNG, accepted by the payment-proofs bucket (image/*)
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

test.describe("Online booking: verify payment", () => {
  const db = serviceClient();
  const reference = `E2E-OB-${Date.now().toString(36).toUpperCase()}`;
  const proofPath = `TEMP-${reference}.png`;
  let bookingId = "";

  async function bookingField(column: string) {
    const { data } = await db.from("bookings").select(column).eq("booking_id", bookingId).single();
    return (data as Record<string, unknown> | null)?.[column];
  }

  test.beforeAll(async () => {
    const upload = await db.storage
      .from("payment-proofs")
      .upload(proofPath, PNG_1X1, { contentType: "image/png", upsert: true });
    expect(upload.error).toBeNull();

    const unitBreakdown = [
      {
        unit_index: 1,
        guests: 2,
        subtotal: 7000,
        extra_person_fees: 0,
        total: 7000,
        downpayment: 3500,
      },
    ];
    const { data, error } = await db.rpc("create_guest_booking", {
      p_turnstile_token: "e2e",
      p_booking_data: {
        booking_reference: reference,
        guest_name: "E2E Online Guest",
        email: "e2e-online-guest-test@example.com",
        phone_number: "+639171234567",
        check_in: "2027-03-10T06:00:00.000Z",
        check_out: "2027-03-12T04:00:00.000Z",
        total_amount: 7000,
        downpayment_required: 3500,
        pricing_snapshot: {
          total: 7000,
          downpayment_required: 3500,
          unit_breakdown: unitBreakdown,
        },
        payment_proof_url: proofPath,
      },
      p_unit_requests: [{ guests_per_unit: 2 }],
      p_guest_data: null,
    });
    expect(error).toBeNull();
    bookingId = (data as { booking: { booking_id: string } }).booking.booking_id;
  });

  test.afterAll(async () => {
    if (bookingId) await db.from("bookings").delete().eq("booking_id", bookingId);
    await db.storage.from("payment-proofs").remove([proofPath]);
  });

  test("a manager verifies and confirms it from the Needs action view", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`/admin/bookings?view=needs-action&q=${reference}`);
    await page.getByRole("button", { name: "Verify payment" }).click();

    const dialog = page.getByRole("dialog", { name: "Verify payment" });
    const proofImage = dialog.getByRole("img", { name: "Payment proof" });
    await expect(proofImage).toBeVisible();
    expect(await proofImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(
      0
    );

    const confirm = dialog.getByRole("button", { name: "Verify and confirm" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("checkbox").first().check();
    await confirm.click();

    await expect(dialog).toBeHidden();
    await expect.poll(() => bookingField("booking_status")).toBe("Confirmed");
    expect(await bookingField("payment_status")).toBe("Partial");
    expect(await bookingField("unit_assignment_status")).toBe("assigned");
  });
});
