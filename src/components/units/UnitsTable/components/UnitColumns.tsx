import { useMemo } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import type { Unit, UnitType, UnitStatus } from "@/types";
import { formatCurrency, StatusBadge, SortableHeader } from "@/components/tables/utils";
import { InlineEdit, InlineSelect } from "./InlineEdit";

const columnHelper = createColumnHelper<Unit>();

interface UseUnitColumnsProps {
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => void;
  isEditMode: boolean;
}

/**
 * Custom hook for unit table column definitions
 * Handles column configuration and inline editing
 */
export function useUnitColumns({ onUpdateUnit, isEditMode }: UseUnitColumnsProps) {
  return useMemo(
    () => [
      // Selection column
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

      // Unit code column
      columnHelper.accessor("unit_code", {
        header: ({ header }) => <SortableHeader header={header}>Code</SortableHeader>,
        cell: ({ getValue }) => (
          <div className="font-mono text-sm font-medium text-blue-600">{getValue()}</div>
        ),
        size: 100,
      }),

      // Unit name column with inline editing
      columnHelper.accessor("unit_name", {
        header: ({ header }) => <SortableHeader header={header}>Name</SortableHeader>,
        cell: ({ getValue, row }) => {
          if (isEditMode) {
            return (
              <InlineEdit
                value={getValue()}
                onSave={(value) =>
                  onUpdateUnit(row.original.unit_id, { unit_name: value as string })
                }
                type="text"
                placeholder="Enter unit name"
              />
            );
          }
          return <div className="font-medium text-neutral-900">{getValue()}</div>;
        },
        size: 200,
      }),

      // Capacity column
      columnHelper.accessor("max_occupancy", {
        header: "Capacity",
        cell: ({ row }) => (
          <div className="text-center font-mono text-sm">
            {row.original.base_occupancy}/{row.original.max_occupancy} guests
          </div>
        ),
        size: 120,
      }),

      // Base rate column with inline editing
      columnHelper.accessor("base_rate", {
        header: ({ header }) => <SortableHeader header={header}>Base Rate</SortableHeader>,
        cell: ({ getValue, row }) => {
          if (isEditMode) {
            return (
              <InlineEdit
                value={getValue()}
                onSave={(value) =>
                  onUpdateUnit(row.original.unit_id, { base_rate: value as number })
                }
                type="number"
                placeholder="0.00"
                className="text-right"
              />
            );
          }
          return (
            <div className="text-right font-mono text-sm text-green-600">
              {formatCurrency(getValue())}
            </div>
          );
        },
        size: 120,
      }),

      // Extra person rate column with inline editing
      columnHelper.accessor("extra_person_rate", {
        header: "Extra Person",
        cell: ({ getValue, row }) => {
          const value = getValue() || 0;
          if (isEditMode) {
            return (
              <InlineEdit
                value={value}
                onSave={(value) =>
                  onUpdateUnit(row.original.unit_id, { extra_person_rate: value as number })
                }
                type="number"
                placeholder="0.00"
                className="text-right"
              />
            );
          }
          return (
            <div className="text-right font-mono text-sm text-orange-600">
              {formatCurrency(value)}
            </div>
          );
        },
        size: 120,
      }),

      // Unit type column with inline editing
      columnHelper.accessor("unit_type", {
        header: "Type",
        cell: ({ getValue, row }) => {
          const unitTypes: Array<{ value: UnitType; label: string }> = [
            { value: "studio", label: "Studio" },
            { value: "1br", label: "1 Bedroom" },
            { value: "2br", label: "2 Bedrooms" },
            { value: "suite", label: "Suite" },
            { value: "villa", label: "Villa" },
          ];

          if (isEditMode) {
            return (
              <InlineSelect
                value={getValue()}
                options={unitTypes}
                onSave={(value) => onUpdateUnit(row.original.unit_id, { unit_type: value })}
              />
            );
          }

          const typeLabel = unitTypes.find((t) => t.value === getValue())?.label;
          return (
            <div className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
              {typeLabel || getValue()}
            </div>
          );
        },
        size: 120,
      }),

      // Status column with inline editing
      columnHelper.accessor("unit_status", {
        header: ({ header }) => <SortableHeader header={header}>Status</SortableHeader>,
        cell: ({ getValue, row }) => {
          const statusOptions: Array<{ value: UnitStatus; label: string }> = [
            { value: "available", label: "Available" },
            { value: "occupied", label: "Occupied" },
            { value: "maintenance", label: "Maintenance" },
            { value: "reserved", label: "Reserved" },
          ];

          if (isEditMode) {
            return (
              <InlineSelect
                value={getValue()}
                options={statusOptions}
                onSave={(value) => onUpdateUnit(row.original.unit_id, { unit_status: value })}
              />
            );
          }
          return <StatusBadge status={getValue()} />;
        },
        size: 120,
      }),
    ],
    [isEditMode, onUpdateUnit]
  );
}
