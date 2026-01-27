import React from "react";

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
  // Date range - derive from filters, apply instantly
  const dateRange: DateRange = {
    from: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    to: filters.dateTo ? new Date(filters.dateTo) : undefined,
  };

  // Amount range - derive from filters, apply instantly
  const amountRange: AmountRange = {
    min: filters.minAmount,
    max: filters.maxAmount,
  };

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

        {/* Date Range Filter - Applies instantly on selection */}
        <FilterPopover
          isActive={!!(filters.dateFrom || filters.dateTo)}
          content={
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Date Range</span>
                {(filters.dateFrom || filters.dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setFilters({
                        ...filters,
                        dateFrom: undefined,
                        dateTo: undefined,
                      });
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  // Apply filter instantly when date is selected
                  const fromDate = range?.from;
                  const toDate = range?.to || fromDate;
                  setFilters({
                    ...filters,
                    dateFrom: fromDate?.toISOString().split("T")[0],
                    dateTo: toDate?.toISOString().split("T")[0],
                  });
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

        {/* Amount Range Filter - Applies instantly on blur */}
        <FilterPopover
          isActive={!!(filters.minAmount || filters.maxAmount)}
          content={
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Amount Range</span>
                {(filters.minAmount || filters.maxAmount) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setFilters({
                        ...filters,
                        minAmount: undefined,
                        maxAmount: undefined,
                      });
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Min amount (₱)"
                  value={amountRange.min ?? ""}
                  onChange={(e) => {
                    // Apply filter instantly on change
                    setFilters({
                      ...filters,
                      minAmount: e.target.value ? Number(e.target.value) : undefined,
                    });
                  }}
                  className="w-full"
                />
                <Input
                  type="number"
                  placeholder="Max amount (₱)"
                  value={amountRange.max ?? ""}
                  onChange={(e) => {
                    // Apply filter instantly on change
                    setFilters({
                      ...filters,
                      maxAmount: e.target.value ? Number(e.target.value) : undefined,
                    });
                  }}
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
          <Button variant="outline" size="sm" onClick={resetFilters}>
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
