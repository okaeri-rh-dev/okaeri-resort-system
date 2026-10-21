import type { ComponentProps, JSX } from "react";

import type { DateRange, DayButton } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/** Props the month grid passes to a caller's day cell: spread the rest onto its `<button>`. */
export type CalendarDayButtonProps = ComponentProps<typeof DayButton>;

interface RangeCalendarProps {
  variant: "range";
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  /** The month shown first. Defaults to the selected range's month, else today's. */
  defaultMonth?: Date;
  /** Placement only (width, margin). */
  className?: string;
}

interface MonthGridCalendarProps {
  variant: "month-grid";
  /** The month shown. The caller owns the month and its navigation. */
  month: Date;
  onMonthChange?: (month: Date) => void;
  /** Renders each day cell; it sets the cell's height. */
  dayButton: (props: CalendarDayButtonProps) => JSX.Element;
  /** Drops the padding inside the border, for narrow panes. */
  compact?: boolean;
  /** Placement only (width, margin). */
  className?: string;
}

export type InlineCalendarProps = RangeCalendarProps | MonthGridCalendarProps;

const monthGridClassNames = {
  months: "flex flex-col space-y-4 w-full",
  month: "space-y-3 w-full",
  month_caption: "hidden",
  // table-fixed keeps the grid at its declared width; the grid is an inline-size container so a
  // day cell's content can scale with `cqi`
  month_grid: "w-full table-fixed border-collapse space-y-1 [container-type:inline-size]",
  weekdays: "flex w-full",
  weekday:
    "text-muted-foreground rounded-md min-w-0 flex-1 font-medium text-xs uppercase tracking-wider",
  week: "flex w-full mt-1",
  day: cn(
    "relative min-w-0 flex-1 p-0 text-center text-sm",
    "[&:has([aria-selected])]:bg-accent",
    "first:[&:has([aria-selected])]:rounded-l-md",
    "last:[&:has([aria-selected])]:rounded-r-md",
    "focus-within:relative focus-within:z-20"
  ),
  selected:
    "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
  today: "bg-accent/50 text-accent-foreground font-semibold",
  outside: "text-muted-foreground",
  disabled: "text-muted-foreground opacity-50",
  hidden: "invisible",
};

/**
 * A calendar that is always open, for a surface that is already open. Use `DatePicker` or
 * `DateRangePicker` for a date field.
 *
 * - `variant="range"`: a from–to picker, such as a date filter inside `FilterPopover`.
 * - `variant="month-grid"`: a full-width month whose day cells the caller renders, such as a
 *   schedule. It has no caption or arrows; the caller shows the month and moves it.
 *
 * @example
 * ```tsx
 * <FilterPopover fitContent showActions onApply={apply} onClear={clear}
 *   content={<InlineCalendar variant="range" selected={range} onSelect={setRange} />}>
 *   Dates
 * </FilterPopover>
 *
 * <InlineCalendar variant="month-grid" month={month} onMonthChange={setMonth} dayButton={ScheduleDay} />
 * ```
 */
export function InlineCalendar(props: InlineCalendarProps) {
  if (props.variant === "month-grid") {
    const { month, onMonthChange, dayButton, compact = false, className } = props;
    return (
      <Calendar
        mode="single"
        month={month}
        onMonthChange={onMonthChange}
        hideNavigation
        className={cn("w-full rounded-md border", compact && "p-0", className)}
        classNames={monthGridClassNames}
        components={{ DayButton: dayButton }}
      />
    );
  }

  const { selected, onSelect, defaultMonth, className } = props;
  return (
    <Calendar
      mode="range"
      selected={selected}
      onSelect={onSelect}
      defaultMonth={defaultMonth ?? selected?.from}
      required={false}
      className={cn("rounded-md border", className)}
    />
  );
}
