import type { Booking, PaymentStatus } from "@/types";

/** A downpayment or more is recorded, so cabins can be assigned. */
export const isPaymentReceived = (status: PaymentStatus) =>
  status === "Partial" || status === "Completed";

/** The sum of the counted (Active) payments. */
export const receivedAmount = (booking: Booking): number =>
  (booking.payments ?? [])
    .filter((payment) => payment.status === "Active")
    .reduce((sum, payment) => sum + payment.amount, 0);

/** Total price minus counted payments (GLOSSARY), never below 0. */
export function outstandingBalance(booking: Booking): number {
  return Math.max(booking.total_amount - receivedAmount(booking), 0);
}
