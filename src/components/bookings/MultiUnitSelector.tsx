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

import { useState, useMemo } from "react";
import { Grid3x3, List, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { Unit } from "@/types";
import type { BookingUnit } from "@/types/multi-unit-booking";

// ============================================
// TYPES
// ============================================

export interface MultiUnitSelectorProps {
  // Available units from API
  units: Unit[];

  // Currently selected units
  selectedUnits: BookingUnit[];

  // Date range for availability checking
  checkIn: string;
  checkOut: string;

  // Callbacks
  onAddUnit: (unit: Unit) => void;
  onRemoveUnit: (unitId: string) => void;
  onViewDetails: (unitId: string) => void;

  // Configuration
  maxUnits?: number; // Default: 10
  enableFilters?: boolean; // Default: true
  viewMode?: "grid" | "list"; // Default: 'grid'

  // State
  isLoading?: boolean;
  error?: string | null;
}

interface FilterState {
  unitType: string;
  maxOccupancy: string;
  maxRate: string;
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
  onViewDetails,
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

  // Filter units based on criteria
  const filteredUnits = useMemo(() => {
    return units.filter((unit) => {
      if (filters.unitType !== "all" && unit.unit_type !== filters.unitType) return false;
      if (filters.maxOccupancy !== "all" && unit.max_occupancy < parseInt(filters.maxOccupancy))
        return false;
      if (filters.maxRate !== "all" && unit.base_rate > parseInt(filters.maxRate)) return false;
      return true;
    });
  }, [units, filters]);

  const canAddMore = selectedUnits.length < maxUnits;
  const isSelected = (unitId: string) => selectedUnits.some((u) => u.unit_id === unitId);

  const hasActiveFilters =
    filters.unitType !== "all" || filters.maxOccupancy !== "all" || filters.maxRate !== "all";

  const clearFilters = () => {
    setFilters({ unitType: "all", maxOccupancy: "all", maxRate: "all" });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Select Units</h2>
          <p className="text-sm text-muted-foreground">
            {selectedUnits.length} of {maxUnits} units selected
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

          {hasActiveFilters && (
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
                <Skeleton className="h-48 w-full mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
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
          role="list"
          aria-label="Available units"
        >
          {filteredUnits.map((unit) => (
            <UnitCard
              key={unit.unit_id}
              unit={unit}
              isSelected={isSelected(unit.unit_id)}
              canSelect={canAddMore || isSelected(unit.unit_id)}
              viewMode={viewMode}
              checkIn={checkIn}
              checkOut={checkOut}
              onAdd={() => onAddUnit(unit)}
              onRemove={() => onRemoveUnit(unit.unit_id)}
              onViewDetails={() => onViewDetails(unit.unit_id)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredUnits.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No units match your filters</p>
          {hasActiveFilters && (
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
  viewMode: "grid" | "list";
  checkIn: string;
  checkOut: string;
  onAdd: () => void;
  onRemove: () => void;
  onViewDetails: () => void;
}

function UnitCard({
  unit,
  isSelected,
  canSelect,
  viewMode,
  checkIn,
  checkOut,
  onAdd,
  onRemove,
  onViewDetails,
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
      aria-label={`${unit.unit_name}, ${unit.unit_type}, ${formatCurrency(unit.base_rate)} per night${isSelected ? ", selected" : ""}`}
      aria-selected={isSelected}
    >
      <CardContent className="p-4">
        {/* Unit Image Placeholder */}
        <div className="relative h-48 bg-muted rounded-md mb-4 flex items-center justify-center">
          <span className="text-muted-foreground text-sm">{unit.unit_type}</span>
          {isSelected && (
            <Badge className="absolute top-2 right-2" aria-label="Unit selected">
              Selected
            </Badge>
          )}
        </div>

        {/* Unit Info */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">{unit.unit_name}</h3>
          <p className="text-sm text-muted-foreground">
            {unit.unit_type} • Max {unit.max_occupancy} guests
          </p>
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
              {new Date(checkIn).toLocaleDateString()} - {new Date(checkOut).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 p-4 pt-0">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetails}
          className="flex-1 h-11"
          aria-label={`View details for ${unit.unit_name}`}
        >
          Details
        </Button>

        {isSelected ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={onRemove}
            className="flex-1 h-11"
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
            className="flex-1 h-11"
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
