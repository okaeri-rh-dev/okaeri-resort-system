// src/lib/query-keys.ts

import type { ManilaDay } from "@/lib/bookings/stay";
import type { BlockNights } from "@/lib/supabase";
import type { AuditFilters, EntityType } from "@/types/entity-detail.types";

export const guestKeys = {
  all: ["guests"] as const,
  lists: () => [...guestKeys.all, "list"] as const,
  list: (params: { searchQuery: string; sortBy: string; sortOrder: string }) =>
    [...guestKeys.lists(), params] as const,
  details: () => [...guestKeys.all, "detail"] as const,
  detail: (guestId: string) => [...guestKeys.details(), guestId] as const,
  bookings: (guestId: string) => [...guestKeys.all, "bookings", guestId] as const,
  byEmail: (email: string) => [...guestKeys.all, "by-email", email] as const,
  statistics: () => [...guestKeys.all, "statistics"] as const,
};

export const expenseKeys = {
  all: ["expenses"] as const,
  lists: () => [...expenseKeys.all, "list"] as const,
  list: (params: { filters: object; searchQuery: string; sortBy: string; sortOrder: string }) =>
    [...expenseKeys.lists(), params] as const,
  details: () => [...expenseKeys.all, "detail"] as const,
  detail: (expenseId: string) => [...expenseKeys.details(), expenseId] as const,
  stats: (dateRange?: { from: Date; to: Date }) =>
    [...expenseKeys.all, "stats", dateRange] as const,
};

export const paymentKeys = {
  all: ["payments"] as const,
  lists: () => [...paymentKeys.all, "list"] as const,
  list: (params: { filters: object; searchQuery: string; sortBy: string; sortOrder: string }) =>
    [...paymentKeys.lists(), params] as const,
  details: () => [...paymentKeys.all, "detail"] as const,
  detail: (paymentId: string) => [...paymentKeys.details(), paymentId] as const,
  byBooking: (bookingId: string) => [...paymentKeys.all, "booking", bookingId] as const,
};

export const unitKeys = {
  all: ["units"] as const,
  lists: () => [...unitKeys.all, "list"] as const,
  list: (filters: object) => [...unitKeys.lists(), filters] as const,
  unfiltered: () => [...unitKeys.all, "unfiltered"] as const,
  details: () => [...unitKeys.all, "detail"] as const,
  detail: (unitId: string) => [...unitKeys.details(), unitId] as const,
  allStates: () => [...unitKeys.all, "states"] as const,
  states: (date: ManilaDay) => [...unitKeys.allStates(), date] as const,
};

export const bookingKeys = {
  all: ["bookings"] as const,
  lists: () => [...bookingKeys.all, "list"] as const,
  list: (params: { filters: object; searchQuery: string; sortBy: string; sortOrder: string }) =>
    [...bookingKeys.lists(), params] as const,
  details: () => [...bookingKeys.all, "detail"] as const,
  detail: (bookingId: string) => [...bookingKeys.details(), bookingId] as const,
  // The /api/admin/bookings/:id response, a different shape from detail(); under it so invalidating detail covers both
  adminDetail: (bookingId: string) => [...bookingKeys.detail(bookingId), "admin"] as const,
};

export const accountKeys = {
  all: ["accounts"] as const,
  lists: () => [...accountKeys.all, "list"] as const,
  list: (params: { filters: object; searchQuery: string; sortBy: string; sortOrder: string }) =>
    [...accountKeys.lists(), params] as const,
  active: () => [...accountKeys.all, "active"] as const,
  details: () => [...accountKeys.all, "detail"] as const,
  detail: (accountId: string) => [...accountKeys.details(), accountId] as const,
  balances: () => [...accountKeys.all, "balances"] as const,
  balancesAsOf: (asOfDate?: string) => [...accountKeys.balances(), asOfDate] as const,
};

export const transferKeys = {
  all: ["transfers"] as const,
  lists: () => [...transferKeys.all, "list"] as const,
  list: (params: { filters: object; searchQuery: string; sortBy: string; sortOrder: string }) =>
    [...transferKeys.lists(), params] as const,
  details: () => [...transferKeys.all, "detail"] as const,
  detail: (transferId: string) => [...transferKeys.details(), transferId] as const,
  byAccount: (accountId: string) => [...transferKeys.all, "account", accountId] as const,
};

export const paymentMethodKeys = {
  all: ["payment-methods"] as const,
  list: () => [...paymentMethodKeys.all, "list"] as const,
  active: () => [...paymentMethodKeys.all, "active"] as const,
};

export const contactChannelKeys = {
  all: ["contact-channels"] as const,
  list: () => [...contactChannelKeys.all, "list"] as const,
  active: () => [...contactChannelKeys.all, "active"] as const,
};

export const expenseCategoryKeys = {
  all: ["expense-categories"] as const,
  list: () => [...expenseCategoryKeys.all, "list"] as const,
  active: () => [...expenseCategoryKeys.all, "active"] as const,
};

