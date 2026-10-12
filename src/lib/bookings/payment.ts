import type { PaymentStatus } from "@/types";

/** A downpayment or more is recorded, so cabins can be assigned. */
export const isPaymentReceived = (status: PaymentStatus) =>
  status === "Partial" || status === "Completed";
