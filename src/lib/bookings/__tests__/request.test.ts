import { afterEach, describe, expect, it, vi } from "vitest";

import { requestBooking } from "@/lib/bookings/request";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

const booking = {
  primary_guest: { guest_name: "Guest", email: "", contact_number: "" },
  check_in: "2026-12-20",
  check_out: "2026-12-22",
  units: [{ unit_id: "u1", num_guests: 2 }],
};

const respondWith = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("requestBooking", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns the created booking", async () => {
    respondWith(201, { success: true, data: { booking_id: "b1", booking_reference: "BKG-1" } });
    await expect(requestBooking(booking)).resolves.toMatchObject({ booking_reference: "BKG-1" });
  });

  it("throws the server's message so the dialog can show it", async () => {
    respondWith(409, {
      success: false,
      error: {
        code: "UNIT_UNAVAILABLE",
        message: "One or more units are not available for the selected dates",
      },
    });
    await expect(requestBooking(booking)).rejects.toThrow(/not available for the selected dates/);
  });

  it("throws a generic message when the body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    await expect(requestBooking(booking)).rejects.toThrow("Failed to create booking");
  });
});
