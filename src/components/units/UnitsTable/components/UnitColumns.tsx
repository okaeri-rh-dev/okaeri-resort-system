import { useMemo } from "react";

import { Link } from "@tanstack/react-router";
import { createColumnHelper, type Header } from "@tanstack/react-table";

import { ActionMenu, Checkbox, SortableHeader, StatusBadge } from "@/components/patterns";
import { statusBadgeProps } from "@/lib/status-tone";
import type { CabinNight, Unit } from "@/types";

import { InlineEdit } from "./InlineEdit";

const columnHelper = createColumnHelper<Unit>();

interface UseUnitColumnsProps {
  cabinStates: Map<string, CabinNight> | undefined;
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
  cabinStates,
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

      // Derived from blocks and bookings, so it is never edited here (ADR 0005)
      columnHelper.accessor((unit) => cabinStates?.get(unit.unit_id)?.state ?? "", {
        id: "tonight",
        header: ({ header }: { header: Header<Unit, unknown> }) => (
          <SortableHeader header={header}>Tonight</SortableHeader>
        ),
        cell: ({ row }) => {
          const cabinNight = cabinStates?.get(row.original.unit_id);
          if (!cabinNight) return null;
          return (
            <div className="space-y-1">
              <StatusBadge {...statusBadgeProps(cabinNight.state, "Free")} />
              {cabinNight.blockReason && (
                <p className="text-muted-foreground text-xs">{cabinNight.blockReason}</p>
              )}
            </div>
          );
        },
        size: 160,
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
    [cabinStates, isEditMode, onUpdateUnit, onViewUnit, onEditUnit, onDeleteUnit]
  );
}
