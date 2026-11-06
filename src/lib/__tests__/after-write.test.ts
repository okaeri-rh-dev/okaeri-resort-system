import { afterEach, describe, expect, it, vi } from "vitest";

import { afterWrite, type TableName } from "@/lib/after-write";
import { queryClient } from "@/lib/query-client";
import * as queryKeyModule from "@/lib/query-keys";
import {
  accountKeys,
  auditKeys,
  availabilityKeys,
  bookingKeys,
  contactChannelKeys,
  guestKeys,
  multiUnitBookingKeys,
  paymentKeys,
  pendingUsersKeys,
  pricingKeys,
  publicAvailabilityKeys,
  roleKeys,
  transferKeys,
  unitKeys,
  userRoleKeys,
} from "@/lib/query-keys";

const spyOnCache = () => {
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const remove = vi.spyOn(queryClient, "removeQueries");
  return {
    invalidated: () => invalidate.mock.calls.map(([filters]) => filters?.queryKey),
    removed: () => remove.mock.calls.map(([filters]) => filters?.queryKey),
  };
};

const everyTable: Record<TableName, true> = {
  account_transfers: true,
  accounts: true,
  app_roles: true,
  audit_logs: true,
  audit_logs_archive: true,
  availability_blackouts: true,
  booking_unit_availability: true,
  booking_units: true,
  bookings: true,
  contact_channels: true,
  discount_rules: true,
  expense_categories: true,
  expenses: true,
  guest_assignments: true,
  guest_booking_unit_requests: true,
  guests: true,
  idempotency_keys: true,
  maintenance_logs: true,
  payment_methods: true,
  payments: true,
  pricing_config: true,
  seasonal_rates: true,
  units: true,
};

const availability = [availabilityKeys.availableUnits.all, availabilityKeys.multiUnit.all];

describe("afterWrite", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<[TableName, readonly (readonly unknown[])[]]>([
    ["guests", [guestKeys.all, bookingKeys.all, paymentKeys.all]],
    ["payments", [paymentKeys.all, accountKeys.all, bookingKeys.all, guestKeys.all]],
    [
      "booking_units",
      [bookingKeys.all, guestKeys.all, paymentKeys.all, ...availability, unitKeys.allStates()],
    ],
    ["units", [unitKeys.all, bookingKeys.all, ...availability]],
    ["accounts", [accountKeys.all, transferKeys.all]],
    ["app_roles", [roleKeys.all, pendingUsersKeys.all, userRoleKeys.current]],
    ["bookings", [multiUnitBookingKeys.pending, availabilityKeys.blackouts.all]],
    [
      "availability_blackouts",
      [
        availabilityKeys.blackouts.all,
        availabilityKeys.calendar.all,
        ...availability,
        unitKeys.allStates(),
      ],
    ],
    ["contact_channels", [contactChannelKeys.all]],
  ])("a %s write refreshes every read of it", (table, roots) => {
    const cache = spyOnCache();
    afterWrite(table);
    for (const root of roots) expect(cache.invalidated()).toContainEqual(root);
  });

  it("refreshes payments after a booking write, through the Airbnb payout trigger", () => {
    const cache = spyOnCache();
    afterWrite("bookings");
    expect(cache.invalidated()).toContainEqual(paymentKeys.all);
    expect(cache.invalidated()).toContainEqual(accountKeys.all);
  });

  it("removes the pricing memo instead of invalidating it", () => {
    const cache = spyOnCache();
    afterWrite("units");
    expect(cache.removed()).toEqual([pricingKeys.all]);
    expect(cache.invalidated()).not.toContainEqual(pricingKeys.all);
  });

  it("refreshes the audit log after any write", () => {
    const cache = spyOnCache();
    afterWrite("payment_methods");
    expect(cache.invalidated()).toContainEqual(auditKeys.all);
  });

  it("refreshes each root once when several written tables reach it", () => {
    const cache = spyOnCache();
    afterWrite("bookings", "booking_units", "payments", "guests");
    const keys = cache.invalidated().map((key) => JSON.stringify(key));
    expect(keys).toEqual([...new Set(keys)]);
  });

  it("reaches every key root from some table, except data that is not table data", () => {
    const notTableData = [publicAvailabilityKeys.all];
    const keys: unknown[][] = [];
    const collect = (value: unknown) => {
      if (Array.isArray(value)) keys.push(value);
      else if (typeof value === "function") {
        try {
          collect(value());
        } catch {
          // queryKeys.entity throws on an unknown type; its keys come from factories collected anyway
        }
      } else if (value && typeof value === "object") Object.values(value).forEach(collect);
    };
    collect(queryKeyModule);

    const cache = spyOnCache();
    afterWrite(...(Object.keys(everyTable) as TableName[]));
    const reached = [...cache.invalidated(), ...cache.removed()] as unknown[][];
    const startsWith = (key: unknown[], prefix: readonly unknown[]) =>
      prefix.every((part, i) => JSON.stringify(part) === JSON.stringify(key[i]));

    for (const key of keys.filter((k) => !notTableData.some((root) => startsWith(k, root))))
      expect(
        reached.some((root) => startsWith(key, root)),
        JSON.stringify(key)
      ).toBe(true);
  });
});
