import { Calendar, Clock, DollarSign, FileText, Receipt, Tag } from "lucide-react";

import { formatCurrency, formatTableDate } from "@/components/tables/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import type { Expense } from "@/types";

interface ExpenseDetailModalProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExpenseDetailModal({ expense, open, onOpenChange }: ExpenseDetailModalProps) {
  if (!expense) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-neutral-900">
            Expense Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Section */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">
                  Expense ID
                </p>
                <p className="font-mono text-sm font-medium text-neutral-900">
                  {expense.expense_id}
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-neutral-200 bg-white text-sm font-medium text-neutral-700"
              >
                <Tag className="mr-1.5 h-3.5 w-3.5" />
                {expense.category}
              </Badge>
            </div>
          </div>

          {/* Main Details Grid */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Date */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <Calendar className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Date</span>
              </div>
              <p className="text-sm font-medium text-neutral-900">
                {formatTableDate(expense.date)}
              </p>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Amount</span>
              </div>
              <p className="font-mono text-lg font-semibold text-neutral-900">
                {formatCurrency(expense.amount)}
              </p>
            </div>
          </div>

          <Separator className="bg-neutral-200" />

          {/* Description Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-neutral-600">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium tracking-wide uppercase">Description</span>
            </div>
            <div className="rounded-md border border-neutral-200 bg-white p-3">
              <p className="text-sm text-neutral-900">
                {expense.description || "No description provided"}
              </p>
            </div>
          </div>

          {/* Notes Section (if present) */}
          {expense.notes && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Notes</span>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3">
                <p className="text-sm text-neutral-700">{expense.notes}</p>
              </div>
            </div>
          )}

          {/* Receipt Section */}
          {expense.receipt_url && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-neutral-600">
                <Receipt className="h-4 w-4" />
                <span className="text-xs font-medium tracking-wide uppercase">Receipt</span>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open(expense.receipt_url!, "_blank")}
                className="w-full justify-start border-neutral-200 text-neutral-700 hover:bg-neutral-50"
              >
                <Receipt className="mr-2 h-4 w-4" />
                View Receipt
              </Button>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50/30 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Created At */}
              {expense.created_at && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 text-neutral-500" />
                  <div>
                    <p className="text-xs font-medium text-neutral-600">Created</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(expense.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Updated At */}
              {expense.updated_at && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-3.5 w-3.5 text-neutral-500" />
                  <div>
                    <p className="text-xs font-medium text-neutral-600">Last Updated</p>
                    <p className="text-xs text-neutral-500">
                      {new Date(expense.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
