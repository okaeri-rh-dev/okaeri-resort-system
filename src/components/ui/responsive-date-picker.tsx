import * as React from "react";

import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import type { DateRange, SelectSingleEventHandler } from "react-day-picker";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

// Import mobile-specific styles
import "./responsive-date-picker.css";

import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

export interface ResponsiveDatePickerProps {
  value?: Date;
  onChange?: SelectSingleEventHandler;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  buttonClassName?: string;
  calendarClassName?: string;
  align?: "start" | "center" | "end";
  formatStr?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

/**
 * ResponsiveDatePicker - A responsive date picker that uses Sheet on mobile and Popover on desktop
 *
 * This component automatically switches between:
 * - Desktop (≥768px): Popover with Calendar (current experience)
 * - Mobile (<768px): Bottom Sheet with Calendar (mobile-optimized)
 *
 * @example
 * ```tsx
 * <ResponsiveDatePicker
 *   value={date}
 *   onChange={setDate}
 *   disabled={(date) => date < new Date()}
 *   placeholder="Select date"
 * />
 * ```
 */
export function ResponsiveDatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Pick a date",
  buttonClassName,
  calendarClassName,
  align = "start",
  formatStr = "PPP",
  buttonVariant = "outline",
}: ResponsiveDatePickerProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = React.useState(false);

  const handleSelect: SelectSingleEventHandler = (date, selectedDay, activeModifiers, e) => {
    onChange?.(date, selectedDay, activeModifiers, e);
    // Auto-close on mobile after selection for better UX
    if (isMobile) {
      setOpen(false);
    }
  };

  const triggerButton = (
    <Button
      variant={buttonVariant}
      className={cn(
        "w-full touch-manipulation pl-4 text-left text-base font-normal sm:text-sm",
        !value && "text-muted-foreground",
        buttonClassName
      )}
    >
      {value ? format(value, formatStr) : <span>{placeholder}</span>}
      <CalendarDays className="ml-auto h-5 w-5 opacity-50 sm:h-4 sm:w-4" aria-hidden="true" />
    </Button>
  );

  // Mobile: Bottom Sheet
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="pb-safe h-auto max-h-[80vh] overflow-y-auto px-4">
          <SheetHeader className="mb-4">
            <SheetTitle>Select Date</SheetTitle>
            <SheetDescription>Choose your preferred date from the calendar below</SheetDescription>
          </SheetHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              disabled={disabled}
              initialFocus
              fixedWeeks={true}
              className={cn("mobile-calendar touch-manipulation", calendarClassName)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Popover (exactly as it was)
  return (
    <Popover>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align={align}>
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
          initialFocus
          className={cn("touch-manipulation", calendarClassName)}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * ResponsiveDateRangePicker - A responsive date range picker for selecting date ranges
 *
 * This component handles date range selection with mobile optimization:
 * - Desktop: Side-by-side months in Popover
 * - Mobile: Stacked months in Bottom Sheet
 *
 * @example
 * ```tsx
 * <ResponsiveDateRangePicker
 *   value={dateRange}
 *   onChange={setDateRange}
 *   disabled={(date) => date < new Date()}
 *   placeholder="Select dates"
 * />
 * ```
 */
export interface ResponsiveDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  buttonClassName?: string;
  calendarClassName?: string;
  align?: "start" | "center" | "end";
  numberOfMonths?: number;
  formatStr?: string;
  buttonVariant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  /** Accessibility label for the button */
  "aria-label"?: string;
  /** ID of element describing the button (for errors/success messages) */
  "aria-describedby"?: string;
  /** Disable the button (prevents opening calendar) */
  buttonDisabled?: boolean;
}

export function ResponsiveDateRangePicker({
  value,
  onChange,
  disabled,
  placeholder = "Pick a date range",
  buttonClassName,
  calendarClassName,
  align = "start",
  numberOfMonths = 2,
  formatStr = "LLL dd, y",
  buttonVariant = "outline",
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedby,
  buttonDisabled = false,
}: ResponsiveDateRangePickerProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = React.useState(false);

  const handleSelect = (range: DateRange | undefined) => {
    onChange?.(range);
    // Auto-close on mobile when both dates are selected
    if (isMobile && range?.from && range?.to) {
      setTimeout(() => setOpen(false), 200); // Small delay for visual feedback
    }
  };

  const displayText = React.useMemo(() => {
    if (!value?.from) return placeholder;
    if (!value.to) return format(value.from, formatStr);
    return `${format(value.from, formatStr)} - ${format(value.to, formatStr)}`;
  }, [value, formatStr, placeholder]);

  const triggerButton = (
    <Button
      variant={buttonVariant}
      className={cn(
        "w-full touch-manipulation pl-4 text-left text-base font-normal sm:text-sm",
        !value?.from && "text-muted-foreground",
        buttonClassName
      )}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedby}
      disabled={buttonDisabled}
    >
      <span className="truncate">{displayText}</span>
      <CalendarDays
        className="ml-auto h-5 w-5 flex-shrink-0 opacity-50 sm:h-4 sm:w-4"
        aria-hidden="true"
      />
    </Button>
  );

  // Mobile: Bottom Sheet with single month view
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{triggerButton}</SheetTrigger>
        <SheetContent side="bottom" className="pb-safe h-auto max-h-[80vh] overflow-y-auto px-4">
          <SheetHeader className="mb-4">
            <SheetTitle>Select Date Range</SheetTitle>
            <SheetDescription>Choose your check-in and check-out dates</SheetDescription>
          </SheetHeader>
          <div className="flex justify-center">
            <Calendar
              mode="range"
              selected={value}
              onSelect={handleSelect}
              disabled={disabled}
              initialFocus
              numberOfMonths={1} // Single month on mobile for better UX
              fixedWeeks={true}
              className={cn("mobile-calendar touch-manipulation", calendarClassName)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Popover with multiple months (exactly as it was)
  return (
    <Popover>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          selected={value}
          onSelect={onChange}
          disabled={disabled}
          initialFocus
          numberOfMonths={numberOfMonths}
          className={cn("touch-manipulation", calendarClassName)}
        />
      </PopoverContent>
    </Popover>
  );
}
