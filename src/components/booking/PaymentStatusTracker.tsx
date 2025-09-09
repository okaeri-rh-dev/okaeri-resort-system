/**
 * Payment Status Tracker Component
 *
 * Professional Enterprise Design System component for tracking payment status.
 * Display-only component for staff to monitor payment states without processing.
 * Dense tabular layout optimized for scanning multiple bookings efficiently.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, SearchInput } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Enterprise payment status definitions
const PAYMENT_STATUSES = {
  PENDING: "pending",
  PARTIAL: "partial",
  COMPLETED: "completed",
  OVERDUE: "overdue",
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
} as const;

type PaymentStatus = (typeof PAYMENT_STATUSES)[keyof typeof PAYMENT_STATUSES];

interface PaymentRecord {
  id: string;
  bookingCode: string;
  guestName: string;
  roomNumber: string;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  lastPaymentDate?: Date;
  dueDate?: Date;
  notes?: string;
}

interface PaymentStatusTrackerProps {
  /** Payment records to display */
  payments: PaymentRecord[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when payment record is selected for details */
  onPaymentSelect?: (paymentId: string) => void;
  /** Callback when payment status needs to be updated */
  onStatusUpdate?: (paymentId: string, newStatus: PaymentStatus) => void;
  /** Show status update actions */
  allowStatusUpdates?: boolean;
}

// Enterprise status styling with professional color scheme
const getPaymentStatusConfig = (status: PaymentStatus) => {
  switch (status) {
    case PAYMENT_STATUSES.PENDING:
      return {
        variant: "outline" as const,
        className: "border-neutral-300 text-neutral-700 bg-neutral-50",
        label: "Pending",
        priority: 2,
      };
    case PAYMENT_STATUSES.PARTIAL:
      return {
        variant: "secondary" as const,
        className: "border-yellow-300 text-yellow-800 bg-yellow-50",
        label: "Partial",
        priority: 3,
      };
    case PAYMENT_STATUSES.COMPLETED:
      return {
        variant: "default" as const,
        className: "border-green-300 text-green-800 bg-green-50",
        label: "Paid",
        priority: 1,
      };
    case PAYMENT_STATUSES.OVERDUE:
      return {
        variant: "destructive" as const,
        className: "border-red-300 text-red-800 bg-red-50",
        label: "Overdue",
        priority: 4,
      };
    case PAYMENT_STATUSES.REFUNDED:
      return {
        variant: "outline" as const,
        className: "border-blue-300 text-blue-800 bg-blue-50",
        label: "Refunded",
        priority: 1,
      };
    case PAYMENT_STATUSES.CANCELLED:
      return {
        variant: "outline" as const,
        className: "border-neutral-400 text-neutral-600 bg-neutral-100",
        label: "Cancelled",
        priority: 1,
      };
    default:
      return {
        variant: "outline" as const,
        className: "border-neutral-300 text-neutral-700 bg-neutral-50",
        label: "Unknown",
        priority: 5,
      };
  }
};

