import { useMemo } from "react";

import { Link } from "@tanstack/react-router";
import { createColumnHelper, type Header } from "@tanstack/react-table";

import { ActionMenu, Checkbox, SortableHeader, StatusBadge } from "@/components/patterns";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Unit, UnitStatus } from "@/types";

import { InlineEdit, InlineSelect } from "./InlineEdit";

const columnHelper = createColumnHelper<Unit>();

interface UseUnitColumnsProps {
  onUpdateUnit: (unitId: string, updates: Partial<Unit>) => void;
  isEditMode: boolean;
  onViewUnit?: (unit: Unit) => void;
  onEditUnit?: (unit: Unit) => void;
  onDeleteUnit?: (unit: Unit) => void;
}

/**
 * Custom hook for unit table column definitions
 * Handles column configuration and inline editing
 */
export function useUnitColumns({
  onUpdateUnit,
  isEditMode,
  onViewUnit,
  onEditUnit,
  onDeleteUnit,
}: UseUnitColumnsProps) {
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
        header: ({ header }: { header: Header<Unit, unknown> }) => (
          <SortableHeader header={header}>Code</SortableHeader>
        ),
        cell: ({ getValue }) => (
          <div className="text-sm font-medium tabular-nums">{getValue()}</div>
        ),
        size: 100,
      }),

      // Unit name column with inline editing
      columnHelper.accessor("unit_name", {
        header: ({ header }: { header: Header<Unit, unknown> }) => (
          <SortableHeader header={header}>Name</SortableHeader>
        ),
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
          return (
            <Link
              to="/admin/units/$unitId"
              params={{ unitId: row.original.unit_id }}
              className="text-primary font-medium hover:underline"
              preload="intent"
            >
              {getValue()}
            </Link>
          );
        },
        size: 200,
      }),

      // Capacity column
      columnHelper.accessor("max_occupancy", {
        header: "Capacity",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.base_occupancy}/{row.original.max_occupancy} guests
          </span>
        ),
        meta: { align: "right" },
        size: 120,
      }),

      // Pricing columns removed - now managed globally via Settings > Pricing Configuration

      // // Unit type column with inline editing
      // columnHelper.accessor("unit_type", {
      //   header: "Type",
      //   cell: ({ getValue, row }) => {
      //     const unitTypes: Array<{ value: UnitType; label: string }> = [
      //       { value: "Standard", label: "Standard" },
      //       { value: "Deluxe", label: "Deluxe" },
      //       { value: "Suite", label: "Suite" },
      //       { value: "Villa", label: "Villa" },
      //     ];

      //     if (isEditMode) {
      //       return (
      //         <InlineSelect
      //           value={getValue()}
      //           options={unitTypes}
      //           onSave={(value) => onUpdateUnit(row.original.unit_id, { unit_type: value })}
      //         />
      //       );
      //     }

      //     const typeLabel = unitTypes.find((t) => t.value === getValue())?.label;
      //     return (
      //       <div className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
      //         {typeLabel || getValue()}
      //       </div>
      //     );
      //   },
      //   size: 120,
      // }),

      // Status column with inline editing
      columnHelper.accessor("unit_status", {
        header: ({ header }: { header: Header<Unit, unknown> }) => (
          <SortableHeader header={header}>Status</SortableHeader>
        ),
        cell: ({ getValue, row }) => {
          const statusOptions: Array<{ value: UnitStatus; label: string }> = [
            { value: "Available", label: "Available" },
            { value: "Occupied", label: "Occupied" },
            { value: "Maintenance", label: "Maintenance" },
            { value: "Reserved", label: "Reserved" },
          ];

          if (isEditMode) {
            return (
              <InlineSelect
                value={getValue() ?? "Available"}
                options={statusOptions}
                onSave={(value) => onUpdateUnit(row.original.unit_id, { unit_status: value })}
              />
            );
          }
          return <StatusBadge {...statusBadgeProps(getValue(), "Available")} />;
        },
        size: 120,
      }),

      // Actions column
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
              label: "Edit Unit",
              onClick: () => onEditUnit?.(unit),
            },
            {
              label: "Delete",
              onClick: () => onDeleteUnit?.(unit),
              variant: "destructive" as const,
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        meta: { pinned: true },
        size: 80,
      }),
    ],
    [isEditMode, onUpdateUnit, onViewUnit, onEditUnit, onDeleteUnit]
  );
}
