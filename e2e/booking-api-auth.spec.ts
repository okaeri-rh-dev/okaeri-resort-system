/**
 * Booking route auth through the real Pages runtime.
 *
 * `wrangler pages dev` hands each handler a fresh Request, so a user attached
 * to the middleware's Request never reaches the route; only `context.data`
 * survives. Unit tests build the context themselves and cannot see that, so
 * this spec calls POST /api/bookings/multi-unit over HTTP (Vite proxies /api
 * to wrangler). An empty body from staff must get 400: the role check passed.
 *
 * Requires local Supabase (`supabase start`); the seed provides staff@okaeri.test
 * and unit C1. Creates a role-less user and one booking, and removes both.
 */

import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { serviceClient } from "./fixtures/service-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

const ROUTE = "/api/bookings/multi-unit";
const STAFF = { email: "staff@okaeri.test", password: "test-password" };
const NO_ROLE = { email: "booking-api-no-role@e2e.local", password: "no-role-password-12345" };
const UNIT_C1 = "b88857ce-bbc1-474b-ac02-86e8a416c22e";
const GUEST_EMAIL = `booking-api-${Date.now()}@e2e.local`;

const admin = serviceClient();

async function accessToken(email: string, password: string): Promise<string> {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`Sign-in failed for ${email}: ${error?.message}`);
  return data.session.access_token;
}

async function deleteUserByEmail(email: string): Promise<void> {
  const { data } = await admin.auth.admin.listUsers();
  const user = data?.users.find((candidate) => candidate.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

test.describe("POST /api/bookings/multi-unit auth (Pages runtime)", () => {
  test.describe.configure({ mode: "serial" });

  let createdBookingId: string | null = null;

  test.beforeAll(async () => {
    const { hostname } = new URL(SUPABASE_URL);
    test.skip(
      !["127.0.0.1", "localhost", "::1"].includes(hostname),
      "Creates users and bookings: local Supabase only."
    );

    await deleteUserByEmail(NO_ROLE.email);
    const { error } = await admin.auth.admin.createUser({ ...NO_ROLE, email_confirm: true });
    if (error) throw new Error(`Creating the role-less user failed: ${error.message}`);
  });

  test.afterAll(async () => {
    if (createdBookingId) {
      await admin.from("bookings").delete().eq("booking_id", createdBookingId);
    }
    await admin.from("guests").delete().eq("email", GUEST_EMAIL);
    await deleteUserByEmail(NO_ROLE.email);
  });

  test("rejects a request without a token (401)", async ({ request }) => {
    const response = await request.post(ROUTE, { data: {} });
    expect(response.status()).toBe(401);
  });

  test("rejects a signed-in user without a staff role (403)", async ({ request }) => {
    const token = await accessToken(NO_ROLE.email, NO_ROLE.password);
    const response = await request.post(ROUTE, {
      data: {},
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(403);
  });

  test("lets staff through to validation (400 on an empty body)", async ({ request }) => {
    const token = await accessToken(STAFF.email, STAFF.password);
    const response = await request.post(ROUTE, {
      data: {},
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("creates a booking for staff (201)", async ({ request }) => {
    const token = await accessToken(STAFF.email, STAFF.password);
    const response = await request.post(ROUTE, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        primary_guest: { guest_name: "Booking API Guest", email: GUEST_EMAIL },
        check_in: "2098-03-10",
        check_out: "2098-03-12",
        units: [{ unit_id: UNIT_C1, num_guests: 2 }],
        payment: { method: "Cash" },
        source: "admin",
      },
    });
    const body = await response.json();
    createdBookingId = body.data?.booking_id ?? null;

    expect(response.status(), JSON.stringify(body)).toBe(201);
    expect(body.success).toBe(true);
  });
});
