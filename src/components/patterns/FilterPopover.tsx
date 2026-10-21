import type { ReactNode } from "react";

import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterPopoverProps {
  /** The filter's name on the trigger. */
  children: ReactNode;
  content: ReactNode;
  /** Sizes the popover to its content with no padding, for content such as a calendar. */
  fitContent?: boolean;
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
 * active value. Pass `fitContent` for a calendar, so the popover is unpadded and sized to it.
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
  fitContent = false,
  isActive = false,
  badgeLabel,
  showActions = false,
  onApply,
  onClear,
  open,
  onOpenChange,
}: FilterPopoverProps) {
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
        className={cn(fitContent ? "w-auto p-0" : "w-56 p-3")}
        align="start"
        collisionPadding={16}
        aria-label={typeof children === "string" ? `${children} filter` : "Filter"}
      >
        {content}
        {showActions && (
          <div className={cn("flex justify-between gap-2 pt-3", fitContent && "px-2 pb-2")}>
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
