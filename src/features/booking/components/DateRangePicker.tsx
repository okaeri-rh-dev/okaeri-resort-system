/**
 * DateRangePicker Component
 *
 * Sophisticated date range selection with:
 * - Dual-click range selection (start → end)
 * - Visual range highlighting with preview on hover
 * - Comprehensive validation (nights, availability, business rules)
 * - Resort business rules (check-in/out days, advance booking)
 * - Multiple interaction patterns (click, keyboard, touch, drag)
 * - Mobile-optimized with haptic feedback
 * - Full accessibility support
 */

import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  format,
  isSameDay,
  isAfter,
  isBefore,
  differenceInDays,
  addDays,
  getDay,
  parseISO,
} from "date-fns";
import { enUS } from "date-fns/locale";
import { CalendarGrid } from "./CalendarGrid";
import { cn } from "@/lib/utils";

// Date range type
export interface DateRange {
  start: Date;
  end: Date;
}

// Business rules interface
interface BusinessRules {
  checkInDays?: number[]; // 0 = Sunday, 1 = Monday, etc.
  checkOutDays?: number[];
  minimumAdvanceBooking?: number; // days
  maximumAdvanceBooking?: number; // days
  seasonalRestrictions?: Array<{
    startDate: string;
    endDate: string;
    minNights: number;
    maxNights: number;
  }>;
}

