import { Eye, Edit2, Trash2, Receipt, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTableDate } from "@/components/tables/utils";
import type { ExpenseCardProps } from "../types";

// Icon mapping for categories - using icons instead of colors for professional look
const categoryIcons: Record<string, React.ComponentType<any>> = {
  Utilities: Receipt,
  "Maintenance & Repairs": Receipt,
  "Supplies & Inventory": Receipt,
  "Staff & Payroll": Receipt,
  "Marketing & Advertising": Receipt,
  "Food & Beverage": Receipt,
  "Cleaning & Laundry": Receipt,
  "Insurance & Permits": Receipt,
  "Professional Services": Receipt,
  Other: Receipt,
};

export function ExpenseCard({ expense, onView, onEdit, onDelete }: ExpenseCardProps) {
  const CategoryIcon = categoryIcons[expense.category] || Receipt;

  return (
    <Card className="overflow-hidden border-neutral-200 bg-white">
      {/* Header */}
      <div className="border-b border-neutral-100 bg-neutral-50/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-neutral-500" />
            <span className="text-sm font-medium text-neutral-900">
              {formatTableDate(expense.date)}
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-neutral-200 bg-white text-xs font-medium text-neutral-700"
          >
            <CategoryIcon className="mr-1 h-3 w-3" />
            {expense.category}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 p-4">
        {/* Description */}
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Description
          </p>
          <p className="text-sm text-neutral-900">
            {expense.description || "No description provided"}
          </p>
        </div>

        {/* Amount */}
        <div className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-neutral-500" />
            <span className="text-xs font-medium text-neutral-600">Amount</span>
          </div>
          <span className="font-mono text-sm font-semibold text-neutral-900">
            {formatCurrency(expense.amount)}
          </span>
        </div>

        {/* Receipt Status */}
        {expense.receipt_url && (
          <div className="flex items-center gap-2 text-xs text-neutral-600">
            <Receipt className="h-3.5 w-3.5" />
            <span>Receipt attached</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(expense.receipt_url!, "_blank")}
              className="ml-auto h-7 px-2 text-xs"
            >
              View Receipt
            </Button>
          </div>
        )}

        {/* Notes if present */}
        {expense.notes && (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Notes</p>
            <p className="text-xs text-neutral-600">{expense.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-neutral-100 bg-neutral-50/30 px-4 py-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            className="flex-1 border-neutral-200 text-neutral-700 hover:bg-neutral-100"
          >
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            View
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="flex-1 border-neutral-200 text-neutral-700 hover:bg-neutral-100"
          >
            <Edit2 className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            className="border-neutral-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
