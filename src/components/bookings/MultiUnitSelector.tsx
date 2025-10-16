/**
 * MultiUnitSelector Component
 *
 * Allows users to browse and select multiple units for a booking with:
 * - Grid/List view toggle
 * - Filtering by type, occupancy, and price
 * - Availability indicators
 * - Add/Remove unit actions
 * - Loading and error states
 * - Mobile-responsive design
 *
 * @module MultiUnitSelector
 */

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/validations";
import type { Unit } from "@/types";
import type { BookingUnit } from "@/types/multi-unit-booking";
import { Filter, Grid3x3, List } from "lucide-react";
import { useMemo, useState } from "react";
import { filterUnits, hasActiveFilters, type FilterState } from "./MultiUnitSelector/utils";

// ============================================
// TYPES
// ============================================

export interface MultiUnitSelectorProps {
  // Available units from API
  units: Unit[];

  // Currently selected units
  selectedUnits: BookingUnit[];

  // Date range for availability checking
  checkIn: Date | string;
  checkOut: Date | string;

  // Callbacks
  onAddUnit: (unit: Unit) => void;
  onRemoveUnit: (unitId: string) => void;
  onViewDetails?: (unitId: string) => void;

  // Configuration
  maxUnits?: number; // Default: 10
  enableFilters?: boolean; // Default: true
  viewMode?: "grid" | "list"; // Default: 'grid'

  // State
  isLoading?: boolean;
  error?: string | null;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MultiUnitSelector({
  units,
  selectedUnits,
  checkIn,
  checkOut,
  onAddUnit,
  onRemoveUnit,
  maxUnits = 10,
  enableFilters = true,
  viewMode: initialViewMode = "grid",
  isLoading,
  error,
}: MultiUnitSelectorProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">(initialViewMode);
  const [filters, setFilters] = useState<FilterState>({
    unitType: "all",
    maxOccupancy: "all",
    maxRate: "all",
  });

  // Filter units based on criteria using utility function
  const filteredUnits = useMemo(() => filterUnits(units, filters), [units, filters]);

  const canAddMore = selectedUnits.length < maxUnits;
  const isSelected = (unitId: string) => selectedUnits.some((u) => u.unit_id === unitId);

  // Check if filters are active using utility function
  const filtersActive = hasActiveFilters(filters);

  const clearFilters = () => {
    setFilters({ unitType: "all", maxOccupancy: "all", maxRate: "all" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Select Cabins</h2>
          <p className="text-sm text-muted-foreground">
            {selectedUnits.length} of {maxUnits} {selectedUnits.length === 1 ? "cabin" : "cabins"}{" "}
            selected
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
            className="h-10 w-10 p-0"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
            aria-label="List view"
            className="h-10 w-10 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      {enableFilters && (
        <div className="flex flex-wrap gap-4">
          <Select
            value={filters.unitType}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, unitType: value }))}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by unit type">
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

          <Select
            value={filters.maxOccupancy}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, maxOccupancy: value }))}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by occupancy">
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

          <Select
            value={filters.maxRate}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, maxRate: value }))}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filter by max price">
              <SelectValue placeholder="Max Price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Price</SelectItem>
              <SelectItem value="3000">Under ₱3,000</SelectItem>
              <SelectItem value="5000">Under ₱5,000</SelectItem>
              <SelectItem value="10000">Under ₱10,000</SelectItem>
            </SelectContent>
          </Select>

          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-10">
              <Filter className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          className={cn(
            "grid gap-4",
            viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}
        >
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Unit Grid/List */}
      {!isLoading && (
        <div
          className={cn(
            "grid gap-4",
            viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}
          aria-label="Available units"
        >
          {filteredUnits.map((unit) => (
            <UnitCard
              key={unit.unit_id}
              unit={unit}
              isSelected={isSelected(unit.unit_id)}
              canSelect={canAddMore || isSelected(unit.unit_id)}
              checkIn={checkIn}
              checkOut={checkOut}
              onAdd={() => onAddUnit(unit)}
              onRemove={() => onRemoveUnit(unit.unit_id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredUnits.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No units match your filters</p>
          {filtersActive && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// UNIT CARD SUB-COMPONENT
// ============================================

interface UnitCardProps {
  unit: Unit;
  isSelected: boolean;
  canSelect: boolean;
  checkIn: Date | string;
  checkOut: Date | string;
  onAdd: () => void;
  onRemove: () => void;
}

function UnitCard({
  unit,
  isSelected,
  canSelect,
  checkIn,
  checkOut,
  onAdd,
  onRemove,
}: UnitCardProps) {
  const isAvailable = unit.unit_status === "Available";

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-lg",
        isSelected && "ring-2 ring-primary",
        !isAvailable && "opacity-60"
      )}
      role="article"
      aria-label={`${unit.unit_name}, ${formatCurrency(unit.base_rate)} per night, max ${unit.max_occupancy} guests${isSelected ? ", selected" : ""}`}
    >
      <CardContent className="p-4">
        {/* Unit Info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{unit.unit_name}</h3>
            {isSelected && (
              <Badge variant="secondary" aria-label="Cabin selected">
                Selected
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Max {unit.max_occupancy} guests</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(unit.base_rate)}/night
          </p>

          {/* Availability Badge */}
          <Badge variant={isAvailable ? "default" : "destructive"} className="font-normal">
            {isAvailable ? "✓ Available" : "✗ Unavailable"}
          </Badge>

          {/* Date Range Display */}
          {checkIn && checkOut && (
            <p className="text-xs text-muted-foreground">
              {(checkIn instanceof Date ? checkIn : new Date(checkIn)).toLocaleDateString()} -{" "}
              {(checkOut instanceof Date ? checkOut : new Date(checkOut)).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        {isSelected ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            className="w-full h-11"
            aria-label={`Remove ${unit.unit_name} from booking`}
          >
            Remove
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={onAdd}
            disabled={!canSelect || !isAvailable}
            className="w-full h-11"
            aria-label={`Add ${unit.unit_name} to booking`}
            aria-disabled={!canSelect || !isAvailable}
          >
            Add to Booking
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
