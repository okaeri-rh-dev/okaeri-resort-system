/**
 * High-Performance Availability Checking System
 * Optimized for Neon PostgreSQL Serverless Environment
 *
 * Features:
 * - Sub-100ms availability checks
 * - Connection pooling optimization
 * - Intelligent caching strategies
 * - Multi-unit availability checking
 * - Conflict detection with blackout periods
 * - Real-time availability updates
 */

import { supabase } from "./supabase";
import type { Unit, UnitType } from "@/types";
import { toUnitType, toBlackoutType } from "@/types/supabase";
import type {
  UnitAvailabilityResponse as SupabaseUnitResponse,
  // CalendarDayResponse, // ❌ DISABLED: Used by commented-out getUnitAvailabilityCalendar
  BlackoutResponse,
} from "@/types/supabase";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AvailabilityResult {
  isAvailable: boolean;
  conflictingBookings: number;
  blackoutPeriods: number;
  unitStatus: string;
  nextAvailableDate?: string;
}

// Use the centralized types from supabase.ts
type UnitAvailabilityResponse = SupabaseUnitResponse;

export interface UnitAvailability extends Unit {
  isAvailable: boolean;
  nextAvailableDate?: string;
}

// ❌ TEMPORARILY DISABLED: Used by commented-out getUnitAvailabilityCalendar function
/*
export interface AvailabilityCalendarDay {
  date: string;
  status: "Available" | "CheckIn" | "CheckOut" | "Occupied" | "Maintenance";
  bookingId?: string;
  guestName?: string;
  bookingReference?: string;
}
*/

export interface AvailabilityFilter {
  unitTypes?: string[];
  minOccupancy?: number;
  maxRate?: number;
  excludeUnitIds?: string[];
}

