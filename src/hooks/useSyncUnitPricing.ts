/**
 * Price Synchronization Utilities for Multi-Unit Bookings (Phase 3)
 *
 * Automatically recalculates pricing when units or dates change,
 * ensuring the UI always shows accurate pricing information.
 *
 * @module useSyncUnitPricing
 */

import { useCallback, useEffect, useMemo } from "react";

import { useMultiUnitBookingStore } from "@/stores/useMultiUnitBookingStore";
import type { BookingUnit } from "@/types";

import { useMultiUnitPricingQuote } from "./useMultiUnitBookingQueries";

// ============================================
// AUTO PRICE SYNC HOOK
// ============================================

/**
 * Automatically synchronizes unit pricing when units or dates change
 *
 * @param units - Array of booking units
 * @param checkIn - Check-in date
 * @param checkOut - Check-out date
 * @param options - Configuration options
 */
export function useSyncUnitPricing(
  units: BookingUnit[],
  checkIn: string,
  checkOut: string,
  options: {
    enabled?: boolean;
    onPricingUpdate?: (totalAmount: number) => void;
  } = {}
) {
  const { enabled = true, onPricingUpdate } = options;
  const { recalculateTotalPricing } = useMultiUnitBookingStore();

  // Prepare units for pricing quote
  const unitQuoteData = useMemo(
    () =>
      units.map((u) => ({
        unit_id: u.unit_id,
        guests: u.guest_assignment?.num_guests || u.base_occupancy,
      })),
    [units]
  );

  // Fetch pricing quote from API
  const { data: pricingQuote, isLoading } = useMultiUnitPricingQuote(
    unitQuoteData,
    checkIn,
    checkOut,
    { enabled: enabled && units.length > 0 }
  );

  // Sync pricing when quote is received
  useEffect(() => {
    if (pricingQuote && !isLoading) {
      recalculateTotalPricing();

      if (onPricingUpdate) {
        onPricingUpdate(pricingQuote.total_amount);
      }
    }
  }, [pricingQuote, isLoading, recalculateTotalPricing, onPricingUpdate]);

  return {
    pricingQuote,
    isLoading,
    totalAmount: pricingQuote?.total_amount || 0,
    nights: pricingQuote?.nights || 0,
  };
}

// ============================================
// MANUAL PRICE RECALCULATION HOOK
// ============================================

/**
 * Provides a manual price recalculation trigger
 */
export function useManualPriceSync() {
  const {
    selectedUnits,
    draftBooking,
    selectedBooking,
    recalculateTotalPricing,
    getTotalAmount,
    getTotalGuests,
  } = useMultiUnitBookingStore();

  const recalculate = useCallback(() => {
    recalculateTotalPricing();

    return {
      totalAmount: getTotalAmount(),
      totalGuests: getTotalGuests(),
      unitCount: selectedUnits.length,
    };
  }, [recalculateTotalPricing, getTotalAmount, getTotalGuests, selectedUnits.length]);

  const currentBooking = draftBooking || selectedBooking;

  return {
    recalculate,
    currentTotalAmount: getTotalAmount(),
    currentTotalGuests: getTotalGuests(),
    currentUnitCount: selectedUnits.length,
    hasChanges: currentBooking ? currentBooking.total_amount !== getTotalAmount() : false,
  };
}

// ============================================
// PRICE CHANGE DETECTION HOOK
// ============================================

/**
 * Detects when pricing changes and triggers callbacks
 */
export function usePriceChangeDetection(
  onPriceIncrease?: (delta: number) => void,
  onPriceDecrease?: (delta: number) => void,
  onPriceChange?: (newAmount: number, oldAmount: number, delta: number) => void
) {
  const { getTotalAmount } = useMultiUnitBookingStore();
  const previousAmount = useMemo(() => getTotalAmount(), [getTotalAmount]);

  useEffect(() => {
    const currentAmount = getTotalAmount();
    const delta = currentAmount - previousAmount;

    if (delta !== 0) {
      // Price changed
      if (onPriceChange) {
        onPriceChange(currentAmount, previousAmount, delta);
      }

      if (delta > 0 && onPriceIncrease) {
        onPriceIncrease(delta);
      } else if (delta < 0 && onPriceDecrease) {
        onPriceDecrease(Math.abs(delta));
      }
    }
  }, [getTotalAmount, previousAmount, onPriceChange, onPriceIncrease, onPriceDecrease]);

  return {
    currentAmount: getTotalAmount(),
    previousAmount,
    delta: getTotalAmount() - previousAmount,
    hasChanged: getTotalAmount() !== previousAmount,
  };
}

// ============================================
// PRICING BREAKDOWN HOOK
// ============================================

/**
 * Provides detailed pricing breakdown for display
 */
