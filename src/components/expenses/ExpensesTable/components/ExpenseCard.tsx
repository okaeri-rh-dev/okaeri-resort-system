import { Calendar, DollarSign, Edit2, Eye, Receipt, Trash2 } from "lucide-react";

import { Button, Card, StatusBadge } from "@/components/patterns";
import { formatCurrency, formatTableDate } from "@/lib/formatters";

import type { ExpenseCardProps } from "../types";

export function ExpenseCard({ expense, onView, onEdit, onDelete }: ExpenseCardProps) {
  const CategoryIcon = Receipt;

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="border-border bg-muted border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-foreground text-sm font-medium">
              {formatTableDate(expense.date)}
            </span>
          </div>
          <StatusBadge tone="neutral">
            <CategoryIcon className="mr-1 h-3 w-3" aria-hidden="true" />
            {expense.category}
          </StatusBadge>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {/* Description */}
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Description
          </p>
          <p className="text-foreground text-sm">
            {expense.description || "No description provided"}
          </p>
        </div>

        {/* Amount */}
        <div className="bg-muted flex items-center justify-between rounded-md px-3 py-2">
          <div className="flex items-center gap-2">
            <DollarSign className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            <span className="text-muted-foreground text-xs font-medium">Amount</span>
          </div>
          <span className="text-foreground text-sm font-semibold tabular-nums">
            {formatCurrency(expense.amount)}
          </span>
        </div>

        {/* Receipt Status */}
        {expense.receipt_url && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Receipt className="h-3.5 w-3.5" />
            <span>Receipt attached</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => expense.receipt_url && window.open(expense.receipt_url, "_blank")}
              className="ml-auto h-7 px-2 text-xs"
            >
              View Receipt
            </Button>
          </div>
        )}

        {/* Notes if present */}
        {expense.notes && (
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Notes
            </p>
            <p className="text-muted-foreground text-xs">{expense.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-border border-t px-4 py-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onView} className="flex-1">
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit} className="flex-1">
            <Edit2 className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete} aria-label="Delete expense">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
