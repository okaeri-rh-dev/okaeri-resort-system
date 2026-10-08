// src/lib/query-keys.ts

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
  revenueStats: (unitId: string) => [...unitKeys.detail(unitId), "revenue-stats"] as const,
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
  byUnit: (unitId: string) => [...bookingKeys.all, "unit", unitId] as const,
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
