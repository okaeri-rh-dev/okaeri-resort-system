import React, { useState } from "react";

import { CalendarDays, ChevronDown, Download, Filter, X } from "lucide-react";

import { FilterPopover, TableSearch } from "@/components/tables/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResponsiveView } from "@/hooks";
import type { BookingStatus, PaymentStatus } from "@/types";

import type { BookingFiltersProps, DateRange } from "../types";

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  resetFilters,
  onExport,
  resultCount,
  totalCount,
}) => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { isMobile } = useResponsiveView();

  // Check if any filters are actually active (have non-undefined values)
  const hasActiveFilters = (): boolean => {
    const hasFilterValues =
      filters.status !== undefined ||
      filters.payment_status !== undefined ||
      filters.date_from !== undefined ||
      filters.date_to !== undefined ||
      filters.is_walk_in !== undefined;
    return hasFilterValues || searchQuery.trim().length > 0;
  };

  // Count active filter types (excluding search)
  const activeFilterCount = (): number => {
    let count = 0;
    if (filters.status !== undefined) count++;
    if (filters.payment_status !== undefined) count++;
    if (filters.date_from !== undefined || filters.date_to !== undefined) count++;
    if (filters.is_walk_in !== undefined) count++;
    return count;
  };

  const walkInLabel =
    filters.is_walk_in === true ? "Walk-ins" : filters.is_walk_in === false ? "Reserved" : "";

  // Filter controls (shared between mobile and desktop)
  const StatusFilter = () => (
    <FilterPopover
      isActive={!!filters.status}
      badgeLabel={filters.status}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Booking Status</div>
          <Select
            value={filters.status || "all"}
            onValueChange={(value: string) =>
              setFilters({
                ...filters,
                status: value === "all" ? undefined : (value as BookingStatus),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bookings</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Confirmed">Confirmed</SelectItem>
              <SelectItem value="CheckedIn">Checked In</SelectItem>
              <SelectItem value="CheckedOut">Checked Out</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="NoShow">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      Status
    </FilterPopover>
  );

  const PaymentFilter = () => (
    <FilterPopover
      isActive={!!filters.payment_status}
      badgeLabel={filters.payment_status}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Payment Status</div>
          <Select
            value={filters.payment_status || "all"}
            onValueChange={(value: string) =>
              setFilters({
                ...filters,
                payment_status: value === "all" ? undefined : (value as PaymentStatus),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Partial">Partial</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      Payment
    </FilterPopover>
  );

  const WalkInFilter = () => (
    <FilterPopover
      isActive={filters.is_walk_in !== undefined}
      badgeLabel={walkInLabel}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Booking Source</div>
          <Select
            value={
              filters.is_walk_in === true
                ? "walk_in"
                : filters.is_walk_in === false
                  ? "reserved"
                  : "all"
            }
            onValueChange={(value: string) =>
              setFilters({
                ...filters,
                is_walk_in: value === "walk_in" ? true : value === "reserved" ? false : undefined,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bookings</SelectItem>
              <SelectItem value="walk_in">Walk-ins only</SelectItem>
              <SelectItem value="reserved">Reserved only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      Walk-in
    </FilterPopover>
  );

  const DateFilter = () => (
    <FilterPopover
      isActive={!!(filters.date_from || filters.date_to)}
      open={dateFilterOpen}
      onOpenChange={(open) => {
        setDateFilterOpen(open);
        if (open) {
          setTempDateRange(dateRange);
        }
      }}
      showActions={true}
      onApply={() => {
        setDateRange(tempDateRange);
        const fromDate = tempDateRange?.from;
        const toDate = tempDateRange?.to || fromDate;
        setFilters({
          ...filters,
          date_from: fromDate?.toISOString(),
          date_to: toDate?.toISOString(),
        });
      }}
      onClear={() => {
        setTempDateRange({ from: undefined, to: undefined });
      }}
      content={
        <div className="space-y-3">
          <div className="text-sm font-medium">Date Range</div>
          <Calendar
            mode="range"
            selected={tempDateRange}
            onSelect={(range) => setTempDateRange(range || { from: undefined, to: undefined })}
            className="rounded-md border"
            required={false}
          />
        </div>
      }
    >
      <CalendarDays className="mr-1 h-3 w-3" />
      Dates
    </FilterPopover>
  );

  const ResultCount = () =>
    resultCount !== undefined &&
    totalCount !== undefined && (
      <span className="text-muted-foreground text-sm">
        {hasActiveFilters() ? (
          <>
            <span className="text-foreground font-medium">{resultCount}</span> of {totalCount}{" "}
            bookings
          </>
        ) : (
          <>
            <span className="text-foreground font-medium">{totalCount}</span> bookings
          </>
        )}
      </span>
    );

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="space-y-3 border-b bg-neutral-50 p-4">
        {/* Top row: Search + Filter toggle */}
        <div className="flex items-center gap-2">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search..."
            className="flex-1"
          />
          <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="relative gap-1">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount() > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-primary text-primary-foreground ml-1 h-5 min-w-5 px-1"
                  >
                    {activeFilterCount()}
                  </Badge>
                )}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        </div>

        {/* Collapsible filter section */}
        <Collapsible open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <CollapsibleContent className="space-y-3">
            {/* Filter grid - 2 columns on mobile */}
            <div className="grid grid-cols-2 gap-2">
              <StatusFilter />
              <PaymentFilter />
              <WalkInFilter />
            </div>
            <div className="flex items-center gap-2">
              <DateFilter />
              {hasActiveFilters() && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bottom row: Result count + Export */}
        <div className="flex items-center justify-between">
          <ResultCount />
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-1 h-3 w-3" />
            Export
          </Button>
        </div>
      </div>
    );
  }

  // Desktop Layout (original)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-neutral-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <TableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search bookings..."
          className="w-64"
        />

        <StatusFilter />
        <PaymentFilter />
        <WalkInFilter />
        <DateFilter />

        {hasActiveFilters() && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear Filters
          </Button>
        )}

        {/* Result count indicator */}
        <div className="ml-2">
          <ResultCount />
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="mr-1 h-3 w-3" />
        Export CSV
      </Button>
    </div>
  );
};
