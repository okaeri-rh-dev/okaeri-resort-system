import React, { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from "@tanstack/react-table";
import { Edit2, Check, X, Settings, Eye, Download, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  useUnits,
  useUpdateUnit,
  useBatchUpdateUnitsStatus,
  useUnitStore,
} from "../../stores/useUnitStore";

import type { Unit, UnitType, UnitStatus } from "@/types";

import {
  formatCurrency,
  StatusBadge,
  SortableHeader,
  TableSearch,
  FilterPopover,
  TablePagination,
  ActionMenu,
  TableSkeleton,
  TableEmptyState,
  ResponsiveTable,
  MobileCard,
  MobileCardRow,
  exportToCSV,
} from "../tables/utils";

const columnHelper = createColumnHelper<Unit>();

// ============================================
// INLINE EDIT COMPONENTS
// ============================================

interface InlineEditProps {
  value: string | number;
  onSave: (value: string | number) => void;
  type?: "text" | "number";
  placeholder?: string;
  className?: string;
}

const InlineEdit: React.FC<InlineEditProps> = ({
  value,
  onSave,
  type = "text",
  placeholder,
  className,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value.toString());

  const handleSave = () => {
    const newValue = type === "number" ? parseFloat(editValue) : editValue;
    if (newValue !== value) {
      onSave(newValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value.toString());
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center space-x-1">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          type={type}
          className={cn("h-8 text-xs", className)}
          autoFocus
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex cursor-pointer items-center space-x-1 rounded px-1 py-1 hover:bg-neutral-100",
        className
      )}
      onClick={() => setIsEditing(true)}
    >
      <span className={type === "number" ? "font-mono" : undefined}>
        {type === "number" && typeof value === "number" ? formatCurrency(value) : value}
      </span>
      <Edit2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-50" />
    </div>
  );
};

// ============================================
// MOBILE CARD COMPONENT
// ============================================

interface UnitCardProps {
  unit: Unit;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onView: () => void;
  onEdit: () => void;
  onUpdateRate: (field: "base_rate" | "weekend_rate", value: number) => void;
}

const UnitCard: React.FC<UnitCardProps> = ({
  unit,
  isSelected,
  onSelect,
  onView,
  onEdit,
  onUpdateRate,
}) => {
  return (
    <MobileCard className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          <Checkbox checked={isSelected} onCheckedChange={onSelect} />
          <div className="space-y-1">
            <div className="font-mono text-sm font-medium text-blue-600">{unit.unit_code}</div>
            <div className="font-medium text-neutral-900">{unit.unit_name}</div>
          </div>
        </div>
        <StatusBadge status={unit.unit_status} />
      </div>

      <div className="space-y-2">
        <MobileCardRow label="Type" value={unit.unit_type} />
        <MobileCardRow label="Capacity" value={`${unit.max_occupancy} guests`} />
        <MobileCardRow
          label="Base Rate"
          value={
            <InlineEdit
              value={unit.base_rate}
              onSave={(value) => onUpdateRate("base_rate", value as number)}
              type="number"
              className="w-20"
            />
          }
        />
        <MobileCardRow
          label="Weekend Rate"
          value={
            <InlineEdit
              value={unit.weekend_rate}
              onSave={(value) => onUpdateRate("weekend_rate", value as number)}
              type="number"
              className="w-20"
            />
          }
        />
        <MobileCardRow label="Amenities" value={`${unit.amenities?.length ?? 0} items`} />
      </div>

      <div className="flex space-x-2 border-t border-neutral-100 pt-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          <Eye className="mr-1 h-3 w-3" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
          <Settings className="mr-1 h-3 w-3" />
          Manage
        </Button>
      </div>
    </MobileCard>
  );
};

// ============================================
// MAIN UNITS TABLE COMPONENT
// ============================================

interface UnitsTableProps {
  onViewUnit?: (unit: Unit) => void;
  onEditUnit?: (unit: Unit) => void;
  className?: string;
}

