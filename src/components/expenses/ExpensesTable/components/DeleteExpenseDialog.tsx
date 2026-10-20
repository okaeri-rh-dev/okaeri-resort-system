import React from "react";

import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  buttonVariants,
} from "@/components/patterns";
import { formatCurrency } from "@/lib/formatters";
import type { Expense } from "@/types";

interface DeleteExpenseDialogProps {
  expense: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DeleteExpenseDialog: React.FC<DeleteExpenseDialogProps> = ({
  expense,
  open,
  onOpenChange,
  onConfirm,
  isDeleting = false,
}) => {
  if (!expense) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="text-destructive h-5 w-5" aria-hidden="true" />
            Delete Expense
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">Are you sure you want to delete this expense?</span>
            <span className="bg-muted text-foreground block rounded-md p-3">
              <strong>{expense.description || "No description"}</strong>
              <br />
              <span className="text-muted-foreground text-sm">
                {expense.category} • {formatCurrency(expense.amount)}
              </span>
            </span>
            <span className="text-destructive block">This action cannot be undone.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className={buttonVariants({ variant: "destructive" })}
          >
            {isDeleting ? "Deleting..." : "Delete Expense"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