// Component prop types
export interface DateRangePickerProps {
  selectedRange?: DateRange | null;
  onRangeSelect: (range: DateRange | null) => void;
  onRangePreview?: (range: DateRange | null) => void;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
  minNights?: number;
  maxNights?: number;
  locale?: string;
  timezone?: string;
  allowSingleDay?: boolean;
  allowSameDay?: boolean;
  businessRules?: BusinessRules;
  availabilityData?: Record<string, any>;
  highlightUnavailable?: boolean;
  showPricing?: boolean;
  autoAdvance?: boolean; // Auto-advance to next month after start date selection
  disabled?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  selectedRange,
  onRangeSelect,
  onRangePreview,
  minDate,
  maxDate,
  disabledDates = [],
  minNights = 1,
  maxNights = 30,
  locale = "en-PH",
  timezone = "Asia/Manila",
  allowSingleDay = false,
  allowSameDay = false,
  businessRules,
  availabilityData = {},
  highlightUnavailable = false,
  showPricing = false,
  autoAdvance = false,
  disabled = false,
}) => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [previewRange, setPreviewRange] = useState<DateRange | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const selectionStartRef = useRef<Date | null>(null);

  // Locale configuration
  const dateLocale = useMemo(() => {
    switch (locale) {
      case "fil-PH":
        return fil;
      default:
        return enUS;
    }
  }, [locale]);

  // Validate business rules for a date
  const validateBusinessRules = useCallback(
    (date: Date, isCheckIn: boolean = true) => {
      if (!businessRules) return true;

      const dayOfWeek = getDay(date);

      // Check-in day restrictions
      if (isCheckIn && businessRules.checkInDays) {
        if (!businessRules.checkInDays.includes(dayOfWeek)) {
          return false;
        }
      }

      // Check-out day restrictions
      if (!isCheckIn && businessRules.checkOutDays) {
        if (!businessRules.checkOutDays.includes(dayOfWeek)) {
          return false;
        }
      }

      // Advance booking rules
      const today = new Date();
      const daysFromToday = differenceInDays(date, today);

      if (
        businessRules.minimumAdvanceBooking &&
        daysFromToday < businessRules.minimumAdvanceBooking
      ) {
        return false;
      }

      if (
        businessRules.maximumAdvanceBooking &&
        daysFromToday > businessRules.maximumAdvanceBooking
      ) {
        return false;
      }

      return true;
    },
    [businessRules]
  );

  // Validate date range
  const validateRange = useCallback(
    (range: DateRange): { valid: boolean; error?: string } => {
      const nights = differenceInDays(range.end, range.start);

      // Minimum nights validation
      if (nights < minNights) {
        return {
          valid: false,
          error: `Minimum stay of ${minNights} night${minNights !== 1 ? "s" : ""} required. Please select a longer stay.`,
        };
      }

      // Maximum nights validation
      if (nights > maxNights) {
        return {
          valid: false,
          error: `Maximum stay of ${maxNights} night${maxNights !== 1 ? "s" : ""} exceeded. Please select a shorter stay.`,
        };
      }

      // Check for disabled dates in range
      const hasDisabledDates = disabledDates.some((disabledDate) => {
        return isAfter(disabledDate, range.start) && isBefore(disabledDate, range.end);
      });

      if (hasDisabledDates) {
        return {
          valid: false,
          error: "Selected range contains unavailable dates. Please choose different dates.",
        };
      }

      // Check availability across range
      if (availabilityData) {
        let hasUnavailable = false;
        let conflictingBooking = null;

        for (let date = new Date(range.start); date <= range.end; date = addDays(date, 1)) {
          const dateString = format(date, "yyyy-MM-dd");
          const dayAvailability = availabilityData[dateString];

          if (dayAvailability && !dayAvailability.available) {
            hasUnavailable = true;
            if (dayAvailability.booking) {
              conflictingBooking = dayAvailability.booking;
              break;
            }
          }
        }

        if (hasUnavailable) {
          if (conflictingBooking) {
            return {
              valid: false,
              error: `Selected dates conflict with existing booking for ${conflictingBooking.guestName}. Please choose different dates.`,
            };
          } else {
            return {
              valid: false,
              error:
                "Some dates in the selected range are unavailable. Please choose different dates.",
            };
          }
        }
      }

      // Seasonal restrictions
      if (businessRules?.seasonalRestrictions) {
        for (const restriction of businessRules.seasonalRestrictions) {
          const restrictionStart = parseISO(restriction.startDate);
          const restrictionEnd = parseISO(restriction.endDate);

          // Check if range overlaps with seasonal restriction
          if (
            (isAfter(range.start, restrictionStart) || isSameDay(range.start, restrictionStart)) &&
            (isBefore(range.end, restrictionEnd) || isSameDay(range.end, restrictionEnd))
          ) {
            if (nights < restriction.minNights) {
              return {
                valid: false,
                error: `Peak season minimum stay of ${restriction.minNights} nights required during this period.`,
              };
            }
            if (nights > restriction.maxNights) {
              return {
                valid: false,
                error: `Peak season maximum stay of ${restriction.maxNights} nights exceeded during this period.`,
              };
            }
          }
        }
      }

      return { valid: true };
    },
    [minNights, maxNights, disabledDates, availabilityData, businessRules]
  );

  // Handle date click
  const handleDateClick = useCallback(
    (date: Date) => {
      if (disabled) return;

      // Provide haptic feedback
      if ("vibrate" in navigator) {
        navigator.vibrate([10]);
      }

      // Clear any previous validation errors
      setValidationError(null);

      // If no range selected or we're starting a new selection
      if (!selectedRange || !isSelecting) {
        // Validate check-in business rules
        if (!validateBusinessRules(date, true)) {
          setValidationError("Check-in only allowed on specific days according to resort policy.");
          return;
        }

        // Start new range selection
        selectionStartRef.current = date;
        setIsSelecting(true);
        onRangeSelect({ start: date, end: date }); // Partial range
        return;
      }

      // Complete range selection
      const startDate = selectionStartRef.current || selectedRange.start;
      let endDate = date;

      // Swap if end is before start
      if (isBefore(endDate, startDate)) {
        [endDate] = [startDate, endDate];
      }

      // Handle same-day selection
      if (isSameDay(startDate, endDate)) {
        if (allowSameDay || allowSingleDay) {
          const range = { start: startDate, end: endDate };
          onRangeSelect(range);
          setIsSelecting(false);
          selectionStartRef.current = null;
          return;
        } else {
          setValidationError(
            "Same-day check-in and check-out not allowed. Please select different dates."
          );
          return;
        }
      }

      // Validate check-out business rules
      if (!validateBusinessRules(endDate, false)) {
        setValidationError("Check-out only allowed on specific days according to resort policy.");
        return;
      }

      // Create and validate the range
      const newRange = { start: startDate, end: endDate };
      const validation = validateRange(newRange);

      if (!validation.valid) {
        setValidationError(validation.error || "Invalid date range selected.");
        return;
      }

      // Range is valid, complete selection
      onRangeSelect(newRange);
      setIsSelecting(false);
      selectionStartRef.current = null;
      setPreviewRange(null);

      // Clear preview
      onRangePreview?.(null);
    },
    [
      disabled,
      selectedRange,
      isSelecting,
      validateBusinessRules,
      allowSameDay,
      allowSingleDay,
      validateRange,
      onRangeSelect,
      onRangePreview,
    ]
  );

  // Handle date hover for preview
  const handleDateHover = useCallback(
    (date: Date | null) => {
      if (disabled || !isSelecting || !selectionStartRef.current || !date) {
        setPreviewRange(null);
        onRangePreview?.(null);
        return;
      }

      const startDate = selectionStartRef.current;
      let endDate = date;

      // Swap if end is before start
      if (isBefore(endDate, startDate)) {
        [endDate] = [startDate, endDate];
      }

      const preview = { start: startDate, end: endDate };
      setPreviewRange(preview);
      onRangePreview?.(preview);
    },
    [disabled, isSelecting, onRangePreview]
  );

  // Calculate nights display
  const nightsDisplay = useMemo(() => {
    const range = selectedRange || previewRange;
    if (!range || !range.start || !range.end) return null;

    const nights = differenceInDays(range.end, range.start);
    return nights > 0 ? `${nights} night${nights !== 1 ? "s" : ""}` : null;
  }, [selectedRange, previewRange]);

  // Calculate total price if enabled
  const totalPrice = useMemo(() => {
    if (!showPricing || !selectedRange) return null;

    let total = 0;
    const currency = "PHP";

    for (
      let date = new Date(selectedRange.start);
      date < selectedRange.end;
      date = addDays(date, 1)
    ) {
      const dateString = format(date, "yyyy-MM-dd");
      const dayData = availabilityData[dateString];
      if (dayData?.basePrice) {
        total += dayData.basePrice;
      }
    }

    return total > 0 ? { amount: total, currency } : null;
  }, [showPricing, selectedRange, availabilityData]);

  // Enhanced date info for rendering
  const getEnhancedDateInfo = useCallback(
    (date: Date, baseInfo: any) => {
      const dateString = format(date, "yyyy-MM-dd");
      const dayAvailability = availabilityData[dateString];

      return {
        ...baseInfo,
        // Range preview state
        isRangePreview:
          previewRange &&
          isAfter(date, previewRange.start) &&
          isBefore(date, previewRange.end) &&
          !isSameDay(date, previewRange.start) &&
          !isSameDay(date, previewRange.end),
        // Availability information
        availability: dayAvailability,
        isUnavailable: highlightUnavailable && dayAvailability && !dayAvailability.available,
        // Business rule validation
        isInvalidCheckIn: !validateBusinessRules(date, true),
        isInvalidCheckOut: !validateBusinessRules(date, false),
      };
    },
    [availabilityData, previewRange, highlightUnavailable, validateBusinessRules]
  );

  return (
    <div className="date-range-picker">
      {/* Calendar with enhanced rendering */}
      <CalendarGrid
        year={new Date().getFullYear()}
        month={new Date().getMonth()}
        selectedDate={undefined}
        selectedRange={selectedRange}
        onDateClick={handleDateClick}
        onDateHover={handleDateHover}
        availabilityData={availabilityData}
        disabledDates={disabledDates}
        minDate={minDate}
        maxDate={maxDate}
        locale={locale}
        timezone={timezone}
        renderDay={(date, info) => {
          const enhanced = getEnhancedDateInfo(date, info);
          const dayNumber = format(date, "d");

          return (
            <button
              type="button"
              className={cn(
                // Base styles with touch-friendly sizing
                "relative flex h-12 min-h-[44px] w-full min-w-[44px] items-center justify-center rounded-md text-sm font-medium transition-all duration-200",
                "focus:ring-primary focus:ring-2 focus:ring-offset-2 focus:outline-none",
                // Current month vs outside month
                enhanced.isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                // Today highlighting
                enhanced.isToday && "bg-primary text-primary-foreground font-semibold",
                // Range states
                enhanced.isRangeStart && "bg-primary text-primary-foreground rounded-r-none",
                enhanced.isRangeEnd && "bg-primary text-primary-foreground rounded-l-none",
                enhanced.isInRange && "bg-primary/20 text-primary-foreground rounded-none",
                enhanced.isRangePreview && "bg-primary/10 text-primary rounded-none",
                // Unavailable states
                enhanced.isUnavailable && "bg-destructive/10 text-destructive",
                enhanced.isInvalidCheckIn && "opacity-60",
                enhanced.isInvalidCheckOut && "opacity-60",
                // Disabled state
                enhanced.isDisabled && "cursor-not-allowed opacity-50",
                // Hover state
                !enhanced.isDisabled && "hover:bg-accent hover:text-accent-foreground"
              )}
              disabled={enhanced.isDisabled}
              aria-label={`${format(date, "EEEE, MMMM d, yyyy", { locale: dateLocale })}${enhanced.availability ? `, ${enhanced.availability.availableRooms} rooms available` : ""}`}
            >
              {dayNumber}

              {/* Availability indicators */}
              {enhanced.availability && (
                <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 transform gap-0.5">
                  {enhanced.availability.availableRooms > 0 ? (
                    <div className="bg-success h-1.5 w-1.5 rounded-full"></div>
                  ) : (
                    <div className="bg-destructive h-1.5 w-1.5 rounded-full"></div>
                  )}
                  {enhanced.availability.maintenanceBlocks?.length > 0 && (
                    <div className="h-1.5 w-1.5 rounded-full bg-purple-500"></div>
                  )}
                </div>
              )}
            </button>
          );
        }}
      />

      {/* Range summary and pricing */}
      {(selectedRange || previewRange) && (
        <div className="bg-muted/50 mt-4 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              {selectedRange && (
                <div className="text-sm font-medium">
                  {format(selectedRange.start, "MMM d", { locale: dateLocale })} -{" "}
                  {format(selectedRange.end, "MMM d, yyyy", { locale: dateLocale })}
                </div>
              )}
              {nightsDisplay && (
                <div className="text-muted-foreground mt-1 text-sm">{nightsDisplay}</div>
              )}
            </div>

            {totalPrice && (
              <div className="text-right">
                <div className="text-lg font-semibold">₱{totalPrice.amount.toLocaleString()}</div>
                <div className="text-muted-foreground text-sm">Total</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation error display */}
      {validationError && (
        <div
          role="alert"
          className="bg-destructive/10 border-destructive/20 mt-4 rounded-lg border p-4"
        >
          <p className="text-destructive text-sm font-medium">{validationError}</p>
        </div>
      )}

      {/* Contextual help */}
      {isSelecting && !validationError && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/20">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            {allowSameDay
              ? "Select check-out date (or same date for day use)"
              : "Select check-out date"}
          </p>
        </div>
      )}

      {/* Keyboard instructions for accessibility */}
      <div role="region" aria-label="Keyboard instructions" className="sr-only">
        <p>Use arrow keys to navigate between dates. Press Enter or Space to select dates.</p>
        <p>First click selects check-in date, second click selects check-out date.</p>
      </div>

      {/* Screen reader status updates */}
      <div role="status" aria-live="polite" className="sr-only">
        {selectedRange &&
          `Date range selected: ${format(selectedRange.start, "MMMM d", { locale: dateLocale })} to ${format(selectedRange.end, "MMMM d, yyyy", { locale: dateLocale })}. ${nightsDisplay}.`}
      </div>
    </div>
  );
};

DateRangePicker.displayName = "DateRangePicker";

export default DateRangePicker;