export function usePricingBreakdown() {
  const { selectedUnits, draftBooking, selectedBooking } = useMultiUnitBookingStore();

  const breakdown = useMemo(() => {
    const currentBooking = draftBooking || selectedBooking;

    // Calculate base totals
    const baseTotal = selectedUnits.reduce((sum, unit) => sum + (unit.pricing?.base_total || 0), 0);

    const weekendSurcharges = selectedUnits.reduce(
      (sum, unit) => sum + (unit.pricing?.weekend_surcharge || 0),
      0
    );

    const extraPersonFees = selectedUnits.reduce(
      (sum, unit) => sum + (unit.pricing?.extra_person_fee || 0),
      0
    );

    const subtotal = baseTotal + weekendSurcharges + extraPersonFees;
    const discountAmount = currentBooking?.discount_amount || 0;
    const totalAmount = subtotal - discountAmount;

    return {
      baseTotal,
      weekendSurcharges,
      extraPersonFees,
      subtotal,
      discountAmount,
      totalAmount,
      unitCount: selectedUnits.length,
      nights: selectedUnits[0]?.pricing?.nights || 0,
    };
  }, [selectedUnits, draftBooking, selectedBooking]);

  return breakdown;
}

// ============================================
// UNIT PRICING COMPARISON HOOK
// ============================================

/**
 * Compares pricing across multiple units
 */
export function useUnitPricingComparison() {
  const { selectedUnits } = useMultiUnitBookingStore();

  const comparison = useMemo(() => {
    if (selectedUnits.length === 0) {
      return {
        cheapestUnit: null,
        expensiveUnit: null,
        averagePrice: 0,
        totalRange: 0,
        units: [],
      };
    }

    const sortedUnits = [...selectedUnits].sort(
      (a, b) => (a.pricing?.unit_total || 0) - (b.pricing?.unit_total || 0)
    );

    const cheapestUnit = sortedUnits[0];
    const expensiveUnit = sortedUnits[sortedUnits.length - 1];
    const averagePrice =
      selectedUnits.reduce((sum, unit) => sum + (unit.pricing?.unit_total || 0), 0) /
      selectedUnits.length;
    const totalRange =
      (expensiveUnit?.pricing?.unit_total || 0) - (cheapestUnit?.pricing?.unit_total || 0);

    return {
      cheapestUnit,
      expensiveUnit,
      averagePrice,
      totalRange,
      units: sortedUnits,
    };
  }, [selectedUnits]);

  return comparison;
}

// ============================================
// DISCOUNT CALCULATOR HOOK
// ============================================

/**
 * Calculates and applies bulk discounts
 */
export function useDiscountCalculator() {
  const { getTotalAmount, applyBulkDiscount, clearDiscount } = useMultiUnitBookingStore();

  const calculateDiscount = useCallback(
    (discountPercent: number) => {
      const subtotal = getTotalAmount();
      const discountAmount = subtotal * (discountPercent / 100);
      const finalAmount = subtotal - discountAmount;

      return {
        subtotal,
        discountPercent,
        discountAmount,
        finalAmount,
        savings: discountAmount,
      };
    },
    [getTotalAmount]
  );

  const applyDiscount = useCallback(
    (discountPercent: number) => {
      applyBulkDiscount(discountPercent);
      return calculateDiscount(discountPercent);
    },
    [applyBulkDiscount, calculateDiscount]
  );

  return {
    calculateDiscount,
    applyDiscount,
    clearDiscount,
    currentTotal: getTotalAmount(),
  };
}

// ============================================
// PRICE VALIDATION HOOK
// ============================================

/**
 * Validates pricing data and detects anomalies
 */
export function usePriceValidation() {
  const { selectedUnits } = useMultiUnitBookingStore();

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if all units have pricing
    const unitsWithoutPricing = selectedUnits.filter((u) => !u.pricing);
    if (unitsWithoutPricing.length > 0) {
      errors.push(`${unitsWithoutPricing.length} units are missing pricing information`);
    }

    // Check for negative amounts
    const negativeAmounts = selectedUnits.filter((u) => (u.pricing?.unit_total || 0) < 0);
    if (negativeAmounts.length > 0) {
      errors.push(`${negativeAmounts.length} units have negative amounts`);
    }

    // Check for suspiciously low prices (less than 100 PHP per night)
    const suspiciouslyLow = selectedUnits.filter(
      (u) => u.pricing && u.pricing.unit_total / u.pricing.nights < 100
    );
    if (suspiciouslyLow.length > 0) {
      warnings.push(`${suspiciouslyLow.length} units have unusually low prices (<100 PHP/night)`);
    }

    // Check for very high prices (>50,000 PHP per night)
    const suspiciouslyHigh = selectedUnits.filter(
      (u) => u.pricing && u.pricing.unit_total / u.pricing.nights > 50000
    );
    if (suspiciouslyHigh.length > 0) {
      warnings.push(`${suspiciouslyHigh.length} units have unusually high prices (>50k PHP/night)`);
    }

    return {
      isValid: errors.length === 0,
      hasWarnings: warnings.length > 0,
      errors,
      warnings,
    };
  }, [selectedUnits]);

  return validation;
}
