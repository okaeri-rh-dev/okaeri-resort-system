import React, { useState } from "react";

import { parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";

import {
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
import { BOOKING_SOURCES, pickedDay } from "@/lib/bookings";
import { PAYMENT_STATUSES } from "@/types";

import type { BookingFiltersProps, DateRange } from "../types";

// shortcut: one value per filter until the Filters sheet (#330) brings multi-select
const SingleSelectFilter = ({
  label,
  title,
  allLabel,
  options,
  picked,
  onPick,
}: {
  label: string;
  title: string;
  allLabel: string;
  options: readonly string[];
  picked: string[] | undefined;
  onPick: (picked: string[] | undefined) => void;
}) => {
  const current = options.find((option) => option.toLowerCase() === picked?.[0]);
  return (
    <FilterPopover
      isActive={!!current}
      badgeLabel={current}
      content={
        <div className="space-y-2">
          <div className="text-sm font-medium">{title}</div>
          <Select
            value={current ?? "all"}
            onValueChange={(value: string) =>
              onPick(value === "all" ? undefined : [value.toLowerCase()])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{allLabel}</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {label}
    </FilterPopover>
  );
};

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  search,
  setSearch,
  resetFilters,
  hasActiveFilters,
  resultCount,
  totalCount,
}) => {
  const [tempDateRange, setTempDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  const activeFilterCount = [
    search.payment,
    search.source,
    search.from || search.to,
    search.cabin,
  ].filter(Boolean).length;

  const DateFilter = () => (
    <FilterPopover
      isActive={!!(search.from || search.to)}
      open={dateFilterOpen}
      onOpenChange={(open) => {
        setDateFilterOpen(open);
        if (open) {
          setTempDateRange({
            from: search.from ? parseISO(search.from) : undefined,
            to: search.to ? parseISO(search.to) : undefined,
          });
        }
      }}
      fitContent
      showActions
      onApply={() => {
        const fromDate = tempDateRange?.from;
        const toDate = tempDateRange?.to || fromDate;
        setSearch({
          from: fromDate ? pickedDay(fromDate) : undefined,
          to: toDate ? pickedDay(toDate) : undefined,
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
            <span className="text-foreground font-medium">{resultCount}</span> bookings
          </>
        )}
      </span>
    );

  return (
    <FilterBar
      search={
        <TableSearch
          value={search.q ?? ""}
          onChange={(q) => setSearch({ q })}
          placeholder="Search bookings..."
        />
      }
      filters={
        <>
          <SingleSelectFilter
            label="Payment"
            title="Payment Status"
            allLabel="All Payments"
            options={PAYMENT_STATUSES}
            picked={search.payment}
            onPick={(payment) => setSearch({ payment: payment as typeof search.payment })}
          />
          <SingleSelectFilter
            label="Source"
            title="Booking Source"
            allLabel="All Sources"
            options={BOOKING_SOURCES}
            picked={search.source}
            onPick={(source) => setSearch({ source: source as typeof search.source })}
          />
          <DateFilter />
        </>
      }
      activeFilterCount={activeFilterCount}
      onClearFilters={hasActiveFilters ? resetFilters : undefined}
      summary={<ResultCount />}
    />
  );
};
