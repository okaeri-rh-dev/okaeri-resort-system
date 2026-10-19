import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// The styles the retired .enterprise-table class gave, on tokens
const tableStyles = [
  "[&_table]:w-full [&_table]:border-collapse",
  "[&_thead]:bg-muted [&_thead]:border-border [&_thead]:border-b [&_thead_tr]:h-10",
  "[&_thead_th]:text-muted-foreground [&_thead_th]:px-4 [&_thead_th]:text-left [&_thead_th]:text-xs [&_thead_th]:font-medium [&_thead_th]:tracking-wide [&_thead_th]:uppercase",
  "[&_tbody_tr]:border-border [&_tbody_tr]:h-14 [&_tbody_tr]:border-b [&_tbody_tr]:transition-colors [&_tbody_tr]:duration-150 [&_tbody_tr]:hover:bg-muted/50",
  "[&_tbody_td]:text-foreground [&_tbody_td]:px-4 [&_tbody_td]:text-sm [&_tbody_td]:tabular-nums",
].join(" ");

export interface ResponsiveTableProps {
  children: ReactNode;
  /** Placement only. */
  className?: string;
}

/**
 * The bordered card a wide table sits in. It scrolls sideways when the table is wider than its
 * pane, and styles the header and rows it wraps.
 *
 * @example
 * ```tsx
 * <ResponsiveTable>
 *   <table>…</table>
 * </ResponsiveTable>
 * ```
 */
export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div
      className={cn(
        "border-border bg-card w-full overflow-hidden rounded-md border",
        tableStyles,
        className
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
