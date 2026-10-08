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

// Entities move here one at a time (guardrails Phase 3); the rest keep their singular root until then.
const entityKeyFactories: Partial<
  Record<EntityType, { all: readonly unknown[]; detail: (id: string) => readonly unknown[] }>
> = {
  guest: guestKeys,
  expense: expenseKeys,
  payment: paymentKeys,
};

/**
 * Centralized query key factory for TanStack Query
 * Provides type-safe, consistent query keys for caching and invalidation
 *
 * Usage:
 * ```typescript
 * const query = useQuery({
 *   queryKey: queryKeys.entity('booking', bookingId),
 *   queryFn: () => db.bookings.byId(bookingId)
 * })
 *
 * // Invalidate all bookings
 * queryClient.invalidateQueries({ queryKey: queryKeys.entities('booking') })
 * ```
 */
export const queryKeys = {
  /**
   * Individual entity detail query key
   * Format: [type, id]
   * Example: ['booking', '123-abc']
   */
  entity: <T extends EntityType>(type: T, id: string) =>
    entityKeyFactories[type]?.detail(id) ?? ([type, id] as const),

  /**
   * All entities of a type
   * Format: [type]
   * Example: ['booking']
   */
  entities: <T extends EntityType>(type: T) => entityKeyFactories[type]?.all ?? ([type] as const),

  /**
   * Filtered list of entities
   * Format: [type, 'list', filters]
   * Example: ['booking', 'list', { status: 'Confirmed' }]
   */
  entitiesFiltered: <T extends EntityType>(type: T, filters: Record<string, unknown>) =>
    [type, "list", filters] as const,

  /**
   * Audit logs for a specific entity
   * Format: ['audit-logs', filters]
   * Example: ['audit-logs', { entity_type: 'booking', entity_id: '123' }]
   */
  audit: (filters: AuditFilters) => ["audit-logs", filters] as const,

  /**
   * Related entities query key
   * Format: [type, id, relation]
   * Example: ['booking', '123', 'payments']
   */
  related: <T extends EntityType>(type: T, id: string, relation: string) =>
    [type, id, relation] as const,

  // ============================================
  // SPECIFIC RELATIONSHIP QUERIES
  // ============================================

  /**
   * Payments for a specific booking
   * Format: ['booking', id, 'payments']
   */
  bookingPayments: (bookingId: string) => ["booking", bookingId, "payments"] as const,

  /**
   * Bookings for a specific unit
   * Format: ['unit', id, 'bookings']
   */
  unitBookings: (unitId: string) => ["unit", unitId, "bookings"] as const,
};

/**
 * Example usage in components:
 *
 * ```typescript
 * // Fetch booking detail
 * const { data: booking } = useQuery({
 *   queryKey: queryKeys.entity('booking', bookingId),
 *   queryFn: () => db.bookings.byId(bookingId)
 * })
 *
 * // Fetch all payments for a booking
 * const { data: payments } = useQuery({
 *   queryKey: queryKeys.bookingPayments(bookingId),
 *   queryFn: () => db.payments.byBooking(bookingId)
 * })
 *
 * // Invalidate all booking queries
 * queryClient.invalidateQueries({
 *   queryKey: queryKeys.entities('booking')
 * })
 *
 * // Invalidate specific booking
 * queryClient.invalidateQueries({
 *   queryKey: queryKeys.entity('booking', bookingId)
 * })
 * ```
 */
