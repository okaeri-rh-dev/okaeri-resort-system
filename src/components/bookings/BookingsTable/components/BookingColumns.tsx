import { useMemo } from "react";

import { Link } from "@tanstack/react-router";
import { createColumnHelper, type Header } from "@tanstack/react-table";

import { SortableHeader, StatusBadge } from "@/components/patterns";
import { formatCurrency, formatPhoneNumber, formatTableDate } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking, BookingStatus } from "@/types";

import { BookingActionsCell } from "./BookingActionsCell";
import { CabinChip } from "./CabinChip";

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
}

export const useBookingColumns = ({
  handleUploadPayment,
  updateBookingStatus,
  cancelBooking,
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
              className="text-primary font-medium hover:underline"
            >
              {row.original.guest_name}
            </Link>
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              {row.original.is_walk_in && <StatusBadge tone="warning">Walk-in</StatusBadge>}
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
            return <span className="text-muted-foreground text-xs">No units</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {units.map((bu) => (
                <CabinChip key={bu.booking_unit_id} bookingUnit={bu} />
              ))}
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
            <div className="text-muted-foreground text-xs">
              {formatTableDate(row.original.check_out)}
            </div>
          </div>
        ),
        size: 100,
      }),

      columnHelper.accessor("num_guests", {
        header: "Guests",
        cell: ({ getValue }) => getValue(),
        meta: { align: "center" },
        size: 80,
      }),

      columnHelper.accessor("total_amount", {
        header: ({ header }: { header: Header<Booking, unknown> }) => (
          <SortableHeader header={header} className="text-right">
            Amount
          </SortableHeader>
        ),
        cell: ({ getValue }) => <span className="font-semibold">{formatCurrency(getValue())}</span>,
        meta: { align: "right" },
        size: 120,
      }),

      columnHelper.accessor("booking_status", {
        header: "Status",
        cell: ({ getValue }) => <StatusBadge {...statusBadgeProps(getValue(), "Pending")} />,
        size: 100,
      }),

      columnHelper.accessor("payment_status", {
        header: "Payment",
        cell: ({ getValue }) => <StatusBadge {...statusBadgeProps(getValue(), "Pending")} />,
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
            className="text-primary text-sm font-medium whitespace-nowrap hover:underline"
          >
            {row.getValue("booking_reference")}
          </Link>
        ),
        size: 120,
      }),

      columnHelper.display({
        id: "actions",
        meta: { pinned: true },
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => {
          return (
            <BookingActionsCell
              booking={row.original}
              {...{ updateBookingStatus, cancelBooking, handleUploadPayment }}
            />
          );
        },
        size: 80,
      }),
    ],
    [updateBookingStatus, cancelBooking, handleUploadPayment]
  );
};
