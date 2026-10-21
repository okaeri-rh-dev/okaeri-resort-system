/**
 * Online booking, staff side: verify the guest's downpayment, then assign a
 * cabin and land back on the booking queue. Seeds the guest booking through
 * create_guest_booking (service role), as the Worker does.
 */

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loginAsAdmin } from "./fixtures/auth";

/** Set before the confirm click; still true after it only if the app navigated in place. */
type MarkedWindow = Window & { sameDocument?: boolean };

// 1x1 PNG, accepted by the payment-proofs bucket (image/*)
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function admin(): SupabaseClient {
  return createClient(
    process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321",
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ||
      "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

test.describe("Online booking: verify then assign", () => {
  const db = admin();
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

  test("staff verify the downpayment, then assign one cabin", async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto(`/admin/verify-payment/${bookingId}`);
    await page.getByRole("button", { name: "Verify Payment" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Verify Payment" }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/bookings/${bookingId}/assign-units`));
    await expect.poll(() => bookingField("payment_status")).toBe("Partial");

    const cabinCard = page.getByRole("button", { name: /^Cabin .*, not selected$/ }).first();
    await expect(cabinCard.getByText(/^₱[\d,]+\.\d{2}$/)).toBeVisible();
    await cabinCard.click();
    await page.getByRole("button", { name: "Assign 1 Cabin to Booking" }).click();

    const confirmDialog = page.getByRole("alertdialog");
    await expect(confirmDialog).toContainText(reference);
    await expect(confirmDialog).not.toContainText(bookingId);

    await page.evaluate(() => {
      (window as MarkedWindow).sameDocument = true;
    });
    await confirmDialog.getByRole("button", { name: "Assign Cabins" }).click();

    await expect(page).toHaveURL(/\/admin\/bookings\/queue$/);
    await expect(page.getByRole("heading", { name: "Booking Queue", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => (window as MarkedWindow).sameDocument)).toBe(true);

    await expect.poll(() => bookingField("booking_status")).toBe("Confirmed");
    await expect.poll(() => bookingField("unit_assignment_status")).toBe("assigned");
  });
});
