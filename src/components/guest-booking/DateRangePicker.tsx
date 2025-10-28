import * as React from "react";

import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  disabled = false,
  className,
}) => {
  // Local state for validation error
  const [error, setError] = React.useState<string | null>(null);

  // Track popover open state
  const [isOpen, setIsOpen] = React.useState(false);

  /**
   * Handle date range change from calendar
   */
  const handleDateChange = (range: DateRange | undefined) => {
    // Update parent state
    onCheckInChange(range?.from);
    onCheckOutChange(range?.to);

    // Validate if both dates are selected
    if (range?.from && range?.to) {
      const validationError = validateDateRange(range.from, range.to);
      setError(validationError);

      // Close popover on valid selection
      if (!validationError) {
        setIsOpen(false);
      }
    } else {
      // Clear error if incomplete selection
      setError(null);
    }
  };

  /**
   * Calculate night count for display
   */
  const nights = checkIn && checkOut ? calculateNights(checkIn, checkOut) : 0;

  /**
   * Format button text
   */
  const getButtonText = () => {
    if (!checkIn) {
      return "Pick check-in and check-out dates";
    }

    if (!checkOut) {
      return `${format(checkIn, "MMM dd, yyyy")} - Select check-out`;
    }

    return `${format(checkIn, "MMM dd, yyyy")} - ${format(checkOut, "MMM dd, yyyy")}`;
  };

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

  return (
    <div className="space-y-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !checkIn && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive",
              className
            )}
            aria-label="Select check-in and check-out dates"
            aria-describedby={
              error ? "date-range-error" : isValidSelection ? "date-range-success" : undefined
            }
          >
            <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            <span>{getButtonText()}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <Calendar
            mode="range"
            selected={{
              from: checkIn,
              to: checkOut,
            }}
            onSelect={handleDateChange}
            disabled={disabledDates}
            numberOfMonths={2}
            defaultMonth={checkIn || new Date()}
            className="rounded-md border-0"
            classNames={{
              months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
              month: "space-y-4",
            }}
          />
        </PopoverContent>
      </Popover>

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
