import { Download, Plus, Settings, Eye, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Table } from "@tanstack/react-table";
import type { Unit, UnitStatus } from "@/types";

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
  onBatchStatusUpdate?: (status: UnitStatus) => void;
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
  onBatchStatusUpdate,
}: TableHeaderProps) {
  const unitTypes: Array<{ value: string; label: string }> = [
    { value: "all", label: "All Types" },
    { value: "Standard", label: "Standard" },
    { value: "Deluxe", label: "Deluxe" },
    { value: "Suite", label: "Suite" },
    { value: "Villa", label: "Villa" },
  ];

  const unitStatuses: Array<{ value: string; label: string }> = [
    { value: "all", label: "All Statuses" },
    { value: "Available", label: "Available" },
    { value: "Occupied", label: "Occupied" },
    { value: "Maintenance", label: "Maintenance" },
    { value: "Reserved", label: "Reserved" },
  ];

  return (
    <div className="space-y-4 mb-4">
      {/* Main actions row */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1 flex flex-col sm:flex-row gap-2">
          {/* Search input */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search units..."
              value={globalFilter}
              onChange={(e) => onGlobalFilterChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
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

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              {unitStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {/* Column visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
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
            <Settings className="h-4 w-4 mr-2" />
            {isEditMode ? "Done" : "Edit"}
          </Button>

          {/* Export button */}
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>

          {/* Add new button */}
          {onAddNew && (
            <Button size="sm" onClick={onAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          )}
        </div>
      </div>

      {/* Batch actions row - shown when items are selected */}
      {selectedCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50 rounded-lg p-3">
          <span className="text-sm text-blue-700">
            {selectedCount} unit{selectedCount > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            {onBatchStatusUpdate && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBatchStatusUpdate("Available")}
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  Mark Available
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBatchStatusUpdate("Maintenance")}
                  className="text-orange-600 border-orange-600 hover:bg-orange-50"
                >
                  Mark Maintenance
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onBatchStatusUpdate("Reserved")}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Mark Reserved
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => table.toggleAllRowsSelected(false)}
              className="text-gray-600"
            >
              Clear Selection
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
