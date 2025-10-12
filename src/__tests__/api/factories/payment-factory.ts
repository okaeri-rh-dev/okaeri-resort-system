/**
 * Mock Factory for Payment Endpoints
 *
 * Creates Supabase client mocks for testing payment record/refund operations.
 */

import { createMockSupabaseClient } from "../helpers/mock-supabase";
import { testBookingResponse, testPayment } from "../utils/fixtures";

export interface PaymentMockOptions {
  /** Booking data to return */
  booking?: {
    booking_id: string;
    booking_reference?: string;
    total_amount?: number;
    amount_paid?: number;
    payment_status?: string;
  };

  /** Payment data to return */
  payment?: {
    payment_id: string;
    booking_id: string;
    amount: number; // Total payment amount (for refund validation)
    amount_paid: number;
    payment_method: string;
    payment_status: string;
    refunded_amount?: number; // Optional - for testing refund scenarios
  };

  /** Whether booking exists (default: true) */
  bookingExists?: boolean;

  /** Whether payment exists (default: false for record, true for refund) */
  paymentExists?: boolean;

  /** Created payment ID */
  createdPaymentId?: string;

  /** Simulate database error */
  hasError?: boolean;

  /** Error message to return */
  errorMessage?: string;
}

/**
 * Create mock Supabase client for payment endpoint testing
 */
export function createPaymentMocks(options: PaymentMockOptions = {}) {
  const {
    booking = {
      ...testBookingResponse,
      total_amount: 10000,
      amount_paid: 0,
      payment_status: "Unpaid",
    },
    payment = testPayment,
    bookingExists = true,
    paymentExists = false,
    createdPaymentId = "new-payment-id",
    hasError = false,
    errorMessage = "Database connection failed",
  } = options;

  const error = hasError ? { message: errorMessage } : null;

  return createMockSupabaseClient({
    tables: {
      bookings: bookingExists ? [booking] : [],
      payments: paymentExists ? [payment] : [],
      payment_adjustments: [],
    },
    rpcs: {},
    errors: {
      tables: hasError
        ? { bookings: error, payments: error, payment_adjustments: error }
        : undefined,
    },
  });
}

/**
 * Helper to create mock for payment record tests (no existing payment)
 */
export function createPaymentRecordMocks(options: Partial<PaymentMockOptions> = {}) {
  return createPaymentMocks({
    ...options,
    paymentExists: false,
    booking: {
      ...testBookingResponse,
      total_amount: 10000,
      amount_paid: 0,
      payment_status: "Unpaid",
      ...options.booking,
    },
  });
}

/**
 * Helper to create mock for payment refund tests (existing payment)
 */
export function createPaymentRefundMocks(options: Partial<PaymentMockOptions> = {}) {
  return createPaymentMocks({
    paymentExists: true, // Default - can be overridden by options
    ...options, // Options come after defaults to override them
    booking: {
      ...testBookingResponse,
      total_amount: 10000,
      amount_paid: 5000,
      payment_status: "Partial",
      ...options.booking,
    },
    payment: {
      ...testPayment,
      amount: 5000, // Total payment amount (for refund validation)
      amount_paid: 5000,
      payment_status: "Paid",
      refunded_amount: 0, // Default to no refund
      ...options.payment,
    },
  });
}
