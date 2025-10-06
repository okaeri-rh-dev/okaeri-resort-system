import {
  ActionMenu,
  formatCurrency,
  formatPhoneNumber,
  formatTableDate,
  SortableHeader,
  StatusBadge,
} from "@/components/tables/utils";
import type { Booking, BookingStatus } from "@/types";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

const columnHelper = createColumnHelper<Booking>();

interface UseBookingColumnsProps {
  onViewBooking?: (booking: Booking) => void;
  onEditBooking?: (booking: Booking) => void;
  handleUploadPayment: (booking: Booking) => void;
  updateBookingStatus: any;
  cancelBooking: any;
  deleteBooking: any;
}

export const useBookingColumns = ({
  onViewBooking,
  onEditBooking,
  handleUploadPayment,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
}: UseBookingColumnsProps) => {
  return useMemo(
    () => [
      columnHelper.accessor("guest_name", {
        header: ({ header }) => <SortableHeader header={header}>Guest</SortableHeader>,
        cell: ({ row }) => (
          <div className="space-y-1">
            <div className="font-medium text-neutral-900">{row.original.guest_name}</div>
            <div className="text-xs text-neutral-600">
              {formatPhoneNumber(row.original.contact_number) || row.original.email}
            </div>
          </div>
        ),
        size: 180,
      }),

      columnHelper.accessor("unit.unit_name", {
        header: "Unit",
        cell: ({ getValue }) => <div className="font-medium">{getValue() || "N/A"}</div>,
        size: 120,
      }),

      columnHelper.accessor("check_in", {
        header: ({ header }) => <SortableHeader header={header}>Dates</SortableHeader>,
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
        header: ({ header }) => (
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
        header: ({ header }) => <SortableHeader header={header}>Reference</SortableHeader>,
        cell: ({ getValue }) => (
          <div className="font-mono text-sm font-medium text-blue-600">{getValue()}</div>
        ),
        size: 120,
      }),

      columnHelper.display({
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const booking = row.original;

          const actions = [
            {
              label: "View Details",
              onClick: () => onViewBooking?.(booking),
            },
            {
              label: "Edit Booking",
              onClick: () => onEditBooking?.(booking),
            },
            ...(booking.payment_status !== "Completed"
              ? [
                  {
                    label: "Upload Payment",
                    onClick: () => handleUploadPayment(booking),
                  },
                ]
              : []),
            ...(booking.booking_status === "Pending"
              ? [
                  {
                    label: "Confirm",
                    onClick: () =>
                      updateBookingStatus.mutate({
                        bookingId: booking.booking_id,
                        status: "Confirmed" as BookingStatus,
                      }),
                  },
                ]
              : []),
            ...(booking.booking_status !== "Cancelled"
              ? [
                  {
                    label: "Cancel",
                    onClick: () => cancelBooking.mutate(booking.booking_id),
                    variant: "destructive" as const,
                  },
                ]
              : []),
            {
              label: "Delete",
              onClick: () => {
                if (
                  confirm(
                    `Are you sure you want to permanently delete booking "${booking.booking_reference}"? This action cannot be undone.`
                  )
                ) {
                  deleteBooking.mutate(booking.booking_id);
                }
              },
              className: "text-red-600 hover:text-red-700",
            },
          ];

          return <ActionMenu actions={actions} />;
        },
        size: 80,
      }),
    ],
    [
      onViewBooking,
      onEditBooking,
      updateBookingStatus,
      cancelBooking,
      deleteBooking,
      handleUploadPayment,
    ]
  );
};