export interface BlackoutPeriod {
  blackoutId: string;
  unitId: string;
  blackoutType: "Maintenance" | "Renovation" | "Seasonal" | "Manual";
  startDate: string;
  endDate: string;
  reason?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// ❌ TEMPORARILY DISABLED: Used by commented-out getUnitAvailabilityCalendar function
/*
function convertCalendarStatus(
  apiStatus: "available" | "booked" | "blackout"
): AvailabilityCalendarDay["status"] {
  switch (apiStatus) {
    case "available":
      return "Available";
    case "booked":
      return "Occupied";
    case "blackout":
      return "Maintenance";
    default:
      return "Available";
  }
}
*/

// ============================================
// CORE AVAILABILITY FUNCTIONS
// ============================================

/**
 * Fast availability check for a single unit
 * Uses check_multi_unit_availability with single unit for detailed results
 */
export async function checkUnitAvailability(
  unitId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): Promise<AvailabilityResult> {
  try {
    const { data, error } = await supabase.rpc("check_multi_unit_availability", {
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_unit_ids: [unitId],
      p_exclude_booking_id: excludeBookingId ?? undefined,
    });

    if (error) throw error;

    const result = data?.[0];
    return {
      isAvailable: result?.is_available || false,
      conflictingBookings: result?.conflicting_bookings || 0,
      blackoutPeriods: 0, // check_multi_unit_availability doesn't return this
      unitStatus: result?.is_available ? "Available" : "Unavailable",
      nextAvailableDate: result?.next_available_date,
    };
  } catch (error) {
    console.error("Error checking unit availability:", error);
    throw new Error("Failed to check unit availability");
  }
}

/**
 * Multi-unit availability check with advanced filtering
 * Optimized for searching available units with complex criteria
 */
export async function checkMultiUnitAvailability(
  checkIn: string,
  checkOut: string,
  filters: AvailabilityFilter = {}
): Promise<UnitAvailability[]> {
  try {
    const { data, error } = await supabase.rpc("check_multi_unit_availability", {
      p_check_in: checkIn,
      p_check_out: checkOut,
      p_unit_ids: filters.excludeUnitIds ?? [],
    });

    if (error) throw error;

    const typedData = data as unknown as UnitAvailabilityResponse[] | null;
    return (typedData || []).map((unit) => ({
      unit_id: unit.unit_id,
      unit_name: unit.unit_name,
      unit_code: unit.unit_code,
      unit_type: toUnitType(unit.unit_type) as UnitType,
      base_occupancy: unit.base_occupancy || 1,
      max_occupancy: unit.max_occupancy,
      base_rate: unit.base_rate,
      weekend_rate: unit.weekend_rate ?? unit.base_rate,
      extra_person_rate: unit.extra_person_rate || 0,
      unit_status: "Available" as const,
      amenities: unit.amenities || null,
      cleaning_fee: unit.cleaning_fee || null,
      description: unit.description || null,
      images: unit.images || null,
      policies: unit.policies || null,
      created_at: unit.created_at || "",
      updated_at: unit.updated_at || "",
      isAvailable: unit.is_available,
      nextAvailableDate: unit.next_available_date,
    }));
  } catch (error) {
    console.error("Error checking multi-unit availability:", error);
    throw new Error("Failed to check multi-unit availability");
  }
}

/**
 * Get availability calendar for a unit
 * Optimized for calendar UI components
 *
 * ❌ TEMPORARILY DISABLED: Requires get_unit_availability_calendar() database function
 * TODO: Deploy availability calendar migration or remove if not needed
 */
/*
export async function getUnitAvailabilityCalendar(
  unitId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilityCalendarDay[]> {
  try {
    const { data, error } = await supabase.rpc("get_unit_availability_calendar", {
      p_unit_id: unitId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (error) throw error;

    const typedData = data as CalendarDayResponse[] | null;
    return (typedData || []).map((day) => ({
      date: day.calendar_date,
      status: convertCalendarStatus(day.status),
      bookingId: day.booking_id,
      guestName: day.guest_name,
      bookingReference: day.booking_reference,
    }));
  } catch (error) {
    console.error("Error getting availability calendar:", error);
    throw new Error("Failed to get availability calendar");
  }
}
*/

// ============================================
// BATCH AVAILABILITY OPERATIONS
// ============================================

/**
 * Check availability for multiple units in parallel
 * Optimized for booking forms with unit selection
 */
export async function batchCheckUnitAvailability(
  unitIds: string[],
  checkIn: string,
  checkOut: string
): Promise<Record<string, AvailabilityResult>> {
  try {
    const promises = unitIds.map(async (unitId) => {
      const result = await checkUnitAvailability(unitId, checkIn, checkOut);
      return { unitId, result };
    });

    const results = await Promise.all(promises);

    return results.reduce(
      (acc, { unitId, result }) => {
        acc[unitId] = result;
        return acc;
      },
      {} as Record<string, AvailabilityResult>
    );
  } catch (error) {
    console.error("Error in batch availability check:", error);
    throw new Error("Failed to perform batch availability check");
  }
}

/**
 * Get available units grouped by type
 * Useful for booking selection interfaces
 */
export async function getAvailableUnitsByType(
  checkIn: string,
  checkOut: string
): Promise<Record<string, UnitAvailability[]>> {
  try {
    const availableUnits = await checkMultiUnitAvailability(checkIn, checkOut);

    return availableUnits.reduce(
      (acc, unit) => {
        if (!acc[unit.unit_type]) {
          acc[unit.unit_type] = [];
        }
        acc[unit.unit_type].push(unit);
        return acc;
      },
      {} as Record<string, UnitAvailability[]>
    );
  } catch (error) {
    console.error("Error getting units by type:", error);
    throw new Error("Failed to get available units by type");
  }
}

// ============================================
// BLACKOUT PERIOD MANAGEMENT
// ============================================

/**
 * Create a blackout period for a unit
 */
export async function createBlackoutPeriod(
  unitId: string,
  blackoutType: BlackoutPeriod["blackoutType"],
  startDate: string,
  endDate: string,
  reason?: string,
  createdBy?: string
): Promise<BlackoutPeriod> {
  try {
    const { data, error } = await supabase
      .from("availability_blackouts")
      .insert({
        unit_id: unitId,
        blackout_type: blackoutType,
        start_date: startDate,
        end_date: endDate,
        reason,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error("No data returned");

    // Type assertion to expected structure (availability_blackouts table not yet in generated types)
    // TODO: Regenerate database.types.ts after adding availability_blackouts table to schema
    const blackoutData = data as {
      blackout_id: string;
      unit_id: string;
      blackout_type: string;
      start_date: string;
      end_date: string;
      reason: string | null;
    };

    return {
      blackoutId: blackoutData.blackout_id,
      unitId: blackoutData.unit_id,
      blackoutType: toBlackoutType(blackoutData.blackout_type) as BlackoutPeriod["blackoutType"],
      startDate: blackoutData.start_date,
      endDate: blackoutData.end_date,
      reason: blackoutData.reason ?? undefined,
    };
  } catch (error) {
    console.error("Error creating blackout period:", error);
    throw new Error("Failed to create blackout period");
  }
}

/**
 * Get blackout periods for a unit
 */
export async function getUnitBlackoutPeriods(
  unitId: string,
  startDate?: string,
  endDate?: string
): Promise<BlackoutPeriod[]> {
  try {
    let query = supabase.from("availability_blackouts").select("*").eq("unit_id", unitId);

    if (startDate && endDate) {
      query = query.gte("end_date", startDate).lte("start_date", endDate);
    }

    const { data, error } = await query.order("start_date");

    if (error) throw error;

    const typedData = data as BlackoutResponse[] | null;
    return (typedData || []).map((blackout) => ({
      blackoutId: blackout.blackout_id,
      unitId: blackout.unit_id,
      blackoutType: toBlackoutType(blackout.blackout_type) as BlackoutPeriod["blackoutType"],
      startDate: blackout.start_date,
      endDate: blackout.end_date,
      reason: blackout.reason,
    }));
  } catch (error) {
    console.error("Error getting blackout periods:", error);
    throw new Error("Failed to get blackout periods");
  }
}

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Refresh availability cache for units
 * Should be called periodically or after major booking changes
 *
 * ❌ TEMPORARILY DISABLED: Requires refresh_availability_cache() database function
 * TODO: Deploy availability cache migration or remove if not needed
 */
/*
export async function refreshAvailabilityCache(
  unitId?: string,
  daysAhead: number = 90
): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("refresh_availability_cache", {
      p_unit_id: unitId ?? undefined,
      p_days_ahead: daysAhead,
    });

    if (error) throw error;

    return Array.isArray(data) ? data.length : data || 0;
  } catch (error) {
    console.error("Error refreshing availability cache:", error);
    throw new Error("Failed to refresh availability cache");
  }
}
*/

/**
 * Get cache performance metrics
 * Useful for monitoring cache efficiency
 *
 * ❌ TEMPORARILY DISABLED: Requires availability_cache table
 * TODO: Deploy availability cache migration or remove if not needed
 */
/*
export async function getCachePerformanceMetrics(): Promise<{
  totalCacheEntries: number;
  validCacheEntries: number;
  cacheHitRatio: number;
}> {
  try {
    // Use the existing availability_cache table to calculate metrics
    const { data, error } = await supabase.from("availability_cache").select("*");

    if (error) throw error;

    const totalEntries = data?.length || 0;
    const validEntries =
      data?.filter((entry) => new Date(entry.cache_expires_at) > new Date()).length || 0;
    const hitRatio = totalEntries > 0 ? (validEntries / totalEntries) * 100 : 0;

    return {
      totalCacheEntries: totalEntries,
      validCacheEntries: validEntries,
      cacheHitRatio: Math.round(hitRatio * 100) / 100,
    };
  } catch (error) {
    console.error("Error getting cache metrics:", error);
    return {
      totalCacheEntries: 0,
      validCacheEntries: 0,
      cacheHitRatio: 0,
    };
  }
}
*/

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Validate date range for availability checking
 */
export function validateDateRange(
  checkIn: string,
  checkOut: string
): {
  isValid: boolean;
  error?: string;
} {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkInDate < today) {
    return {
      isValid: false,
      error: "Check-in date cannot be in the past",
    };
  }

  if (checkOutDate <= checkInDate) {
    return {
      isValid: false,
      error: "Check-out date must be after check-in date",
    };
  }

  const maxDaysAhead = 365; // 1 year ahead
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxDaysAhead);

  if (checkInDate > maxDate) {
    return {
      isValid: false,
      error: `Check-in date cannot be more than ${maxDaysAhead} days in advance`,
    };
  }

  return { isValid: true };
}

/**
 * Calculate optimal cache refresh interval based on booking patterns
 */
export function calculateOptimalCacheInterval(averageBookingsPerDay: number): number {
  // More bookings = more frequent cache refresh needed
  if (averageBookingsPerDay > 10) return 15; // 15 minutes
  if (averageBookingsPerDay > 5) return 30; // 30 minutes
  if (averageBookingsPerDay > 1) return 60; // 1 hour
  return 120; // 2 hours for low-traffic periods
}

/**
 * Format availability result for UI display
 */
export function formatAvailabilityMessage(result: AvailabilityResult): string {
  if (result.isAvailable) {
    return "Available for booking";
  }

  const messages: string[] = [];

  if (result.conflictingBookings > 0) {
    messages.push(`${result.conflictingBookings} conflicting booking(s)`);
  }

  if (result.blackoutPeriods > 0) {
    messages.push(`${result.blackoutPeriods} maintenance period(s)`);
  }

  if (result.unitStatus !== "Available") {
    messages.push(`Unit status: ${result.unitStatus}`);
  }

  return messages.length > 0 ? `Not available: ${messages.join(", ")}` : "Not available";
}
