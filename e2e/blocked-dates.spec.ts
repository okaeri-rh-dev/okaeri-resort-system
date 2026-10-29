/**
 * Blocked dates end to end: a manager blocks booked nights with cancel-and-save, staff see the
 * blocks read-only, and a manager closes the resort for a night that guests then see as fully
 * booked. The spec seeds its own
 * cabin, so its blocks and bookings never touch other specs' data.
 */

import { expect, test, type Page } from "@playwright/test";
import { addDays, format, parseISO } from "date-fns";

import { toManilaDateString } from "../src/lib/timezone";
import { loginAsManager, loginAsStaff } from "./fixtures/auth";
import { serviceClient } from "./fixtures/service-client";
import { PublicCalendarPage } from "./pages/PublicCalendarPage";

// Column limits: bookings.booking_reference and units.unit_code
const BOOKING_REFERENCE_MAX = 20;
const UNIT_CODE_MAX = 10;

const manilaToday = toManilaDateString(new Date());
const nightAfterToday = (days: number) =>
  format(addDays(parseISO(manilaToday), days), "yyyy-MM-dd");
const shortNight = (night: string) => format(parseISO(night), "EEE d MMM");
const calendarDay = (night: string) => format(parseISO(night), "MMMM d, yyyy");

const blockEntry = (page: Page, reason: string) =>
  page
    .getByRole("region", { name: "Current and upcoming blocks" })
    .getByRole("button", { name: new RegExp(reason) });

/**
 * Opens a block-form date field and picks the night, moving to the next month when needed.
 * The desktop popover stays open after a pick, so Escape closes it.
 */
async function pickNight(page: Page, field: string, night: string) {
  await page.getByRole("button", { name: field }).click();
  const picker = page.getByRole("dialog", { name: "Select date" });
  const day = picker.locator(`td[data-day="${night}"] button`);
  if (!(await day.isVisible())) {
    await picker.getByRole("button", { name: "Go to the Next Month" }).click();
  }
  await day.click();
  await page.keyboard.press("Escape");
  await expect(picker).toBeHidden();
}

