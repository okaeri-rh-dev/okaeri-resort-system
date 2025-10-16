/**
 * MultiUnitSelector Utility Functions
 *
 * Pure functions for filtering and processing units.
 * These are extracted from the component for easier testing.
 *
 * @module MultiUnitSelector/utils
 */

import type { Unit } from "@/types";

// ============================================
// TYPES
// ============================================

export interface FilterState {
  unitType?: string;
  maxOccupancy?: string;
  maxRate?: string;
}

// ============================================
// FILTERING FUNCTIONS
// ============================================

/**
 * Filters units based on type, occupancy, and price criteria
 *
 * @param units - Array of units to filter
 * @param filters - Filter criteria (use "all" or undefined to skip a filter)
 * @returns Filtered array of units
 *
 * @example
 * ```typescript
 * const filtered = filterUnits(units, {
 *   unitType: 'Suite',
 *   maxOccupancy: '4'
 * });
 * ```
 */
export function filterUnits(units: Unit[], filters: FilterState): Unit[] {
  return units.filter((unit) => {
    // Filter by unit type
    if (filters.unitType && filters.unitType !== "all") {
      if (unit.unit_type !== filters.unitType) {
        return false;
      }
    }

    // Filter by max occupancy (units must accommodate at least this many guests)
    if (filters.maxOccupancy && filters.maxOccupancy !== "all") {
      const requiredOccupancy = parseInt(filters.maxOccupancy, 10);
      if (unit.max_occupancy < requiredOccupancy) {
        return false;
      }
    }

    // Filter by max rate (units must be at or below this price)
    if (filters.maxRate && filters.maxRate !== "all") {
      const maxRate = parseInt(filters.maxRate, 10);
      if (unit.base_rate > maxRate) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if any filters are currently active
 *
 * @param filters - Filter state to check
 * @returns True if any filter is set to something other than "all"
 */
export function hasActiveFilters(filters: FilterState): boolean {
  return (
    (filters.unitType !== undefined && filters.unitType !== "all") ||
    (filters.maxOccupancy !== undefined && filters.maxOccupancy !== "all") ||
    (filters.maxRate !== undefined && filters.maxRate !== "all")
  );
}

/**
 * Returns a clean filter state with all filters set to "all"
 *
 * @returns Empty filter state
 */
export function getEmptyFilters(): FilterState {
  return {
    unitType: "all",
    maxOccupancy: "all",
    maxRate: "all",
  };
}
