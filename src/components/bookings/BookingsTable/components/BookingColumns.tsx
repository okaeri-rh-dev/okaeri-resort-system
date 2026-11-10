import { useMemo } from "react";

import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";

import { StatusBadge } from "@/components/patterns";
import { formatCurrency, formatPhoneNumber } from "@/lib/formatters";
import { statusBadgeProps } from "@/lib/status-tone";
import type { Booking, BookingStatus } from "@/types";

import { formatStayRange, getNights } from "../utils/stay";
import { BalanceLabel } from "./BalanceLabel";
import { BookingActionsCell } from "./BookingActionsCell";
import { CabinChip } from "./CabinChip";
import { SourceBadge } from "./SourceBadge";

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
        header: "Guest",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium">{row.original.guest_name}</div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
              <SourceBadge source={row.original.booking_source} />
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
        header: "Stay",
        cell: ({ row }) => {
          const { check_in, check_out, num_guests } = row.original;
          const nights = getNights(check_in, check_out);
          return (
            <div className="space-y-0.5 whitespace-nowrap">
              <div className="text-sm font-medium">{formatStayRange(check_in, check_out)}</div>
              <div className="text-muted-foreground text-xs">
                {nights} {nights === 1 ? "night" : "nights"} · {num_guests}{" "}
                {num_guests === 1 ? "guest" : "guests"}
              </div>
            </div>
          );
        },
        size: 120,
      }),

      columnHelper.accessor("total_amount", {
        header: "Amount",
        cell: ({ getValue, row }) => (
          <div className="space-y-0.5">
            <div className="font-semibold">{formatCurrency(getValue())}</div>
            <BalanceLabel booking={row.original} />
          </div>
        ),
        meta: { align: "right", priority: "low" },
        size: 120,
      }),

      columnHelper.accessor("booking_status", {
        header: "Status",
        cell: ({ getValue }) => (
          <StatusBadge size="compact" {...statusBadgeProps(getValue(), "Pending")} />
        ),
        size: 100,
      }),

      columnHelper.accessor("payment_status", {
        header: "Payment",
        cell: ({ getValue }) => (
          <StatusBadge size="compact" {...statusBadgeProps(getValue(), "Pending")} />
        ),
        meta: { priority: "low" },
        size: 100,
      }),

      columnHelper.accessor("booking_reference", {
        header: "Reference",
        cell: ({ row }) => (
          <Link
            from="/admin/bookings"
            to="."
            search={(prev) => ({ ...prev, booking: row.original.booking_id })}
            className="text-primary text-xs font-medium whitespace-nowrap hover:underline"
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
        size: 180,
      }),
    ],
    [updateBookingStatus, cancelBooking, handleUploadPayment]
  );
};
