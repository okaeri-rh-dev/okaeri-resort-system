import { z } from "zod";

import { toStayInstants, type ManilaDay } from "./stay";

// The confirmation page has no public read endpoint: it shows what the submit
// response returned, kept in this tab's sessionStorage.
const STORAGE_KEY = "bookingConfirmation";

const discountSchema = z.object({
  percent: z.number(),
  amount: z.number(),
  rule_name: z.string(),
});

const pricingBreakdownSchema = z.object({
  base_total: z.number(),
  weekend_surcharge: z.number(),
  extra_person_fees: z.number(),
  subtotal: z.number(),
  discount_amount: z.number(),
  total: z.number(),
  nights: z.number(),
});

const unitRequestsSchema = z.array(z.object({ guests_per_unit: z.number() }));

const createdBookingResponseSchema = z.object({
  booking: z.object({
    booking_reference: z.string(),
    downpayment_amount: z.number(),
    discount_applied: discountSchema.optional(),
  }),
  unit_requests: unitRequestsSchema,
  pricing_breakdown: pricingBreakdownSchema,
});

const snapshotSchema = z.object({
  booking_reference: z.string(),
  check_in: z.string(),
  check_out: z.string(),
  unit_requests: unitRequestsSchema,
  special_requests: z.string().optional(),
  downpayment_amount: z.number(),
  discount_applied: discountSchema.optional(),
  pricing_breakdown: pricingBreakdownSchema,
  payment_proof_attached: z.boolean(),
});

export type BookingConfirmationSnapshot = z.infer<typeof snapshotSchema>;

interface SubmittedBooking {
  check_in: ManilaDay;
  check_out: ManilaDay;
  special_requests?: string;
  payment_proof_url?: string;
}

/** Keeps a created booking for its confirmation page. A duplicate-submit response has no pricing, so it is not kept. */
export function saveConfirmationSnapshot(response: unknown, submitted: SubmittedBooking) {
  const created = createdBookingResponseSchema.safeParse(response);
  if (!created.success) return;

  const { booking, unit_requests, pricing_breakdown } = created.data;
  const snapshot: BookingConfirmationSnapshot = {
    booking_reference: booking.booking_reference,
    ...toStayInstants(submitted.check_in, submitted.check_out),
    unit_requests,
    special_requests: submitted.special_requests || undefined,
    downpayment_amount: booking.downpayment_amount,
    discount_applied: booking.discount_applied,
    pricing_breakdown,
    payment_proof_attached: Boolean(submitted.payment_proof_url),
  };

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage blocked or full: the page falls back to the status lookup link.
  }
}

export function readConfirmationSnapshot(
  bookingReference: string
): BookingConfirmationSnapshot | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const snapshot = snapshotSchema.safeParse(JSON.parse(stored));
    if (!snapshot.success || snapshot.data.booking_reference !== bookingReference) return null;
    return snapshot.data;
  } catch {
    return null;
  }
}
