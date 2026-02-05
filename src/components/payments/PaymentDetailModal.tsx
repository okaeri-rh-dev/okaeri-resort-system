import { Calendar, Clock, CreditCard, DollarSign, FileText, Receipt, User } from "lucide-react";

import { formatCurrency, formatTableDate } from "@/components/tables/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Payment } from "@/types";

interface PaymentDetailModalProps {
  payment: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaymentDetailModal({ payment, open, onOpenChange }: PaymentDetailModalProps) {
  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-neutral-900">
            Payment Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Section */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  Payment ID
                </p>
                <p className="font-mono text-sm font-medium text-neutral-900">
                  {payment.payment_id}
                </p>
              </div>
              {payment.payment_method && (
                <Badge
                  variant="outline"
                  className="border-neutral-200 bg-white text-sm font-medium text-neutral-700"
                >
                  <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                  {payment.payment_method}
                </Badge>
              )}
            </div>
          </div>

          {/* Main Details Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Payment Date</span>
              </div>
              <p className="text-sm font-medium text-neutral-900">
                {formatTableDate(payment.payment_date || "")}
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Amount</span>
              </div>
              <p className="font-mono text-lg font-semibold text-neutral-900">
                {formatCurrency(payment.amount)}
              </p>
            </div>
          </div>

          {/* Booking Information */}
          {payment.booking && (
            <>
              <Separator className="bg-neutral-200" />
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-neutral-600">
                  <User className="h-4 w-4" />
                  <span className="text-xs font-medium tracking-wide uppercase">
                    Booking Information
                  </span>
                </div>
                <div className="space-y-3 rounded-md border border-neutral-200 bg-white p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs text-neutral-500">Booking Reference</p>
                      <p className="font-mono text-sm font-medium text-neutral-900">
                        {payment.booking.booking_reference}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs text-neutral-500">Guest Name</p>
                      <p className="text-sm font-medium text-neutral-900">
                        {payment.booking.guest_name}
                      </p>
                    </div>
                  </div>
                  {payment.booking.payment_status && (
                    <div>
                      <p className="mb-2 text-xs text-neutral-500">Booking Payment Status</p>
                      <Badge
                        variant={
                          payment.booking.payment_status === "Completed"
                            ? "default"
                            : payment.booking.payment_status === "Partial"
                              ? "secondary"
                              : payment.booking.payment_status === "Refunded"
                                ? "destructive"
                                : "outline"
                        }
                      >
                        {payment.booking.payment_status}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Reference Number field not in current schema */}

          {/* Notes Section (if present) */}
          {payment.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Notes</span>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <p className="text-sm text-neutral-700">{payment.notes}</p>
              </div>
            </div>
          )}

          {/* Payment Proof Section */}
          {payment.proof_url && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Documents</span>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open(payment.proof_url!, "_blank")}
                className="w-full justify-start border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              >
                <Receipt className="mr-2 h-4 w-4" />
                View Payment Proof
              </Button>
            </div>
          )}

          {/* Verification fields not in current schema */}

          {/* Metadata Footer */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/30 p-4">
            {/* Created At */}
            {payment.created_at && (
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-3.5 w-3.5 text-neutral-500" />
                <div>
                  <p className="text-xs font-medium text-neutral-600">Created</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(payment.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {/* Updated At field not in current schema */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
