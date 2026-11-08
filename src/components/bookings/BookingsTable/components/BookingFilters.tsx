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
import { BOOKING_SOURCES, pickedDay, type BookingSource } from "@/lib/bookings";
import { statusLabel } from "@/lib/status-tone";
import {
  BOOKING_STATUSES,
  PAYMENT_STATUSES,
  type BookingStatus,
  type PaymentStatus,
} from "@/types";

import type { BookingFiltersProps, DateRange } from "../types";

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  resetFilters,
  hasActiveFilters,
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

  // Count active filter types (excluding search)
  const activeFilterCount = (): number => {
    let count = 0;
    if (filters.status !== undefined) count++;
    if (filters.payment_status !== undefined) count++;
    if (filters.date_from !== undefined || filters.date_to !== undefined) count++;
    if (filters.booking_source !== undefined) count++;
    return count;
  };

  // Filter controls (shared between mobile and desktop)
  const StatusFilter = () => (
    <FilterPopover
      isActive={!!filters.status}
      badgeLabel={filters.status && statusLabel(filters.status)}
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
              {BOOKING_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
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
              {PAYMENT_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      Payment
    </FilterPopover>
  );

  const SourceFilter = () => (
    <FilterPopover
      isActive={!!filters.booking_source}
      badgeLabel={filters.booking_source}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">Booking Source</div>
          <Select
            value={filters.booking_source || "all"}
            onValueChange={(value: string) =>
              setFilters({
                ...filters,
                booking_source: value === "all" ? undefined : (value as BookingSource),
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {BOOKING_SOURCES.map((source) => (
                <SelectItem key={source} value={source}>
                  {source}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      Source
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
        <div className="space-y-3 px-2 pt-2">
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
        {hasActiveFilters ? (
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
          <SourceFilter />
          <DateFilter />
        </>
      }
      activeFilterCount={activeFilterCount()}
      onClearFilters={hasActiveFilters ? resetFilters : undefined}
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
