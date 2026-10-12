import { toStayInstants, type ManilaDay } from "@/lib/bookings/stay";
import type { Json } from "@/types/database.types";

export interface GuestBookingDataInput {
  bookingReference: string;
  guestName: string;
  email: string;
  phoneNumber: string;
  checkInDay: ManilaDay;
  checkOutDay: ManilaDay;
  numGuests: number;
  specialRequests: string | null;
  pricing: {
    total: number;
    downpayment_required: number;
    discount: { percent: number; amount: number } | null;
  };
  paymentProofUrl: string | null;
  idempotencyKey: string;
}

/** p_booking_data for create_guest_booking. */
export function toGuestBookingData(input: GuestBookingDataInput): Json {
  const stay = toStayInstants(input.checkInDay, input.checkOutDay);
  return {
    booking_reference: input.bookingReference,
    guest_name: input.guestName,
    email: input.email,
    phone_number: input.phoneNumber,
    check_in: stay.check_in,
    check_out: stay.check_out,
    num_guests: input.numGuests,
    special_requests: input.specialRequests,
    total_amount: input.pricing.total,
    downpayment_required: input.pricing.downpayment_required,
    discount_percent: input.pricing.discount?.percent ?? null,
    discount_amount: input.pricing.discount?.amount ?? null,
    pricing_snapshot: input.pricing as unknown as Json,
    payment_proof_url: input.paymentProofUrl,
    idempotency_key: input.idempotencyKey,
  };
}
