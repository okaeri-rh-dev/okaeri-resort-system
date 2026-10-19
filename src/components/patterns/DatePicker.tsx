import type { DateRange } from "react-day-picker";

import {
  ResponsiveDatePicker,
  ResponsiveDateRangePicker,
} from "@/components/ui/responsive-date-picker";

export type { DateRange };

export interface DatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  /** Return true for dates that can't be picked, such as past dates. */
  isDateDisabled?: (date: Date) => boolean;
  placeholder?: string;
  /** Name the trigger when no visible label is tied to it. */
  "aria-label"?: string;
  /** Placement only (width, margin), applied to the trigger. */
  className?: string;
}

/**
 * A date field: a trigger button that opens a calendar, in a bottom sheet on compact windows and
 * a popover elsewhere. The sheet closes once a date is picked.
 *
 * @example
 * ```tsx
 * <DatePicker
 *   value={checkIn}
 *   onChange={setCheckIn}
 *   isDateDisabled={(date) => date < today}
 *   placeholder="Check-in date"
 * />
 * ```
 */
export function DatePicker({
  value,
  onChange,
  isDateDisabled,
  placeholder,
  "aria-label": ariaLabel,
  className,
}: DatePickerProps) {
  return (
    <ResponsiveDatePicker
      value={value}
      onChange={(date) => onChange(date)}
      disabled={isDateDisabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      buttonClassName={className}
    />
  );
}

export interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  /** Return true for dates that can't be picked, such as booked days. */
  isDateDisabled?: (date: Date) => boolean;
  placeholder?: string;
  /** Months shown side by side in the popover. Compact windows always show one. */
  numberOfMonths?: number;
  "aria-label"?: string;
  /** Points at the element holding the field's error or hint. */
  "aria-describedby"?: string;
  /** Disables the trigger. */
  disabled?: boolean;
  /** Placement only (width, margin), applied to the trigger. */
  className?: string;
}

/**
 * A from–to date field, such as stay dates. Same trigger and sheet/popover behaviour as
 * `DatePicker`; the sheet closes once both ends are picked.
 *
 * @example
 * ```tsx
 * <DateRangePicker value={stay} onChange={setStay} placeholder="Stay dates" aria-label="Stay dates" />
 * ```
 */
export function DateRangePicker({
  value,
  onChange,
  isDateDisabled,
  placeholder,
  numberOfMonths,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
  disabled,
  className,
}: DateRangePickerProps) {
  return (
    <ResponsiveDateRangePicker
      value={value}
      onChange={onChange}
      disabled={isDateDisabled}
      placeholder={placeholder}
      numberOfMonths={numberOfMonths}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      buttonDisabled={disabled}
      buttonClassName={className}
    />
  );
}
