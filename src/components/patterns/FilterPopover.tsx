import { Children, isValidElement, type ReactNode } from "react";

import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// A calendar needs the popover's full width and no padding; react-day-picker takes a `mode` prop
function containsCalendar(node: ReactNode): boolean {
  if (!isValidElement(node)) return false;
  const props = node.props as Record<string, unknown>;
  if (node.type?.toString().includes("Calendar") || props?.mode) return true;
  return Children.toArray(props?.children as ReactNode).some(containsCalendar);
}

export interface FilterPopoverProps {
  /** The filter's name on the trigger. */
  children: ReactNode;
  content: ReactNode;
  isActive?: boolean;
  /** The current value, shown on the trigger while the filter is active. */
  badgeLabel?: string;
  /** Adds Clear and Apply buttons. Clear keeps the popover open; Apply closes it. */
  showActions?: boolean;
  onApply?: () => void;
  onClear?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * A filter button above a table that opens its controls in a popover. The trigger shows the
 * active value. A calendar in the content gets an unpadded popover sized to the calendar.
 *
 * @example
 * ```tsx
 * <FilterPopover isActive={status !== "all"} badgeLabel={status} content={<StatusOptions />}>
 *   Status
 * </FilterPopover>
 * ```
 */
export function FilterPopover({
  children,
  content,
  isActive = false,
  badgeLabel,
  showActions = false,
  onApply,
  onClear,
  open,
  onOpenChange,
}: FilterPopoverProps) {
  const isCalendarContent = containsCalendar(content);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn(isActive && "border-primary bg-accent")}>
          <Filter className="size-3" aria-hidden="true" />
          {children}
          {badgeLabel && isActive && (
            <Badge variant="secondary" className="h-5 px-1.5 font-normal">
              {badgeLabel}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(isCalendarContent ? "w-auto p-0" : "w-56 p-3")}
        align="start"
        aria-label={typeof children === "string" ? `${children} filter` : "Filter"}
      >
        {content}
        {showActions && (
          <div className={cn("flex justify-between gap-2 pt-3", isCalendarContent && "px-3 pb-3")}>
            <Button size="sm" variant="outline" onClick={() => onClear?.()} className="flex-1">
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => {
                onApply?.();
                onOpenChange?.(false);
              }}
              className="flex-1"
            >
              Apply
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
