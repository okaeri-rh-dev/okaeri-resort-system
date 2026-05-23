import { useMemo } from "react";

import { Link } from "@tanstack/react-router";
import { createColumnHelper, type Header } from "@tanstack/react-table";

import { UNIT_SLOT_MAP } from "@/components/dashboard/unit-calendar-config";
import { formatCurrency, formatPhoneNumber, formatTableDate } from "@/components/tables/formatters";
import { SortableHeader, StatusBadge } from "@/components/tables/utils";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Booking, BookingStatus } from "@/types";

import { BookingActionsCell } from "./BookingActionsCell";

const columnHelper = createColumnHelper<Booking>();

// Type for TanStack Query mutation objects (simplified from UseMutationResult)
interface MutationObject<TVariables = unknown> {
  mutate: (variables: TVariables) => void;
  [key: string]: unknown; // Allow other mutation properties
}

interface UseBookingColumnsProps {
  handleUploadPayment: (booking: Booking) => void;
  updateBookingStatus: MutationObject<{ bookingId: string; status: BookingStatus }>;
  cancelBooking: MutationObject<string>;
  deleteBooking: MutationObject<string>;
}

export const useBookingColumns = ({
  handleUploadPayment,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
}: UseBookingColumnsProps) => {
  return useMemo(
    () => [
      columnHelper.accessor("guest_name", {
        header: ({ header }: { header: Header<Booking, unknown> }) => (
          <SortableHeader header={header}>Guest</SortableHeader>
        ),
        cell: ({ row }) => (
          <div className="space-y-1">
            <Link
              to="/admin/guests"
              search={{ search: row.original.guest_name }}
              className="font-medium text-blue-600 transition-colors hover:underline"
            >
              {row.original.guest_name}
            </Link>
            <div className="text-xs text-neutral-600">
              {(row.original.contact_number && formatPhoneNumber(row.original.contact_number)) ||
                row.original.email ||
                ""}
            </div>
          </div>
        ),
        size: 180,
      }),

      columnHelper.accessor("booking_units", {
        header: "Unit(s)",
        cell: ({ row }) => {
          const units = row.original.booking_units || [];

          if (units.length === 0) {
            return <span className="text-xs text-neutral-400">No units</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {units.map((bu) => {
                const unitCode = bu.unit?.unit_code;
                const slotConfig = unitCode ? UNIT_SLOT_MAP.get(unitCode) : undefined;
                return (
                  <Badge
                    key={bu.booking_unit_id}
                    variant="outline"
                    className={cn(
                      "font-mono text-xs",
                      slotConfig
                        ? cn(slotConfig.bg, slotConfig.text, slotConfig.border)
                        : "bg-secondary text-secondary-foreground border-transparent"
                    )}
                  >
                    {unitCode || bu.unit?.unit_name || `Unit ${bu.unit_id.slice(0, 4)}`}
                  </Badge>
                );
              })}
            </div>
          );
        },
        size: 150,
      }),

      columnHelper.accessor("check_in", {
        header: ({ header }: { header: Header<Booking, unknown> }) => (
          <SortableHeader header={header}>Dates</SortableHeader>
        ),
        cell: ({ getValue, row }) => (
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{formatTableDate(getValue())}</div>
            <div className="text-xs text-neutral-500">
              {formatTableDate(row.original.check_out)}
            </div>
          </div>
        ),
        size: 100,
      }),

      columnHelper.accessor("num_guests", {
        header: "Guests",
        cell: ({ getValue }) => <div className="text-center font-mono text-sm">{getValue()}</div>,
        size: 80,
      }),

      columnHelper.accessor("total_amount", {
        header: ({ header }: { header: Header<Booking, unknown> }) => (
          <SortableHeader header={header} className="text-right">
            Amount
          </SortableHeader>
        ),
        cell: ({ getValue }) => (
          <div className="text-right font-mono font-semibold text-neutral-900">
            {formatCurrency(getValue())}
          </div>
        ),
        size: 120,
      }),

      columnHelper.accessor("is_walk_in", {
        header: "Type",
        cell: ({ getValue }) =>
          getValue() ? (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-semibold text-amber-800"
            >
              Walk-in
            </Badge>
          ) : null,
        size: 90,
      }),

      columnHelper.accessor("booking_status", {
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue() ?? "Pending"} />,
        size: 100,
      }),

      columnHelper.accessor("payment_status", {
        header: "Payment",
        cell: ({ getValue }) => <StatusBadge status={getValue() ?? "Pending"} />,
        size: 100,
      }),

      columnHelper.accessor("booking_reference", {
        header: ({ header }: { header: Header<Booking, unknown> }) => (
          <SortableHeader header={header}>Reference</SortableHeader>
        ),
        cell: ({ row }) => (
          <Link
            to="/admin/bookings/$bookingId"
            params={{ bookingId: row.original.booking_id }}
            className="font-mono text-sm font-medium text-blue-600 transition-colors hover:underline"
          >
            {row.getValue("booking_reference")}
          </Link>
        ),
        size: 120,
      }),

      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          return (
            <BookingActionsCell
              booking={row.original}
              {...{ updateBookingStatus, cancelBooking, deleteBooking, handleUploadPayment }}
            />
          );
        },
        size: 80,
      }),
    ],
    [updateBookingStatus, cancelBooking, deleteBooking, handleUploadPayment]
  );
};
