import React, { useState } from "react";

import { CalendarDays, DollarSign, Download } from "lucide-react";

import { FilterPopover, TableSearch } from "@/components/tables/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/stores/useExpenseStore";

import type { ExpenseFiltersProps } from "../types";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface AmountRange {
  min: number | undefined;
  max: number | undefined;
}

export const ExpenseFilters: React.FC<ExpenseFiltersProps> = ({
  filters,
  setFilters,
  searchQuery,
  setSearchQuery,
  resetFilters,
  onExport,
  isExporting = false,
  totalCount,
}) => {
  // Date range state management
  const [dateRange, setDateRange] = useState<DateRange>({
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  });
  const [tempDateRange, setTempDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined,
  });
  const [dateFilterOpen, setDateFilterOpen] = useState(false);

  // Amount range state management
  const [amountRange, setAmountRange] = useState<AmountRange>({
    min: filters.minAmount,
    max: filters.maxAmount,
  });
  const [tempAmountRange, setTempAmountRange] = useState<AmountRange>({
    min: undefined,
    max: undefined,
  });
  const [amountFilterOpen, setAmountFilterOpen] = useState(false);

  const hasActiveFilters = Boolean(
    filters.category ||
      filters.minAmount ||
      filters.maxAmount ||
      filters.dateFrom ||
      filters.dateTo ||
      searchQuery
  );

  return (
    <div className="flex items-center justify-between border-b bg-neutral-50 p-4">
      <div className="flex items-center gap-2">
        <TableSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search expenses..."
          className="w-64"
        />

        {/* Category Filter */}
        <FilterPopover
          isActive={!!filters.category}
          content={
            <div className="space-y-2">
              <div className="text-sm font-medium">Category</div>
              <Select
                value={filters.category || "all"}
                onValueChange={(value: string) =>
                  setFilters({
                    ...filters,
                    category: value === "all" ? undefined : (value as ExpenseCategory),
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          Category
        </FilterPopover>

        {/* Date Range Filter */}
        <FilterPopover
          isActive={!!(filters.dateFrom || filters.dateTo)}
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
              dateFrom: fromDate?.toISOString().split("T")[0],
              dateTo: toDate?.toISOString().split("T")[0],
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
                onSelect={(range) => {
                  if (range) {
                    setTempDateRange({ from: range.from, to: range.to });
                  } else {
                    setTempDateRange({ from: undefined, to: undefined });
                  }
                }}
                className="rounded-md border"
                required={false}
              />
            </div>
          }
        >
          <CalendarDays className="mr-1 h-3 w-3" />
          Dates
        </FilterPopover>

        {/* Amount Range Filter */}
        <FilterPopover
          isActive={!!(filters.minAmount || filters.maxAmount)}
          open={amountFilterOpen}
          onOpenChange={(open) => {
            setAmountFilterOpen(open);
            if (open) {
              setTempAmountRange(amountRange);
            }
          }}
          showActions={true}
          onApply={() => {
            setAmountRange(tempAmountRange);
            setFilters({
              ...filters,
              minAmount: tempAmountRange.min,
              maxAmount: tempAmountRange.max,
            });
          }}
          onClear={() => {
            setTempAmountRange({ min: undefined, max: undefined });
          }}
          content={
            <div className="space-y-3">
              <div className="text-sm font-medium">Amount Range</div>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Min amount (₱)"
                  value={tempAmountRange.min || ""}
                  onChange={(e) =>
                    setTempAmountRange({
                      ...tempAmountRange,
                      min: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="Max amount (₱)"
                  value={tempAmountRange.max || ""}
                  onChange={(e) =>
                    setTempAmountRange({
                      ...tempAmountRange,
                      max: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full"
                />
              </div>
            </div>
          }
        >
          <DollarSign className="mr-1 h-3 w-3" />
          Amount
        </FilterPopover>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetFilters();
              setDateRange({ from: undefined, to: undefined });
              setAmountRange({ min: undefined, max: undefined });
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Export Button */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-600">
          {totalCount} expense{totalCount !== 1 ? "s" : ""} total
        </span>
        <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
          <Download className="mr-1 h-3 w-3" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>
    </div>
  );
};
