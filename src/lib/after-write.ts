import { queryClient } from "@/lib/query-client";
import {
  accountKeys,
  auditKeys,
  availabilityKeys,
  bookingKeys,
  contactChannelKeys,
  discountRuleKeys,
  expenseCategoryKeys,
  expenseKeys,
  guestKeys,
  multiUnitBookingKeys,
  paymentKeys,
  paymentMethodKeys,
  pendingUsersKeys,
  pricingConfigKeys,
  pricingKeys,
  roleKeys,
  seasonalRateKeys,
  transferKeys,
  unitKeys,
  userRoleKeys,
} from "@/lib/query-keys";
import type { Database } from "@/types/database.types";

export type TableName = keyof Database["public"]["Tables"];

type KeyRoot = readonly unknown[];

const AVAILABILITY = [availabilityKeys.availableUnits.all, availabilityKeys.multiUnit.all];
const CABIN_STATES = unitKeys.allStates();

// A fetch reads a table if it selects it, embeds it, or calls an RPC or API route that reads it
const READERS: Record<TableName, readonly KeyRoot[]> = {
  bookings: [
    bookingKeys.all,
    guestKeys.all,
    paymentKeys.all,
    multiUnitBookingKeys.pending,
    availabilityKeys.calendar.all,
    availabilityKeys.blackouts.all,
  ],
  booking_units: [bookingKeys.all, guestKeys.all],
  booking_unit_availability: [
    ...AVAILABILITY,
    CABIN_STATES,
    availabilityKeys.calendar.all,
    availabilityKeys.blackouts.all,
  ],
  guests: [guestKeys.all, bookingKeys.all, paymentKeys.all],
  guest_booking_unit_requests: [bookingKeys.all, multiUnitBookingKeys.pending],
  units: [
    unitKeys.all,
    bookingKeys.all,
    guestKeys.all,
    ...AVAILABILITY,
    availabilityKeys.blackouts.all,
    pricingKeys.all,
  ],
  payments: [paymentKeys.all, accountKeys.all, bookingKeys.all],
  expenses: [expenseKeys.all, accountKeys.all],
  accounts: [accountKeys.all, transferKeys.all],
  account_transfers: [transferKeys.all, accountKeys.all],
  app_roles: [roleKeys.all, pendingUsersKeys.all, userRoleKeys.current],
  audit_logs: [auditKeys.all, roleKeys.all],
  payment_methods: [paymentMethodKeys.all],
  expense_categories: [expenseCategoryKeys.all],
  contact_channels: [contactChannelKeys.all],
  pricing_config: [pricingConfigKeys.all, pricingKeys.all],
  seasonal_rates: [seasonalRateKeys.all, pricingKeys.all],
  discount_rules: [discountRuleKeys.all],
  availability_blackouts: [
    availabilityKeys.blackouts.all,
    ...AVAILABILITY,
    availabilityKeys.calendar.all,
    CABIN_STATES,
  ],
  maintenance_logs: [],
  audit_logs_archive: [],
  guest_assignments: [],
  idempotency_keys: [],
};

const CASCADES: Partial<Record<TableName, readonly TableName[]>> = {
  // trigger refresh_booking_payment_status
  payments: ["bookings"],
  // trigger trigger_update_booking_totals
  booking_units: ["bookings"],
  // trigger sync_booking_guest_name
  guests: ["bookings"],
  bookings: [
    // trigger trigger_update_guest_statistics
    "guests",
    // triggers trigger_sync_booking_dates and trigger_cascade_status
    "booking_unit_availability",
    // trigger airbnb_payout_follows_source (ADR 0006)
    "payments",
  ],
};

// Read with getQueryData, which ignores staleness, so a stale entry must go
const MEMOS: readonly KeyRoot[] = [pricingKeys.all];

export function afterWrite(...tables: TableName[]) {
  const reached = new Set<TableName>();
  const visit = (table: TableName) => {
    if (reached.has(table)) return;
    reached.add(table);
    CASCADES[table]?.forEach(visit);
  };
  [...tables, "audit_logs" as const].forEach(visit);

  const roots = new Set([...reached].flatMap((table) => READERS[table]));
  for (const queryKey of roots) {
    if (MEMOS.includes(queryKey)) queryClient.removeQueries({ queryKey });
    else queryClient.invalidateQueries({ queryKey });
  }
}
