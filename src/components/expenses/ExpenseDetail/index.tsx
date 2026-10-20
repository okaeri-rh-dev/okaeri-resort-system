// src/components/expenses/ExpenseDetail/index.tsx

import { DollarSign, FileText, Home, Image, StickyNote } from "lucide-react";

import {
  DetailAuditSection,
  formatCurrency,
  formatFullDate,
  RelatedEntityLink,
  truncate,
} from "@/components/entity-detail";
import {
  buttonVariants,
  DetailField,
  DetailPageLayout,
  DetailSection,
  StatusBadge,
} from "@/components/patterns";
import type { Expense, Unit } from "@/types";

/**
 * Props for ExpenseDetailPage component
 * Data is passed from the route loader
 */
interface ExpenseDetailPageProps {
  expense: Expense & {
    unit?: Unit;
    unit_id?: string;
    created_by?: string;
    created_by_name?: string;
  };
  expenseId: string;
}

/**
 * Expense Detail Page Component
 *
 * Displays comprehensive expense information in a professional enterprise layout:
 * - Expense overview with amount, category, and date
 * - Full description text
 * - Related unit information (if linked)
 * - Receipt viewer (if uploaded)
 * - Internal notes (if provided)
 * - Full audit trail history
 *
 * Uses Professional Enterprise Design System with:
 * - High information density with minimal whitespace
 * - Monospace fonts for financial data
 * - Responsive 2-column desktop / 1-column mobile layouts
 * - Professional badges for categories
 * - Consistent spacing and typography
 *
 * Note: This component receives data from the route loader via props.
 * The route file handles useParams() and useLoaderData() calls.
 */
export function ExpenseDetailPage({ expense, expenseId }: ExpenseDetailPageProps) {
  // Format description for title (truncate if too long)
  const titleDescription = truncate(expense.description || "Expense", 60);

  return (
    <DetailPageLayout
      title={titleDescription}
      subtitle={`${expense.category} • ${formatFullDate(expense.date)}`}
      breadcrumbs={[{ label: "Expenses", to: "/admin/expenses" }, { label: titleDescription }]}
      editRoute={{
        to: "/admin/expenses/$expenseId/edit",
        params: { expenseId },
      }}
    >
      {/* 1. Expense Overview Section */}
      <DetailSection title="Expense Overview" icon={<DollarSign className="h-5 w-5" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DetailField label="Amount" value={formatCurrency(expense.amount)} emphasis="total" />
          <DetailField
            label="Category"
            value={<StatusBadge tone="neutral">{expense.category}</StatusBadge>}
          />
          <DetailField
            label="Expense Date"
            value={formatFullDate(expense.date)}
            emphasis="strong"
          />
          {expense.created_by_name && (
            <DetailField label="Created By" value={expense.created_by_name} emphasis="strong" />
          )}
        </div>
      </DetailSection>

      {/* 2. Description Section */}
      {expense.description && (
        <DetailSection title="Description" icon={<FileText className="h-5 w-5" />}>
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground text-sm whitespace-pre-wrap">{expense.description}</p>
          </div>
        </DetailSection>
      )}

      {/* 3. Related Unit Section (Conditional) */}
      {expense.unit && expense.unit_id && (
        <DetailSection title="Related Cabin" icon={<Home className="h-5 w-5" />}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DetailField
              label="Cabin"
              value={
                <RelatedEntityLink
                  type="unit"
                  id={expense.unit_id}
                  label={expense.unit.unit_name}
                  badge={expense.unit.unit_code}
                />
              }
            />
            <DetailField label="Cabin Type" value={expense.unit.unit_type} emphasis="strong" />
          </div>
        </DetailSection>
      )}

      {/* 4. Receipt Section (Conditional) */}
      {expense.receipt_url && (
        <DetailSection title="Receipt" icon={<Image className="h-5 w-5" />}>
          <div className="space-y-4">
            <div className="relative w-full max-w-2xl">
              <img
                src={expense.receipt_url}
                alt="Expense receipt"
                className="border-border h-auto w-full rounded-md border"
              />
            </div>
            <div className="flex gap-2">
              <a
                href={expense.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                Open in New Tab
              </a>
              <a
                href={expense.receipt_url}
                download
                className={buttonVariants({ variant: "outline" })}
              >
                Download
              </a>
            </div>
          </div>
        </DetailSection>
      )}

      {/* 5. Internal Notes Section (Conditional) */}
      {expense.notes && (
        <DetailSection title="Internal Notes" icon={<StickyNote className="h-5 w-5" />}>
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground text-sm whitespace-pre-wrap">{expense.notes}</p>
          </div>
        </DetailSection>
      )}

      {/* 6. Audit Trail Section */}
      <DetailAuditSection entityType="expense" entityId={expenseId} />
    </DetailPageLayout>
  );
}
