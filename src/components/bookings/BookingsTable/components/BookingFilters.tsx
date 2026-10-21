import React, { useState } from "react";

import { CalendarDays, Download } from "lucide-react";

import {
  Button,
  FilterBar,
  FilterPopover,
  InlineCalendar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableSearch,
} from "@/components/patterns";
import { pickedDay } from "@/lib/bookings";
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
      fitContent
      showActions
      onApply={() => {
        setDateRange(tempDateRange);
        const fromDate = tempDateRange?.from;
        const toDate = tempDateRange?.to || fromDate;
        setFilters({
          ...filters,
          date_from: fromDate ? pickedDay(fromDate) : undefined,
          date_to: toDate ? pickedDay(toDate) : undefined,
        });
      }}
      onClear={() => {
        setTempDateRange({ from: undefined, to: undefined });
      }}
      content={
        <div className="space-y-3 px-3 pt-3">
          <div className="text-sm font-medium">Date Range</div>
          <InlineCalendar
            variant="range"
            selected={tempDateRange}
            onSelect={(range) => setTempDateRange(range || { from: undefined, to: undefined })}
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

  return (
    <FilterBar
      search={
        <TableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search bookings..."
        />
      }
      filters={
        <>
          <StatusFilter />
          <PaymentFilter />
          <WalkInFilter />
          <DateFilter />
        </>
      }
      activeFilterCount={activeFilterCount()}
      onClearFilters={hasActiveFilters() ? resetFilters : undefined}
      summary={<ResultCount />}
      actions={
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1 h-3 w-3" />
          Export CSV
        </Button>
      }
    />
  );
};
