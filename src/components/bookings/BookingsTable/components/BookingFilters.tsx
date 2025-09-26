import React, { useState } from "react";
import { CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSearch, FilterPopover } from "@/components/tables/utils";
import type { BookingStatus, PaymentStatus } from "@/types";
import type { BookingFiltersProps, DateRange } from "../types";

export const BookingFilters: React.FC<BookingFiltersProps> = ({
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  resetFilters,
  onExport,
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

  return (
    <div className="flex justify-between items-center p-4 bg-neutral-50 border-b">
      <div className="flex items-center gap-2">
        <TableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search bookings..."
          className="w-64"
        />

        <FilterPopover
          isActive={!!filters.status}
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

        <FilterPopover
          isActive={!!filters.payment_status}
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
            // If only "from" date is selected, use it for both from and to
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

        {(Object.keys(filters).length > 0 || searchQuery) && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            Clear Filters
          </Button>
        )}
      </div>

      <Button variant="outline" size="sm" onClick={onExport}>
        <Download className="mr-1 h-3 w-3" />
        Export CSV
      </Button>
    </div>
  );
};
