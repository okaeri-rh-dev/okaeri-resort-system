import type { Table } from "@tanstack/react-table";
import { Download, Eye, Filter, Plus, Settings } from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TableSearch,
} from "@/components/patterns";
import { pluralize } from "@/lib/formatters";
import type { Unit } from "@/types";

interface TableHeaderProps {
  table: Table<Unit>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  isEditMode: boolean;
  onEditModeToggle: () => void;
  onExport: () => void;
  onAddNew?: () => void;
  selectedCount: number;
}

/**
 * Table header component with search, filters, and actions
 */
export function TableHeader({
  table,
  globalFilter,
  onGlobalFilterChange,
  typeFilter,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  isEditMode,
  onEditModeToggle,
  onExport,
  onAddNew,
  selectedCount,
}: TableHeaderProps) {
  const unitTypes: Array<{ value: string; label: string }> = [
    { value: "all", label: "All Types" },
    { value: "Standard", label: "Standard" },
    { value: "Deluxe", label: "Deluxe" },
    { value: "Suite", label: "Suite" },
    { value: "Villa", label: "Villa" },
  ];

  const cabinStates: Array<{ value: string; label: string }> = [
    { value: "all", label: "All tonight" },
    { value: "Blocked", label: "Blocked" },
    { value: "Booked", label: "Booked" },
    { value: "Free", label: "Free" },
  ];

  return (
    <div className="@container mb-4 space-y-4">
      {/* Main actions row */}
      <div className="flex flex-col justify-between gap-4 @3xl:flex-row">
        <div className="flex flex-1 flex-col gap-2 @lg:flex-row">
          <TableSearch
            value={globalFilter}
            onChange={onGlobalFilterChange}
            placeholder="Search cabins..."
            aria-label="Search cabins"
            className="max-w-sm flex-1"
          />

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-full @lg:w-40" aria-label="Filter by type">
              <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              {unitTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Tonight filter */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full @lg:w-40" aria-label="Filter by tonight">
              <Filter className="mr-2 h-4 w-4" aria-hidden="true" />
              <SelectValue placeholder="Filter by tonight" />
            </SelectTrigger>
            <SelectContent>
              {cabinStates.map((cabinState) => (
                <SelectItem key={cabinState.value} value={cabinState.value}>
                  {cabinState.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Edit mode toggle */}
          <Button variant={isEditMode ? "default" : "outline"} size="sm" onClick={onEditModeToggle}>
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            {isEditMode ? "Done" : "Edit"}
          </Button>

          {/* Export button */}
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="mr-2 h-4 w-4" aria-hidden="true" />
            Export
          </Button>

          {/* Add new button */}
          {onAddNew && (
            <Button size="sm" onClick={onAddNew}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Add Cabin
            </Button>
          )}
        </div>
      </div>

      {/* Batch actions row - shown when items are selected */}
      {selectedCount > 0 && (
        <div className="bg-card flex flex-col gap-2 rounded-lg border p-3 @lg:flex-row @lg:items-center @lg:justify-between">
          <span className="text-sm font-medium" role="status">
            {selectedCount} {pluralize(selectedCount, "cabin")} selected
          </span>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" onClick={() => table.toggleAllRowsSelected(false)}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
