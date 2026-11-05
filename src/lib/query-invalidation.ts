/**
 * Centralized Query Cache Invalidation
 *
 * Provides granular and composite invalidation helpers so every mutation
 * invalidates a consistent, complete set of query keys.
 *
 * Usage in mutation hooks:
 *   import { afterBookingCreate } from "@/lib/query-invalidation";
 *   onSettled: () => { afterBookingCreate(); }
 */

import { queryClient } from "@/lib/query-client";
import {
  accountKeys,
  availabilityKeys,
  bookingKeys,
  expenseKeys,
  guestKeys,
  multiUnitBookingKeys,
  paymentKeys,
  unitKeys,
  upcomingKeys,
} from "@/lib/query-keys";

// ============================================
// GRANULAR HELPERS (building blocks)
// ============================================

export function invalidateBookings() {
  queryClient.invalidateQueries({ queryKey: bookingKeys.all });
}

export function invalidateGuests() {
  queryClient.invalidateQueries({ queryKey: guestKeys.all });
}

export function invalidateUnits() {
  queryClient.invalidateQueries({ queryKey: unitKeys.all });
}

export function invalidateExpenses() {
  queryClient.invalidateQueries({ queryKey: expenseKeys.all });
}

// Account balances are computed from payments and expenses
export function invalidateAccounts() {
  queryClient.invalidateQueries({ queryKey: accountKeys.all });
}

export function invalidatePayments() {
  queryClient.invalidateQueries({ queryKey: paymentKeys.all });
}

export function invalidateAvailability() {
  queryClient.invalidateQueries({ queryKey: availabilityKeys.unit.all });
  queryClient.invalidateQueries({ queryKey: availabilityKeys.unitFast.all });
  queryClient.invalidateQueries({ queryKey: availabilityKeys.availableUnits.all });
  queryClient.invalidateQueries({ queryKey: availabilityKeys.calendar.all });
  queryClient.invalidateQueries({ queryKey: availabilityKeys.multiUnit.all });
  queryClient.invalidateQueries({ queryKey: unitKeys.allStates() });
}

export function invalidateMultiUnitBookings() {
  queryClient.invalidateQueries({ queryKey: multiUnitBookingKeys.all });
  queryClient.invalidateQueries({ queryKey: multiUnitBookingKeys.pending });
}

export function invalidateUpcoming() {
  queryClient.invalidateQueries({ queryKey: upcomingKeys.checkIns.all });
  queryClient.invalidateQueries({ queryKey: upcomingKeys.checkOuts.all });
}

// ============================================
// COMPOSITE HELPERS (semantic actions)
// ============================================

/** After creating a new booking (single or multi-unit). */
export function afterBookingCreate() {
  invalidateBookings();
  invalidateGuests();
  invalidateUnits();
  invalidateAvailability();
  invalidateMultiUnitBookings();
  invalidateUpcoming();
}

/** After changing booking status (confirm, check-in, check-out). */
export function afterBookingStatusChange() {
  invalidateBookings();
  invalidateUnits();
  invalidateAvailability();
  invalidateMultiUnitBookings();
  invalidateUpcoming();
}

/** After recording/verifying/uploading a payment. */
export function afterBookingPaymentChange() {
  invalidateBookings();
  invalidatePayments();
  invalidateAccounts();
  invalidateMultiUnitBookings();
}

/** After creating, editing or deleting an expense. */
export function afterExpenseChange() {
  invalidateExpenses();
  invalidateAccounts();
}

/** After editing booking details (dates, guest info, units). */
export function afterBookingUpdate() {
  invalidateBookings();
  invalidateGuests();
  invalidateAvailability();
  invalidateMultiUnitBookings();
}

/** After cancelling a booking. */
export function afterBookingCancel() {
  invalidateBookings();
  invalidateUnits();
  invalidateAvailability();
  invalidateMultiUnitBookings();
  invalidateUpcoming();
}

/** After anonymizing or deleting a guest: their bookings and payments lose personal data too. */
export function afterGuestRetention() {
  invalidateGuests();
  invalidateBookings();
  invalidatePayments();
  invalidateMultiUnitBookings();
  invalidateUpcoming();
}
