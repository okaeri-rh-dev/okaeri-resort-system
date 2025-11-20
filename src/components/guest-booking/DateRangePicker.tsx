import * as React from "react";

// Removed unused import: format
import { DateRange } from "react-day-picker";

import { ResponsiveDateRangePicker } from "@/components/ui/responsive-date-picker";
import { calculateNights, validateDateRange } from "@/lib/api/guest-booking-client";
import { cn } from "@/lib/utils";

/**
 * Props for DateRangePicker component
 */
export interface DateRangePickerProps {
  /** Check-in date (can be undefined before selection) */
  checkIn: Date | undefined;
  /** Check-out date (can be undefined before selection) */
  checkOut: Date | undefined;
  /** Callback when check-in date changes */
  onCheckInChange: (date: Date | undefined) => void;
  /** Callback when check-out date changes */
  onCheckOutChange: (date: Date | undefined) => void;
  /** Disable date selection */
  disabled?: boolean;
  /** Additional CSS classes for the trigger button */
  className?: string;
}

/**
 * DateRangePicker Component
 *
 * Professional Enterprise date range selector for booking check-in/check-out dates.
 * Uses shadcn/ui Popover + Calendar with react-day-picker for date selection.
 *
 * Features:
 * - Dual-month calendar view for easy range selection
 * - Automatic validation (no past dates, min 1 night, check-out after check-in)
 * - Clear visual feedback for selected range
 * - Night count display on valid selection
 * - Error message display for invalid selections
 * - Keyboard accessible with proper ARIA attributes
 * - Mobile-responsive (single month on small screens)
 *
 * Validation Rules:
 * 1. Check-in date cannot be in the past
 * 2. Check-out date must be after check-in date
 * 3. Minimum 1 night stay required
 *
 * @example
 * ```tsx
 * const [checkIn, setCheckIn] = useState<Date>();
 * const [checkOut, setCheckOut] = useState<Date>();
 *
 * <DateRangePicker
 *   checkIn={checkIn}
 *   checkOut={checkOut}
 *   onCheckInChange={setCheckIn}
 *   onCheckOutChange={setCheckOut}
 * />
 * ```
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  disabled: _disabled = false,
  className,
}) => {
  // Local state for validation error
  /**
   * Derive error state from dates using useMemo (React Compiler optimization)
   * Replaces useEffect+setState pattern to prevent unnecessary re-renders
   */
  const error = React.useMemo(() => {
    if (checkIn && checkOut) {
      return validateDateRange(checkIn, checkOut);
    }
    return null;
  }, [checkIn, checkOut]);

  /**
   * Handle date range change from calendar
   */
  const handleDateChange = (range: DateRange | undefined) => {
    // Update parent state
    onCheckInChange(range?.from);
    onCheckOutChange(range?.to);

    // Error is automatically computed via useMemo above
  };

  /**
   * Calculate night count for display
   */
  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;

  /**
   * Disable past dates in calendar
   */
  const disabledDates = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Check if selection is valid and complete
  const isValidSelection = checkIn && checkOut && !error;

  // Build aria-describedby based on what's visible
  const ariaDescribedby = error
    ? "date-range-error"
    : isValidSelection
      ? "date-range-success"
      : undefined;

  return (
    <div className="space-y-2">
      <ResponsiveDateRangePicker
        value={{
          from: checkIn,
          to: checkOut,
        }}
        onChange={handleDateChange}
        disabled={disabledDates}
        placeholder="Pick check-in and check-out dates"
        buttonClassName={cn(
          "w-full",
          error && "border-destructive focus-visible:ring-destructive",
          className
        )}
        numberOfMonths={2}
        formatStr="MMM dd, yyyy"
        aria-label="Pick check-in and check-out dates"
        aria-describedby={ariaDescribedby}
      />

      {/* Error message display */}
      {error && (
        <p id="date-range-error" className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}

      {/* Success message with night count */}
      {isValidSelection && (
        <p id="date-range-success" className="text-muted-foreground text-sm">
          {nights} night{nights !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};

DateRangePicker.displayName = "DateRangePicker";
