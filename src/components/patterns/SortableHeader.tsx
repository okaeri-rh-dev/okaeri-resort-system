import type { ReactNode } from "react";

import type { Header } from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SortableHeaderProps<TData, TValue> {
  header: Header<TData, TValue>;
  children: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * A TanStack table column header that toggles the column's sort when pressed and shows the
 * current direction. A column that can't sort renders its label as plain text.
 *
 * @example
 * ```tsx
 * { accessorKey: "check_in", header: ({ header }) => <SortableHeader header={header}>Check-in</SortableHeader> }
 * ```
 */
export function SortableHeader<TData, TValue>({
  header,
  children,
  className,
}: SortableHeaderProps<TData, TValue>) {
  if (!header?.column?.getCanSort()) {
    return <div className={cn("text-muted-foreground font-medium", className)}>{children}</div>;
  }

  const sorted = header.column.getIsSorted();
  const SortIcon = sorted === "desc" ? ChevronDown : sorted === "asc" ? ChevronUp : ChevronsUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "text-muted-foreground hover:text-foreground h-auto gap-1 p-0 font-medium hover:bg-transparent",
        className
      )}
      onClick={header.column.getToggleSortingHandler()}
    >
      {children}
      <SortIcon className={cn("size-3", !sorted && "opacity-50")} aria-hidden="true" />
    </Button>
  );
}
