/**
 * Enhanced Availability Utilities for Okaeri Resort System
 *
 * Integrates with optimized database availability functions and provides
 * client-side availability checking algorithms with sub-100ms performance.
 *
 * @module AvailabilityUtils
 */

import type { Unit, Booking, BookingStatus } from "@/types";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AvailabilityResult {
  isAvailable: boolean;
  conflictingBookings: ConflictingBooking[];
  blackoutPeriods: BlackoutPeriod[];
  availableFrom?: Date;
  availableUntil?: Date;
  unitStatus: string;
}

export interface ConflictingBooking {
  bookingId: string;
  bookingReference: string;
  guestName: string;
  checkIn: Date;
  checkOut: Date;
  status: BookingStatus;
}

export interface BlackoutPeriod {
  blackoutId: string;
  blackoutType: "Maintenance" | "Renovation" | "Seasonal" | "Manual";
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface DateOverlap {
  hasOverlap: boolean;
  overlapStart?: Date;
  overlapEnd?: Date;
  overlapDays: number;
}

export interface MultiUnitSearchOptions {
  unitTypes?: string[];
  minOccupancy?: number;
  maxOccupancy?: number;
  minRate?: number;
  maxRate?: number;
  amenities?: string[];
  sortBy?: "price" | "occupancy" | "type" | "availability";
  sortOrder?: "asc" | "desc";
  limit?: number;
}

export interface AvailableUnit extends Unit {
  isAvailable: boolean;
  nextAvailableDate?: Date;
  priceForPeriod?: number;
  availabilityScore: number; // 0-100 based on availability frequency
}

// ============================================
// CORE AVAILABILITY FUNCTIONS
// ============================================

/**
 * Checks if two date ranges overlap
 *
 * @param range1Start - Start date of first range
 * @param range1End - End date of first range
 * @param range2Start - Start date of second range
 * @param range2End - End date of second range
 * @returns DateOverlap result with overlap details
 */
export const checkDateOverlap = (
  range1Start: Date,
  range1End: Date,
  range2Start: Date,
  range2End: Date
): DateOverlap => {
  const latestStart = new Date(Math.max(range1Start.getTime(), range2Start.getTime()));
  const earliestEnd = new Date(Math.min(range1End.getTime(), range2End.getTime()));

  const hasOverlap = latestStart < earliestEnd;

  if (!hasOverlap) {
    return {
      hasOverlap: false,
      overlapDays: 0,
    };
  }

  const overlapMs = earliestEnd.getTime() - latestStart.getTime();
  const overlapDays = Math.ceil(overlapMs / (1000 * 60 * 60 * 24));

  return {
    hasOverlap: true,
    overlapStart: latestStart,
    overlapEnd: earliestEnd,
    overlapDays,
  };
};

/**
 * Validates if a date range is valid for booking
 *
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @returns Validation result with error messages
 */
export const validateDateRange = (
  checkIn: Date,
  checkOut: Date
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Check if check-in is in the past
  if (checkIn < today) {
    errors.push("Check-in date cannot be in the past");
  }

  // Check if check-out is before check-in
  if (checkOut <= checkIn) {
    errors.push("Check-out date must be after check-in date");
  }

  // Check minimum stay (1 night)
  const stayDuration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  if (stayDuration < 1) {
    errors.push("Minimum stay is 1 night");
  }

  // Check maximum advance booking (1 year)
  const maxAdvanceMs = 365 * 24 * 60 * 60 * 1000;
  if (checkIn.getTime() - now.getTime() > maxAdvanceMs) {
    errors.push("Bookings can only be made up to 1 year in advance");
  }

  // Check maximum stay duration (30 days)
  if (stayDuration > 30) {
    errors.push("Maximum stay duration is 30 days");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Checks for booking conflicts with existing bookings
 *
 * @param existingBookings - Array of existing bookings for the unit
 * @param checkIn - Proposed check-in date
 * @param checkOut - Proposed check-out date
 * @param excludeBookingId - Booking ID to exclude (for modifications)
 * @returns Array of conflicting bookings
 */
export const findBookingConflicts = (
  existingBookings: Booking[],
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
): ConflictingBooking[] => {
  const conflicts: ConflictingBooking[] = [];

  const activeBookings = existingBookings.filter(
    (booking) => booking.booking_status !== "Cancelled" && booking.booking_id !== excludeBookingId
  );

  for (const booking of activeBookings) {
    const bookingCheckIn = new Date(booking.check_in);
    const bookingCheckOut = new Date(booking.check_out);

    const overlap = checkDateOverlap(checkIn, checkOut, bookingCheckIn, bookingCheckOut);

    if (overlap.hasOverlap) {
      conflicts.push({
        bookingId: booking.booking_id,
        bookingReference: booking.booking_reference,
        guestName: booking.guest_name,
        checkIn: bookingCheckIn,
        checkOut: bookingCheckOut,
        status: booking.booking_status,
      });
    }
  }

  return conflicts;
};

/**
 * Checks for blackout period conflicts
 *
 * @param blackouts - Array of blackout periods for the unit
 * @param checkIn - Proposed check-in date
 * @param checkOut - Proposed check-out date
 * @returns Array of conflicting blackout periods
 */
export const findBlackoutConflicts = (
  blackouts: BlackoutPeriod[],
  checkIn: Date,
  checkOut: Date
): BlackoutPeriod[] => {
  const conflicts: BlackoutPeriod[] = [];

  for (const blackout of blackouts) {
    const overlap = checkDateOverlap(checkIn, checkOut, blackout.startDate, blackout.endDate);

    if (overlap.hasOverlap) {
      conflicts.push(blackout);
    }
  }

  return conflicts;
};

/**
 * Finds the next available date for a unit after a given date
 *
 * @param bookings - Existing bookings for the unit
 * @param blackouts - Blackout periods for the unit
 * @param fromDate - Date to start searching from
 * @param minStayDays - Minimum stay duration in days
 * @returns Next available date or null if none found in next 90 days
 */
export const findNextAvailableDate = (
  bookings: Booking[],
  blackouts: BlackoutPeriod[],
  fromDate: Date,
  minStayDays: number = 1
): Date | null => {
  const maxSearchDays = 90;
  const activeBookings = bookings.filter((b) => b.booking_status !== "Cancelled");

  // Create sorted array of occupied periods
  const occupiedPeriods: Array<{ start: Date; end: Date }> = [];

  // Add bookings
  activeBookings.forEach((booking) => {
    occupiedPeriods.push({
      start: new Date(booking.check_in),
      end: new Date(booking.check_out),
    });
  });

  // Add blackouts
  blackouts.forEach((blackout) => {
    occupiedPeriods.push({
      start: blackout.startDate,
      end: blackout.endDate,
    });
  });

  // Sort by start date
  occupiedPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Find gaps between occupied periods
  const searchDate = new Date(fromDate);
  const maxSearchDate = new Date(fromDate.getTime() + maxSearchDays * 24 * 60 * 60 * 1000);

  for (let i = 0; i <= occupiedPeriods.length; i++) {
    const currentPeriod = occupiedPeriods[i];
    const nextPeriod = occupiedPeriods[i + 1];

    // Check gap before first period
    if (i === 0 && (!currentPeriod || currentPeriod.start > searchDate)) {
      const gapEnd = currentPeriod ? currentPeriod.start : maxSearchDate;
      const gapDays = Math.floor((gapEnd.getTime() - searchDate.getTime()) / (1000 * 60 * 60 * 24));

      if (gapDays >= minStayDays) {
        return searchDate;
      }
    }

    // Check gap between periods
    if (currentPeriod && nextPeriod) {
      const gapStart = new Date(Math.max(currentPeriod.end.getTime(), searchDate.getTime()));
      const gapDays = Math.floor(
        (nextPeriod.start.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (gapDays >= minStayDays) {
        return gapStart;
      }
    }

    // Check gap after last period
    if (i === occupiedPeriods.length - 1 && currentPeriod) {
      const gapStart = new Date(Math.max(currentPeriod.end.getTime(), searchDate.getTime()));
      const gapDays = Math.floor(
        (maxSearchDate.getTime() - gapStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (gapDays >= minStayDays && gapStart < maxSearchDate) {
        return gapStart;
      }
    }
  }

  return null;
};

/**
 * Calculates availability score for a unit (0-100)
 * Based on availability frequency over the next 90 days
 *
 * @param bookings - Existing bookings for the unit
 * @param blackouts - Blackout periods for the unit
 * @param fromDate - Date to start calculation from
 * @returns Availability score (0-100)
 */
export const calculateAvailabilityScore = (
  bookings: Booking[],
  blackouts: BlackoutPeriod[],
  fromDate: Date = new Date()
): number => {
  const scoringPeriodDays = 90;
  const endDate = new Date(fromDate.getTime() + scoringPeriodDays * 24 * 60 * 60 * 1000);

  let totalOccupiedDays = 0;

  // Count occupied days from bookings
  const activeBookings = bookings.filter((b) => b.booking_status !== "Cancelled");
  activeBookings.forEach((booking) => {
    const bookingStart = new Date(
      Math.max(new Date(booking.check_in).getTime(), fromDate.getTime())
    );
    const bookingEnd = new Date(Math.min(new Date(booking.check_out).getTime(), endDate.getTime()));

    if (bookingStart < bookingEnd) {
      const occupiedDays = Math.ceil(
        (bookingEnd.getTime() - bookingStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalOccupiedDays += occupiedDays;
    }
  });

  // Count occupied days from blackouts
  blackouts.forEach((blackout) => {
    const blackoutStart = new Date(Math.max(blackout.startDate.getTime(), fromDate.getTime()));
    const blackoutEnd = new Date(Math.min(blackout.endDate.getTime(), endDate.getTime()));

    if (blackoutStart < blackoutEnd) {
      const occupiedDays = Math.ceil(
        (blackoutEnd.getTime() - blackoutStart.getTime()) / (1000 * 60 * 60 * 24)
      );
      totalOccupiedDays += occupiedDays;
    }
  });

  const availableDays = scoringPeriodDays - totalOccupiedDays;
  const score = Math.max(0, Math.min(100, Math.round((availableDays / scoringPeriodDays) * 100)));

  return score;
};

/**
 * Filters and sorts units based on availability and search criteria
 *
 * @param units - Array of units to filter
 * @param unitsAvailability - Map of unit availability data
 * @param options - Search and sorting options
 * @returns Filtered and sorted array of available units
 */
export const filterAvailableUnits = (
  units: Unit[],
  unitsAvailability: Map<string, AvailabilityResult>,
  options: MultiUnitSearchOptions = {}
): AvailableUnit[] => {
  const {
    unitTypes,
    minOccupancy,
    maxOccupancy,
    minRate,
    maxRate,
    amenities,
    sortBy = "availability",
    sortOrder = "desc",
    limit = 50,
  } = options;

  const filteredUnits = units
    .map((unit) => {
      const availability = unitsAvailability.get(unit.unit_id);
      return {
        ...unit,
        isAvailable: availability?.isAvailable || false,
        nextAvailableDate: availability?.availableFrom,
        availabilityScore: availability ? calculateAvailabilityScore([], []) : 0,
      };
    })
    .filter((unit) => {
      // Filter by unit type
      if (unitTypes && unitTypes.length > 0 && !unitTypes.includes(unit.unit_type)) {
        return false;
      }

      // Filter by occupancy
      if (minOccupancy && unit.max_occupancy < minOccupancy) {
        return false;
      }
      if (maxOccupancy && unit.max_occupancy > maxOccupancy) {
        return false;
      }

      // Filter by rate
      if (minRate && unit.base_rate < minRate) {
        return false;
      }
      if (maxRate && unit.base_rate > maxRate) {
        return false;
      }

      // Filter by amenities
      if (amenities && amenities.length > 0) {
        const hasAllAmenities = amenities.every(
          (amenity) =>
            unit.amenities?.some((unitAmenity) =>
              unitAmenity.toLowerCase().includes(amenity.toLowerCase())
            ) || false
        );
        if (!hasAllAmenities) {
          return false;
        }
      }

      return true;
    });

  // Sort units
  filteredUnits.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case "price":
        comparison = a.base_rate - b.base_rate;
        break;
      case "occupancy":
        comparison = a.max_occupancy - b.max_occupancy;
        break;
      case "type":
        comparison = a.unit_type.localeCompare(b.unit_type);
        break;
      case "availability":
      default:
        // Prioritize available units, then by availability score
        if (a.isAvailable !== b.isAvailable) {
          comparison = b.isAvailable ? 1 : -1;
        } else {
          comparison = b.availabilityScore - a.availabilityScore;
        }
        break;
    }

    return sortOrder === "asc" ? comparison : -comparison;
  });

  return filteredUnits.slice(0, limit);
};

/**
 * Checks if a booking modification conflicts with existing bookings
 *
 * @param originalBooking - Original booking being modified
 * @param newCheckIn - New check-in date
 * @param newCheckOut - New check-out date
 * @param existingBookings - All existing bookings for the unit
 * @returns Validation result with conflicts
 */
export const validateBookingModification = (
  originalBooking: Booking,
  newCheckIn: Date,
  newCheckOut: Date,
  existingBookings: Booking[]
): {
  isValid: boolean;
  conflicts: ConflictingBooking[];
  errors: string[];
} => {
  // Validate new date range
  const dateValidation = validateDateRange(newCheckIn, newCheckOut);
  if (!dateValidation.isValid) {
    return {
      isValid: false,
      conflicts: [],
      errors: dateValidation.errors,
    };
  }

  // Check for conflicts (excluding original booking)
  const conflicts = findBookingConflicts(
    existingBookings,
    newCheckIn,
    newCheckOut,
    originalBooking.booking_id
  );

  return {
    isValid: conflicts.length === 0,
    conflicts,
    errors: conflicts.length > 0 ? ["New dates conflict with existing bookings"] : [],
  };
};

/**
 * Optimizes multi-unit search by grouping units by type and availability
 *
 * @param units - Array of units to optimize
 * @param availabilityMap - Map of unit availability data
 * @returns Optimized search results grouped by unit type
 */
export const optimizeMultiUnitSearch = (
  units: Unit[],
  availabilityMap: Map<string, AvailabilityResult>
): Record<string, AvailableUnit[]> => {
  const grouped: Record<string, AvailableUnit[]> = {};

  units.forEach((unit) => {
    const availability = availabilityMap.get(unit.unit_id);
    const availableUnit: AvailableUnit = {
      ...unit,
      isAvailable: availability?.isAvailable || false,
      nextAvailableDate: availability?.availableFrom,
      availabilityScore: availability ? calculateAvailabilityScore([], []) : 0,
    };

    if (!grouped[unit.unit_type]) {
      grouped[unit.unit_type] = [];
    }

    grouped[unit.unit_type].push(availableUnit);
  });

  // Sort each group by availability score
  Object.keys(grouped).forEach((unitType) => {
    grouped[unitType].sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return b.isAvailable ? 1 : -1;
      }
      return b.availabilityScore - a.availabilityScore;
    });
  });

  return grouped;
};
