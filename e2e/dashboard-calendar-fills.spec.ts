import { expect, test, type Page } from "@playwright/test";
import { addDays, format, getDay, isSameDay, startOfMonth } from "date-fns";

import { E2E_UNIT_ID } from "../scripts/e2e/fixtures";
import { loginAsAdmin } from "./fixtures/auth";
import { fillContrast } from "./fixtures/contrast";
import { serviceClient } from "./fixtures/service-client";

/**
 * The dashboard calendar tints weekends and booked days in both themes. In light, `muted` is
 * the grid's own `background`, so a muted fill once painted nothing. Seeds one booking this
 * month on the E2E unit (`npm run seed:e2e`) and removes it afterwards.
 */

const db = serviceClient();

const reference = `E2E-CAL-${Date.now().toString(36).toUpperCase()}`;
const today = new Date();
const isWeekend = (day: Date) => getDay(day) === 0 || getDay(day) === 6;
const bookedDay = Array.from({ length: 28 }, (_, index) =>
  addDays(startOfMonth(today), index)
).find((day) => !isWeekend(day) && !isSameDay(day, today))!;

let bookingId = "";

// One worker, so the booking is seeded once
test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const day = format(bookedDay, "yyyy-MM-dd");
  const { data, error } = await db
    .from("bookings")
    .insert({
      booking_reference: reference,
      guest_name: "E2E Calendar Guest",
      num_guests: 1,
      check_in: `${day}T06:00:00Z`,
      check_out: `${format(addDays(bookedDay, 1), "yyyy-MM-dd")}T04:00:00Z`,
      total_amount: 2500,
      booking_status: "Confirmed",
    })
    .select("booking_id")
    .single();
  expect(error).toBeNull();
  bookingId = data!.booking_id;
  const units = await db.from("booking_units").insert({
    booking_id: bookingId,
    unit_id: E2E_UNIT_ID,
    unit_price: 2500,
    subtotal: 2500,
    assigned_guests: 1,
  });
  expect(units.error).toBeNull();
});

test.afterAll(async () => {
  if (bookingId) await db.from("bookings").delete().eq("booking_id", bookingId);
});

function dayCell(page: Page, day: Date) {
  return page.getByRole("button", { name: new RegExp(`^${format(day, "MMMM d, yyyy")}`) });
}

for (const scheme of ["light", "dark"] as const) {
  test(`${scheme}: weekends and booked days are tinted against the grid`, async ({ page }) => {
    if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) test.skip();
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 1280, height: 1100 });
    await loginAsAdmin(page);

    const booked = dayCell(page, bookedDay);
    await expect(booked).toHaveAccessibleName(/booking/);

    const monthDays = Array.from({ length: 28 }, (_, index) => addDays(startOfMonth(today), index));
    const emptyWeekend = await (async () => {
      for (const day of monthDays.filter((d) => isWeekend(d) && !isSameDay(d, today))) {
        const name = await dayCell(page, day).getAttribute("aria-label");
        if (name && !name.includes("booking")) return dayCell(page, day);
      }
      throw new Error("No empty weekend day this month");
    })();
    const plainWeekday = monthDays.find(
      (d) => !isWeekend(d) && !isSameDay(d, today) && !isSameDay(d, bookedDay)
    )!;
    const grid = dayCell(page, plainWeekday).locator("xpath=..");

    expect(await fillContrast(emptyWeekend, grid)).toBeGreaterThanOrEqual(1.05);
    expect(await fillContrast(booked, grid)).toBeGreaterThanOrEqual(1.15);
  });
}