export const seasonalRateKeys = {
  all: ["seasonal-rates"] as const,
  list: () => [...seasonalRateKeys.all, "list"] as const,
  active: () => [...seasonalRateKeys.all, "active"] as const,
  forDate: (date?: string) => [...seasonalRateKeys.all, "date", date] as const,
};

export const pricingConfigKeys = {
  all: ["pricing-config"] as const,
};

// Pricing results cached by the calculate mutation; no queryFn reads them
export const pricingKeys = {
  all: ["pricing"] as const,
  cache: () => [...pricingKeys.all, "cache"] as const,
  cached: (cacheKey: string) => [...pricingKeys.cache(), cacheKey] as const,
};

// Availability reads sit under several top-level roots; invalidateAvailability() covers each one
export const availabilityKeys = {
  unit: {
    all: ["unit-availability"] as const,
    byUnit: (unitId: string) => [...availabilityKeys.unit.all, unitId] as const,
    range: (unitId: string, checkIn: string, checkOut: string, excludeBookingId?: string) =>
      [...availabilityKeys.unit.byUnit(unitId), checkIn, checkOut, excludeBookingId] as const,
  },
  unitFast: {
    all: ["unit-availability-fast"] as const,
    byUnit: (unitId: string) => [...availabilityKeys.unitFast.all, unitId] as const,
    range: (unitId: string, checkIn: string, checkOut: string, excludeBookingId?: string) =>
      [...availabilityKeys.unitFast.byUnit(unitId), checkIn, checkOut, excludeBookingId] as const,
  },
  availableUnits: {
    all: ["available-units"] as const,
    range: (checkIn: string, checkOut: string) =>
      [...availabilityKeys.availableUnits.all, checkIn, checkOut] as const,
    search: (checkIn: string, checkOut: string, filters: object, limit: number) =>
      [...availabilityKeys.availableUnits.range(checkIn, checkOut), filters, limit] as const,
  },
  availableUnitsByType: (checkIn: string, checkOut: string) =>
    ["available-units-by-type", checkIn, checkOut] as const,
  batch: (unitIds: string[], checkIn: string, checkOut: string) =>
    ["batch-unit-availability", unitIds, checkIn, checkOut] as const,
  calendar: {
    all: ["availability-calendar"] as const,
    byUnit: (unitId: string) => [...availabilityKeys.calendar.all, unitId] as const,
  },
  multiUnit: {
    all: ["multi-unit-availability"] as const,
    search: (checkIn: string, checkOut: string, filters: object) =>
      [...availabilityKeys.multiUnit.all, checkIn, checkOut, filters] as const,
    units: (unitIds: string[], checkIn: string, checkOut: string, excludeBookingId?: string) =>
      [...availabilityKeys.multiUnit.all, unitIds, checkIn, checkOut, excludeBookingId] as const,
  },
  blackouts: {
    all: ["unit-blackouts"] as const,
    list: (includePast: boolean) =>
      [...availabilityKeys.blackouts.all, "list", { includePast }] as const,
    conflicts: (nights: BlockNights) =>
      [...availabilityKeys.blackouts.all, "conflicts", nights] as const,
    byUnit: (unitId: string) => [...availabilityKeys.blackouts.all, unitId] as const,
    range: (unitId: string, startDate?: string, endDate?: string) =>
      [...availabilityKeys.blackouts.byUnit(unitId), startDate, endDate] as const,
  },
};

export const upcomingKeys = {
  checkIns: {
    all: ["upcoming-checkins"] as const,
    within: (days: number) => [...upcomingKeys.checkIns.all, days] as const,
  },
  checkOuts: {
    all: ["upcoming-checkouts"] as const,
    within: (days: number) => [...upcomingKeys.checkOuts.all, days] as const,
  },
};

export const discountRuleKeys = {
  all: ["discount-rules"] as const,
};

// Nothing reads multi-unit-bookings today; mutations and realtime still cancel/invalidate it
export const multiUnitBookingKeys = {
  all: ["multi-unit-bookings"] as const,
  detail: (bookingId?: string) => [...multiUnitBookingKeys.all, bookingId] as const,
  pending: ["pending-multi-unit-bookings"] as const,
};

const entityKeyFactories: Record<
  EntityType,
  { all: readonly unknown[]; detail: (id: string) => readonly unknown[] }
> = {
  booking: bookingKeys,
  guest: guestKeys,
  expense: expenseKeys,
  payment: paymentKeys,
  unit: unitKeys,
};

/**
 * Keys for code that is generic over the entity type (useEntityEdit).
 * Entity-specific code uses the factories above directly.
 */
// Callers pass runtime strings through generic hooks, so an unknown type gets a clear error
const factoryFor = (type: EntityType) => {
  if (!(type in entityKeyFactories)) throw new Error(`Unknown entity type: ${type}`);
  return entityKeyFactories[type];
};

export const queryKeys = {
  entity: <T extends EntityType>(type: T, id: string) => factoryFor(type).detail(id),
  entities: <T extends EntityType>(type: T) => factoryFor(type).all,
  audit: (filters: AuditFilters) => ["audit-logs", filters] as const,
};
