/**
 * FilterPanel Component
 *
 * Reusable filter panel for unit selection:
 * - Can be used inline (desktop) or in Sheet (mobile)
 * - Filter by unit type, occupancy, and price range
 * - Clear filters action
 * - Mobile-optimized with touch-friendly targets
 *
 * @module FilterPanel
 */

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ============================================
// TYPES
// ============================================

export interface FilterState {
  unitType: string;
  maxOccupancy: string;
  maxRate: string;
}

export interface FilterPanelProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
  variant?: "inline" | "sheet";
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FilterPanel({
  filters,
  onFilterChange,
  onClearFilters,
  variant = "inline",
}: FilterPanelProps) {
  const hasActiveFilters =
    filters.unitType !== "all" || filters.maxOccupancy !== "all" || filters.maxRate !== "all";

  const handleFilterUpdate = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const isSheet = variant === "sheet";

  return (
    <div className={isSheet ? "space-y-6 p-4" : "flex flex-wrap gap-4"} role="search">
      {isSheet && (
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Filter Units</h3>
          <p className="text-sm text-muted-foreground">
            Narrow down units by type, occupancy, and price range
          </p>
        </div>
      )}

      {/* Unit Type Filter */}
      <div className={isSheet ? "space-y-2" : "w-[180px]"}>
        {isSheet && <Label htmlFor="filter-unit-type">Unit Type</Label>}
        <Select
          value={filters.unitType}
          onValueChange={(value) => handleFilterUpdate("unitType", value)}
        >
          <SelectTrigger
            id="filter-unit-type"
            className={isSheet ? "h-12 w-full" : "w-[180px]"}
            aria-label="Filter by unit type"
          >
            <SelectValue placeholder="Unit Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Standard">Standard</SelectItem>
            <SelectItem value="Deluxe">Deluxe</SelectItem>
            <SelectItem value="Suite">Suite</SelectItem>
            <SelectItem value="Villa">Villa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Occupancy Filter */}
      <div className={isSheet ? "space-y-2" : "w-[180px]"}>
        {isSheet && <Label htmlFor="filter-occupancy">Maximum Occupancy</Label>}
        <Select
          value={filters.maxOccupancy}
          onValueChange={(value) => handleFilterUpdate("maxOccupancy", value)}
        >
          <SelectTrigger
            id="filter-occupancy"
            className={isSheet ? "h-12 w-full" : "w-[180px]"}
            aria-label="Filter by occupancy"
          >
            <SelectValue placeholder="Occupancy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Occupancy</SelectItem>
            <SelectItem value="2">2+ guests</SelectItem>
            <SelectItem value="4">4+ guests</SelectItem>
            <SelectItem value="6">6+ guests</SelectItem>
            <SelectItem value="8">8+ guests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Price Range Filter */}
      <div className={isSheet ? "space-y-2" : "w-[180px]"}>
        {isSheet && <Label htmlFor="filter-price">Maximum Price</Label>}
        <Select
          value={filters.maxRate}
          onValueChange={(value) => handleFilterUpdate("maxRate", value)}
        >
          <SelectTrigger
            id="filter-price"
            className={isSheet ? "h-12 w-full" : "w-[180px]"}
            aria-label="Filter by max price"
          >
            <SelectValue placeholder="Max Price" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Price</SelectItem>
            <SelectItem value="3000">Under ₱3,000</SelectItem>
            <SelectItem value="5000">Under ₱5,000</SelectItem>
            <SelectItem value="10000">Under ₱10,000</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size={isSheet ? "lg" : "sm"}
          onClick={onClearFilters}
          className={isSheet ? "h-12 w-full" : "h-10"}
          aria-label="Clear all filters"
        >
          <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
          Clear Filters
        </Button>
      )}

      {/* Apply Button for Sheet Variant */}
      {isSheet && (
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground mb-2">
            {hasActiveFilters
              ? "Filters applied - close to see results"
              : "Select filters above to narrow results"}
          </p>
        </div>
      )}
    </div>
  );
}
