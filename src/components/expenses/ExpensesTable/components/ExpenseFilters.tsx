import React, { useState } from "react";

import { CalendarDays, ChevronDown, DollarSign, Download, Filter, X } from "lucide-react";

import { FilterPopover, TableSearch } from "@/components/patterns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useResponsiveView } from "@/hooks";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { toISODateString } from "@/lib/timezone";

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { isMobile } = useResponsiveView();
  const { data: allCategories = [] } = useExpenseCategories();

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

  // Count active filter types (excluding search)
  const activeFilterCount = (): number => {
    let count = 0;
    if (filters.category) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.minAmount || filters.maxAmount) count++;
    return count;
  };

  // Extracted sub-components for reuse in both layouts
  const CategoryFilter = () => (
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
                category: value === "all" ? undefined : value,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      Category
    </FilterPopover>
  );

  const DateRangeFilter = () => (
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
              const fromDate = range?.from;
              const toDate = range?.to || fromDate;
              setFilters({
                ...filters,
                dateFrom: fromDate ? toISODateString(fromDate) : undefined,
                dateTo: toDate ? toISODateString(toDate) : undefined,
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
  );

  const AmountFilter = () => (
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
            <div className="grid grid-cols-2 gap-2">
              <CategoryFilter />
              <DateRangeFilter />
            </div>
            <div className="flex items-center gap-2">
              <AmountFilter />
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1">
                  <X className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Bottom row: Total count + Export */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-600">
            {totalCount} expense{totalCount !== 1 ? "s" : ""} total
          </span>
          <Button variant="outline" size="sm" onClick={onExport} disabled={isExporting}>
            <Download className="mr-1 h-3 w-3" />
            {isExporting ? "Exporting..." : "Export"}
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
          placeholder="Search expenses..."
          className="w-64"
        />

        <CategoryFilter />
        <DateRangeFilter />
        <AmountFilter />

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