export const UnitsTable: React.FC<UnitsTableProps> = ({ onViewUnit, onEditUnit, className }) => {
  // Store state
  const { filters, setFilters, resetFilters, viewMode, setViewMode } = useUnitStore();

  // Local state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Mutations
  const updateUnit = useUpdateUnit();
  const batchUpdateStatus = useBatchUpdateUnitsStatus();

  // Data
  const { data: units = [], isLoading, error } = useUnits();

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Filter units based on search query
  const filteredUnits = useMemo(() => {
    if (!searchQuery) return units;
    const query = searchQuery.toLowerCase();
    return units.filter(
      (unit) =>
        unit.unit_name.toLowerCase().includes(query) ||
        unit.unit_code.toLowerCase().includes(query) ||
        unit.unit_type.toLowerCase().includes(query)
    );
  }, [units, searchQuery]);

  // Handle inline rate updates
  const handleRateUpdate = (unitId: string, field: "base_rate" | "weekend_rate", value: number) => {
    updateUnit.mutate({
      unitId,
      updates: { [field]: value },
    });
  };

  // Handle bulk status updates
  const handleBulkStatusUpdate = (status: UnitStatus) => {
    const selectedUnitIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
    if (selectedUnitIds.length > 0) {
      batchUpdateStatus.mutate({
        unitIds: selectedUnitIds,
        status,
      });
      setRowSelection({});
    }
  };

  // Export data
  const handleExport = () => {
    const exportData = filteredUnits.map((unit) => ({
      code: unit.unit_code,
      name: unit.unit_name,
      type: unit.unit_type,
      capacity: unit.max_occupancy,
      base_rate: unit.base_rate,
      weekend_rate: unit.weekend_rate,
      status: unit.unit_status,
      amenities: (unit.amenities ?? []).join("; "),
    }));

    exportToCSV(exportData, "units", [
      "Code",
      "Name",
      "Type",
      "Capacity",
      "Base Rate",
      "Weekend Rate",
      "Status",
      "Amenities",
    ]);
  };

  // Define columns
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        ),
        size: 50,
      }),

      columnHelper.accessor("unit_code", {
        header: ({ header }) => <SortableHeader header={header}>Code</SortableHeader>,
        cell: ({ getValue }) => (
          <div className="font-mono text-sm font-medium text-blue-600">{getValue()}</div>
        ),
        size: 100,
      }),

      columnHelper.accessor("unit_name", {
        header: ({ header }) => <SortableHeader header={header}>Name</SortableHeader>,
        cell: ({ getValue, row }) => (
          <div className="space-y-1">
            <div className="font-medium text-neutral-900">{getValue()}</div>
            <div className="text-xs text-neutral-600">{row.original.unit_type}</div>
          </div>
        ),
        size: 200,
      }),

      columnHelper.accessor("max_occupancy", {
        header: "Capacity",
        cell: ({ getValue }) => (
          <div className="text-center font-mono text-sm">{getValue()} guests</div>
        ),
        size: 100,
      }),

      columnHelper.accessor("base_rate", {
        header: ({ header }) => (
          <SortableHeader header={header} className="text-right">
            Base Rate
          </SortableHeader>
        ),
        cell: ({ getValue, row }) => (
          <div className="text-right">
            <InlineEdit
              value={getValue()}
              onSave={(value) =>
                handleRateUpdate(row.original.unit_id, "base_rate", value as number)
              }
              type="number"
              className="w-24"
            />
          </div>
        ),
        size: 120,
      }),

      columnHelper.accessor("weekend_rate", {
        header: ({ header }) => (
          <SortableHeader header={header} className="text-right">
            Weekend Rate
          </SortableHeader>
        ),
        cell: ({ getValue, row }) => (
          <div className="text-right">
            <InlineEdit
              value={getValue()}
              onSave={(value) =>
                handleRateUpdate(row.original.unit_id, "weekend_rate", value as number)
              }
              type="number"
              className="w-24"
            />
          </div>
        ),
        size: 120,
      }),

      columnHelper.accessor("unit_status", {
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue()} />,
        size: 100,
      }),

      columnHelper.accessor("amenities", {
        header: "Amenities",
        cell: ({ getValue }) => (
          <div className="text-sm text-neutral-600">{(getValue() ?? []).length} items</div>
        ),
        size: 100,
      }),

      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const unit = row.original;

          const actions = [
            {
              label: "View Details",
              onClick: () => onViewUnit?.(unit),
            },
            {
              label: "Manage Unit",
              onClick: () => onEditUnit?.(unit),
            },
            {
              label: "Mark Available",
              onClick: () => handleRateUpdate(unit.unit_id, "base_rate", unit.base_rate),
              disabled: unit.unit_status === "Available",
            },
            {
              label: "Mark Maintenance",
              onClick: () =>
                updateUnit.mutate({
                  unitId: unit.unit_id,
                  updates: { unit_status: "Maintenance" },
                }),
              disabled: unit.unit_status === "Maintenance",
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [onViewUnit, onEditUnit, updateUnit]
  );

  // Create table instance
  const table = useReactTable({
    data: filteredUnits,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: true,
  });

  // Get selected count
  const selectedCount = Object.values(rowSelection).filter(Boolean).length;

  // Loading state
  if (isLoading) {
    return <TableSkeleton rows={6} columns={8} />;
  }

  // Error state
  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">Error loading units: {error.message}</div>
      </Card>
    );
  }

  // Mobile view
  if (isMobile || viewMode === "grid") {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile filters */}
        <div className="space-y-3">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search units..."
            className="w-full"
          />

          <div className="flex space-x-2">
            <Select
              value={filters.status || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  status: value === "all" ? undefined : (value as UnitStatus),
                })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Occupied">Occupied</SelectItem>
                <SelectItem value="Maintenance">Maintenance</SelectItem>
                <SelectItem value="Reserved">Reserved</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.type || "all"}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  type: value === "all" ? undefined : (value as UnitType),
                })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Studio">Studio</SelectItem>
                <SelectItem value="One Bedroom">One Bedroom</SelectItem>
                <SelectItem value="Two Bedroom">Two Bedroom</SelectItem>
                <SelectItem value="Villa">Villa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              >
                {viewMode === "grid" ? "List View" : "Grid View"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetFilters();
                  setSearchQuery("");
                }}
                disabled={!Object.keys(filters).length && !searchQuery}
              >
                Clear Filters
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-3 w-3" />
              Export
            </Button>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3">
          {table.getRowModel().rows.length === 0 ? (
            <TableEmptyState
              title="No units found"
              description="No units match your current filters."
              action={{
                label: "Clear Filters",
                onClick: () => {
                  resetFilters();
                  setSearchQuery("");
                },
              }}
            />
          ) : (
            table
              .getRowModel()
              .rows.map((row) => (
                <UnitCard
                  key={row.id}
                  unit={row.original}
                  isSelected={row.getIsSelected()}
                  onSelect={(checked) => row.toggleSelected(checked)}
                  onView={() => onViewUnit?.(row.original)}
                  onEdit={() => onEditUnit?.(row.original)}
                  onUpdateRate={(field, value) =>
                    handleRateUpdate(row.original.unit_id, field, value)
                  }
                />
              ))
          )}
        </div>

        {/* Mobile pagination */}
        <TablePagination table={table} totalItems={filteredUnits.length} />
      </div>
    );
  }

  // Desktop view
  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <TableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search units..."
          />

          <FilterPopover
            isActive={!!filters.status}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Unit Status</div>
                <Select
                  value={filters.status || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      status: value === "all" ? undefined : (value as UnitStatus),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Available">Available</SelectItem>
                    <SelectItem value="Occupied">Occupied</SelectItem>
                    <SelectItem value="Maintenance">Maintenance</SelectItem>
                    <SelectItem value="Reserved">Reserved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            Status
          </FilterPopover>

          <FilterPopover
            isActive={!!filters.type}
            content={
              <div className="space-y-2">
                <div className="text-sm font-medium">Unit Type</div>
                <Select
                  value={filters.type || "all"}
                  onValueChange={(value) =>
                    setFilters({
                      ...filters,
                      type: value === "all" ? undefined : (value as UnitType),
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Studio">Studio</SelectItem>
                    <SelectItem value="One Bedroom">One Bedroom</SelectItem>
                    <SelectItem value="Two Bedroom">Two Bedroom</SelectItem>
                    <SelectItem value="Villa">Villa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            }
          >
            Type
          </FilterPopover>

          {(Object.keys(filters).length > 0 || searchQuery) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetFilters();
                setSearchQuery("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {selectedCount > 0 && (
            <>
              <span className="text-sm text-neutral-600">{selectedCount} selected</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkStatusUpdate("Maintenance")}
              >
                <Wrench className="mr-1 h-3 w-3" />
                Mark Maintenance
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode((viewMode as string) === "grid" ? "list" : "grid")}
          >
            {(viewMode as string) === "grid" ? "List View" : "Grid View"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3 w-3" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Desktop table */}
      <ResponsiveTable>
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-4 py-3 text-left text-xs font-medium tracking-wide text-neutral-700 uppercase"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  "h-10 border-b border-neutral-100 hover:bg-neutral-50",
                  index % 2 === 0 && "bg-neutral-25",
                  row.getIsSelected() && "bg-blue-50"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 text-sm text-neutral-900">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 && (
          <div className="p-8">
            <TableEmptyState
              title="No units found"
              description="No units match your current filters."
              action={{
                label: "Clear Filters",
                onClick: () => {
                  resetFilters();
                  setSearchQuery("");
                },
              }}
            />
          </div>
        )}
      </ResponsiveTable>

      {/* Desktop pagination */}
      <TablePagination table={table} totalItems={filteredUnits.length} />
    </div>
  );
};
