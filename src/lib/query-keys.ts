// src/lib/query-keys.ts

import type { AuditFilters, EntityType } from "@/types/entity-detail.types";

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
  entity: <T extends EntityType>(type: T, id: string) => [type, id] as const,

  /**
   * All entities of a type
   * Format: [type]
   * Example: ['booking']
   */
  entities: <T extends EntityType>(type: T) => [type] as const,

  /**
   * Filtered list of entities
   * Format: [type, 'list', filters]
   * Example: ['booking', 'list', { status: 'Confirmed' }]
   */
  entitiesFiltered: <T extends EntityType>(type: T, filters: Record<string, any>) =>
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
   * Bookings for a specific guest
   * Format: ['guest', id, 'bookings']
   */
  guestBookings: (guestId: string) => ["guest", guestId, "bookings"] as const,

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