test.describe("Blocked dates", () => {
  // One worker runs the tests in order, so the seed in beforeAll runs once
  test.describe.configure({ mode: "default" });
  // The guest calendar opens on the browser's month, so the browser runs on Manila time
  test.use({ timezoneId: "Asia/Manila" });

  const db = serviceClient();
  const suffix =
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
  const cabinName = `E2E Block Cabin ${suffix}`;
  const bookingReference = `E2E-BLK-${suffix}`.slice(0, BOOKING_REFERENCE_MAX);
  const managerReason = `E2E aircon cleaning ${suffix}`;
  const staffReason = `E2E roof repair ${suffix}`;
  const closureReason = `E2E resort closure ${suffix}`;

  const firstNight = nightAfterToday(20);
  const lastNight = nightAfterToday(21);
  const staffNight = nightAfterToday(28);
  const closureNight = nightAfterToday(26);

  let unitId = "";
  let bookingId = "";

  test.beforeAll(async () => {
    const unit = await db
      .from("units")
      .insert({
        unit_name: cabinName,
        unit_code: `B${suffix}`.slice(0, UNIT_CODE_MAX),
        unit_type: "Standard",
        base_occupancy: 2,
        max_occupancy: 4,
        base_rate: 2500,
        weekend_rate: 3000,
        extra_person_rate: 500,
      })
      .select("unit_id")
      .single();
    expect(unit.error).toBeNull();
    unitId = unit.data!.unit_id;

    // The admin booking path, so the cabin's nights land in booking_unit_availability
    const booking = await db.rpc("create_multi_unit_booking", {
      p_booking_data: {
        booking_reference: bookingReference,
        guest_name: "E2E Block Guest",
        num_guests: 2,
        check_in: `${firstNight}T06:00:00.000Z`,
        check_out: `${nightAfterToday(22)}T04:00:00.000Z`,
        booking_status: "Confirmed",
      },
      p_units: [{ unit_id: unitId, unit_price: 5000, subtotal: 5000, assigned_guests: 2 }],
    });
    expect(booking.error).toBeNull();
    bookingId = booking.data!;

    const staffBlock = await db.from("availability_blackouts").insert({
      unit_id: unitId,
      start_date: staffNight,
      end_date: staffNight,
      reason: staffReason,
    });
    expect(staffBlock.error).toBeNull();
  });

  test.afterAll(async () => {
    await db.from("availability_blackouts").delete().eq("reason", closureReason);
    if (unitId) await db.from("availability_blackouts").delete().eq("unit_id", unitId);
    if (bookingId) await db.from("bookings").delete().eq("booking_id", bookingId);
    if (unitId) await db.from("units").delete().eq("unit_id", unitId);
  });

  test("a manager cancels the booked nights and saves the block", async ({ page }) => {
    await loginAsManager(page);
    await page.goto("/admin/blocked-dates");
    await page.getByRole("button", { name: "Block dates" }).click();

    const sheet = page.getByRole("dialog", { name: "Block dates" });
    await sheet.getByRole("checkbox", { name: cabinName }).check();
    await pickNight(page, "First blocked night", firstNight);
    await pickNight(page, "Last blocked night", lastNight);
    await sheet.getByRole("textbox", { name: "Reason" }).fill(managerReason);

    const conflicts = sheet.getByRole("region", { name: "Bookings on these nights" });
    await expect(conflicts).toContainText(bookingReference);
    await expect(sheet.getByRole("button", { name: "Block dates" })).toBeDisabled();

    await sheet.getByRole("button", { name: "Cancel this booking and save the block" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm).toContainText(bookingReference);
    await expect(confirm).toContainText("Payments are not changed");
    await confirm.getByRole("button", { name: "Cancel and save" }).click();

    await expect(sheet).toBeHidden();
    await expect(blockEntry(page, managerReason)).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await db
          .from("bookings")
          .select("booking_status")
          .eq("booking_id", bookingId)
          .single();
        return data?.booking_status;
      })
      .toBe("Cancelled");

    await page.goto(`/admin/availability?date=${firstNight}`);
    for (const night of [firstNight, lastNight]) {
      await expect(
        page.getByRole("button", {
          name: `${cabinName}, ${shortNight(night)}: blocked, ${managerReason}. Show details`,
        })
      ).toBeVisible();
    }
  });

  test("staff see the blocked dates with no actions", async ({ page }) => {
    await loginAsStaff(page);
    await page.goto("/admin/blocked-dates");

    await expect(page.getByRole("heading", { name: "Blocked dates", level: 1 })).toBeVisible();
    await expect(page.getByText("Ask a manager to change blocked dates.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Block dates" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close the resort" })).toHaveCount(0);

    await blockEntry(page, staffReason).click();
    const sheet = page.getByRole("dialog", { name: "Blocked dates" });
    await expect(sheet).toContainText(staffReason);
    await expect(sheet.getByText("Ask a manager to change blocked dates.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Delete block" })).toHaveCount(0);
  });

  test("a manager closes the resort and guests see the night as fully booked", async ({
    page,
    browser,
  }) => {
    await loginAsManager(page);
    await page.goto("/admin/blocked-dates");
    await page.getByRole("button", { name: "Close the resort" }).click();

    const sheet = page.getByRole("dialog", { name: "Close the resort" });
    await expect(sheet.getByRole("checkbox", { name: /Whole resort/ })).toBeChecked();
    await pickNight(page, "First blocked night", closureNight);
    await pickNight(page, "Last blocked night", closureNight);
    await sheet.getByRole("textbox", { name: "Reason" }).fill(closureReason);
    await sheet.getByRole("button", { name: "Close the resort" }).click();

    await expect(sheet).toBeHidden();
    await expect(blockEntry(page, closureReason)).toContainText("Whole resort");

    const guestContext = await browser.newContext({ timezoneId: "Asia/Manila" });
    const guestPage = await guestContext.newPage();
    const calendar = new PublicCalendarPage(guestPage);
    await calendar.goto();

    if (closureNight.slice(0, 7) !== manilaToday.slice(0, 7)) await calendar.goToNextMonth();

    // A neighbour night in the same month still has free cabins
    const openNight = format(
      addDays(parseISO(closureNight), closureNight.endsWith("-01") ? 1 : -1),
      "yyyy-MM-dd"
    );
    await expect(
      guestPage.getByRole("gridcell", { name: `${calendarDay(closureNight)} - Fully booked` })
    ).toBeVisible();
    await expect(
      guestPage.getByRole("gridcell", {
        name: new RegExp(`^${calendarDay(openNight)} - \\d+ available$`),
      })
    ).toBeVisible();
    await guestContext.close();
  });
});
