/**
 * POST /api/admin/verify-payment records the downpayment as a payment
 * (the trigger derives payment_status, docs/adr/0001) and never writes
 * bookings.payment_status. Reject writes nothing to the booking.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const bookingId = "11111111-1111-4111-8111-111111111111";

type BookingRow = {
  payment_status: string;
  downpayment_required: number | null;
  payment_method: string | null;
  payment_proof_url: string | null;
};

let booking: BookingRow | null;
let statusAfterInsert: string;
let inserts: Record<string, unknown[]>;
let updates: string[];
let paymentInsertError: { code: string } | null;

function table(name: string) {
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: booking, error: null }),
    single: async () => ({ data: { payment_status: statusAfterInsert }, error: null }),
    insert: async (row: unknown) => {
      (inserts[name] ??= []).push(row);
      return { error: name === "payments" ? paymentInsertError : null };
    },
    update: () => {
      updates.push(name);
      return query;
    },
  };
  return query;
}

async function post(body: unknown): Promise<Response> {
  const { onRequest } = await import("../../../functions/api/admin/verify-payment");
  const request = new Request("https://api.example.com/api/admin/verify-payment", {
    method: "POST",
    headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return onRequest({
    request: request as never,
    env: { SUPABASE_URL: "http://localhost", SUPABASE_SERVICE_ROLE_KEY: "key" },
    params: {},
  });
}

describe("POST /api/admin/verify-payment", () => {
  beforeEach(() => {
    booking = {
      payment_status: "Pending",
      downpayment_required: 3500,
      payment_method: "GCash",
      payment_proof_url: "TEMP-abc_1.png",
    };
    statusAfterInsert = "Partial";
    inserts = {};
    updates = [];
    paymentInsertError = null;
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ id: "manager-1", email: "manager@example.com" }))
    );
    vi.doMock("../../../functions/lib/role-lookup", () => ({
      lookupUserRole: vi.fn(async () => "manager"),
    }));
    vi.doMock("../../../functions/lib/supabase-admin", () => ({
      createSupabaseAdmin: vi.fn(() => ({ from: table })),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("verify inserts the downpayment and returns the derived status", async () => {
    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(200);
    expect(inserts.payments).toEqual([
      {
        booking_id: bookingId,
        amount: 3500,
        payment_method: "GCash",
        proof_url: "TEMP-abc_1.png",
        status: "Active",
        kind: "online_downpayment",
        notes: "Online booking downpayment",
      },
    ]);
    expect(updates).toEqual([]);
    const body = (await response.json()) as { payment_status: string };
    expect(body.payment_status).toBe("Partial");
  });

  it("reject writes no payment and no booking update, and audits the reason", async () => {
    const response = await post({ booking_id: bookingId, action: "reject", reason: "Blurry" });

    expect(response.status).toBe(200);
    expect(inserts.payments).toBeUndefined();
    expect(updates).toEqual([]);
    expect(inserts.audit_logs).toEqual([
      expect.objectContaining({
        event_type: "payment.rejected",
        metadata: expect.objectContaining({ rejection_reason: "Blurry" }),
      }),
    ]);
    const body = (await response.json()) as { payment_status: string };
    expect(body.payment_status).toBe("Pending");
  });

  it("refuses a booking without a recorded downpayment", async () => {
    booking!.downpayment_required = null;

    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(409);
    expect(inserts.payments).toBeUndefined();
  });

  it("refuses a booking whose payment is no longer Pending", async () => {
    booking!.payment_status = "Partial";

    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(409);
  });

  it("returns 409 when another verify already recorded the downpayment", async () => {
    paymentInsertError = { code: "23505" };

    const response = await post({ booking_id: bookingId, action: "verify" });

    expect(response.status).toBe(409);
    expect(inserts.audit_logs).toBeUndefined();
  });
});