export const PaymentStatusTracker: React.FC<PaymentStatusTrackerProps> = ({
  payments,
  isLoading = false,
  onPaymentSelect,
  onStatusUpdate,
  allowStatusUpdates = false,
}) => {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<PaymentStatus | "all">("all");
  const [sortBy, setSortBy] = React.useState<"priority" | "amount" | "date">("priority");

  // Filter and sort payments
  const filteredPayments = React.useMemo(() => {
    let filtered = payments.filter((payment) => {
      const matchesSearch =
        payment.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.bookingCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.roomNumber.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || payment.paymentStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort by priority, amount, or date
    filtered.sort((a, b) => {
      if (sortBy === "priority") {
        const priorityA = getPaymentStatusConfig(a.paymentStatus).priority;
        const priorityB = getPaymentStatusConfig(b.paymentStatus).priority;
        return priorityB - priorityA; // Higher priority first
      } else if (sortBy === "amount") {
        const balanceA = a.totalAmount - a.paidAmount;
        const balanceB = b.totalAmount - b.paidAmount;
        return balanceB - balanceA; // Higher balance first
      } else {
        return b.checkInDate.getTime() - a.checkInDate.getTime(); // Recent first
      }
    });

    return filtered;
  }, [payments, searchTerm, statusFilter, sortBy]);

  // Calculate summary statistics
  const summary = React.useMemo(() => {
    const total = payments.length;
    const pending = payments.filter((p) => p.paymentStatus === PAYMENT_STATUSES.PENDING).length;
    const partial = payments.filter((p) => p.paymentStatus === PAYMENT_STATUSES.PARTIAL).length;
    const overdue = payments.filter((p) => p.paymentStatus === PAYMENT_STATUSES.OVERDUE).length;
    const totalRevenue = payments
      .filter((p) => p.paymentStatus === PAYMENT_STATUSES.COMPLETED)
      .reduce((sum, p) => sum + p.totalAmount, 0);
    const outstandingBalance = payments
      .filter((p) =>
        [PAYMENT_STATUSES.PENDING, PAYMENT_STATUSES.PARTIAL, PAYMENT_STATUSES.OVERDUE].includes(
          p.paymentStatus
        )
      )
      .reduce((sum, p) => sum + (p.totalAmount - p.paidAmount), 0);

    return { total, pending, partial, overdue, totalRevenue, outstandingBalance };
  }, [payments]);

  if (isLoading) {
    return (
      <Card className="border-neutral-200">
        <CardContent className="p-6">
          <div className="flex h-48 items-center justify-center">
            <div className="text-sm text-neutral-500">Loading payment records...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-neutral-200 bg-white">
      {/* Enterprise Header with Summary Stats */}
      <CardHeader className="border-b border-neutral-100 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-neutral-900">
            Payment Status Tracker
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Total Revenue:</span>
              <span className="font-mono font-medium text-green-700">
                ₱{summary.totalRevenue.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-600">Outstanding:</span>
              <span className="font-mono font-medium text-red-700">
                ₱{summary.outstandingBalance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Statistics Bar */}
        <div className="mt-3 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline" className="border-neutral-300 bg-neutral-50 text-neutral-700">
              {summary.total} Total
            </Badge>
            {summary.pending > 0 && (
              <Badge
                variant="outline"
                className="border-neutral-300 bg-neutral-50 text-neutral-700"
              >
                {summary.pending} Pending
              </Badge>
            )}
            {summary.partial > 0 && (
              <Badge variant="secondary" className="border-yellow-300 bg-yellow-50 text-yellow-800">
                {summary.partial} Partial
              </Badge>
            )}
            {summary.overdue > 0 && (
              <Badge variant="destructive" className="border-red-300 bg-red-50 text-red-800">
                {summary.overdue} Overdue
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Enterprise Filters and Controls */}
        <div className="bg-neutral-25 border-b border-neutral-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <SearchInput
                placeholder="Search by guest name, booking code, or room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 border-neutral-200"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
                <SelectTrigger className="h-9 w-40 border-neutral-200">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger className="h-9 w-32 border-neutral-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="amount">Amount</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Enterprise Dense Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr className="h-10">
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Booking
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Guest
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Room
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Dates
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Total
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Paid
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Balance
                </th>
                <th className="px-4 py-2 text-center text-xs font-medium tracking-wide text-neutral-700 uppercase">
                  Status
                </th>
                {allowStatusUpdates && (
                  <th className="px-4 py-2 text-center text-xs font-medium tracking-wide text-neutral-700 uppercase">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-neutral-100">
              {filteredPayments.map((payment) => {
                const statusConfig = getPaymentStatusConfig(payment.paymentStatus);
                const balance = payment.totalAmount - payment.paidAmount;
                const isOverdue = payment.dueDate && payment.dueDate < new Date() && balance > 0;

                return (
                  <tr
                    key={payment.id}
                    className={cn(
                      "hover:bg-neutral-25 h-12 cursor-pointer",
                      isOverdue && "bg-red-25"
                    )}
                    onClick={() => onPaymentSelect?.(payment.id)}
                  >
                    {/* Booking Code */}
                    <td className="px-4 py-2">
                      <div className="font-mono text-sm font-medium text-neutral-900">
                        {payment.bookingCode}
                      </div>
                      {payment.lastPaymentDate && (
                        <div className="text-xs text-neutral-600">
                          Last: {format(payment.lastPaymentDate, "MMM d")}
                        </div>
                      )}
                    </td>

                    {/* Guest Name */}
                    <td className="px-4 py-2">
                      <div className="text-sm font-medium text-neutral-900">
                        {payment.guestName}
                      </div>
                      {payment.paymentMethod && (
                        <div className="text-xs text-neutral-600">via {payment.paymentMethod}</div>
                      )}
                    </td>

                    {/* Room */}
                    <td className="px-4 py-2">
                      <div className="text-sm font-medium text-neutral-900">
                        {payment.roomNumber}
                      </div>
                    </td>

                    {/* Dates */}
                    <td className="px-4 py-2">
                      <div className="text-sm text-neutral-900">
                        {format(payment.checkInDate, "MMM d")} -{" "}
                        {format(payment.checkOutDate, "MMM d")}
                      </div>
                      {payment.dueDate && (
                        <div
                          className={cn(
                            "text-xs",
                            isOverdue ? "font-medium text-red-600" : "text-neutral-600"
                          )}
                        >
                          Due: {format(payment.dueDate, "MMM d")}
                        </div>
                      )}
                    </td>

                    {/* Total Amount */}
                    <td className="px-4 py-2 text-right">
                      <div className="font-mono text-sm font-medium text-neutral-900">
                        ₱{payment.totalAmount.toLocaleString()}
                      </div>
                    </td>

                    {/* Paid Amount */}
                    <td className="px-4 py-2 text-right">
                      <div className="font-mono text-sm font-medium text-neutral-900">
                        ₱{payment.paidAmount.toLocaleString()}
                      </div>
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-2 text-right">
                      <div
                        className={cn(
                          "font-mono text-sm font-medium",
                          balance > 0 ? "text-red-700" : "text-green-700"
                        )}
                      >
                        ₱{balance.toLocaleString()}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-2 text-center">
                      <Badge
                        variant={statusConfig.variant}
                        className={cn("px-2 py-0.5 text-xs", statusConfig.className)}
                      >
                        {statusConfig.label}
                      </Badge>
                    </td>

                    {/* Actions */}
                    {allowStatusUpdates && (
                      <td className="px-4 py-2 text-center">
                        <Select
                          value={payment.paymentStatus}
                          onValueChange={(newStatus) =>
                            onStatusUpdate?.(payment.id, newStatus as PaymentStatus)
                          }
                        >
                          <SelectTrigger className="h-7 w-24 border-neutral-200 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="refunded">Refunded</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty State */}
          {filteredPayments.length === 0 && (
            <div className="py-12 text-center">
              <div className="text-sm text-neutral-500">
                {searchTerm || statusFilter !== "all"
                  ? "No payments match the current filters"
                  : "No payment records found"}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentStatusTracker;
