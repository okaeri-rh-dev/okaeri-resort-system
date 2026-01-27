import React from "react";

import { Header, Table as TanStackTable } from "@tanstack/react-table";
import { format } from "date-fns";
import { ChevronDown, ChevronsUpDown, ChevronUp, Filter, MoreHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { utcToResortTime } from "@/utils/date-helpers";

// ============================================
// FORMATTING UTILITIES
// ============================================

/**
 * Format Philippine peso currency with proper formatting
 * Shows 2 decimal places to preserve precision (e.g., ₱4,500.50 not ₱4,501)
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format percentage with one decimal place
 */
export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

/**
 * Format date for dense table display
 */
export const formatTableDate = (dateString: string): string => {
  try {
    const date = utcToResortTime(dateString);
    return format(date, "MMM dd");
  } catch {
    return "Invalid Date";
  }
};

/**
 * Format full date with year
 */
export const formatFullDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy");
  } catch {
    return "Invalid Date";
  }
};

/**
 * Format date and time
 */
export const formatDateTime = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy HH:mm");
  } catch {
    return "Invalid Date";
  }
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Format Philippine mobile numbers
  if (cleaned.length === 11 && cleaned.startsWith("09")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }

  // Return original if not standard format
  return phone;
};

// ============================================
// STATUS BADGE COMPONENTS
// ============================================

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = "default",
  className,
}) => {
  // Enterprise status color mapping
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "checkedin":
      case "paid":
      case "available":
        return "default"; // Blue
      case "pending":
      case "partial":
      case "reserved":
        return "secondary"; // Gray
      case "cancelled":
      case "refunded":
      case "maintenance":
        return "destructive"; // Red
      case "checkedout":
      case "occupied":
        return "outline"; // Neutral outline
      default:
        return "secondary";
    }
  };

  return (
    <Badge
      variant={variant === "default" ? getStatusVariant(status) : variant}
      className={cn("text-xs font-medium", className)}
    >
      {status}
    </Badge>
  );
};

// ============================================
// TABLE HEADER COMPONENTS
// ============================================

interface SortableHeaderProps<TData = unknown, TValue = unknown> {
  header: Header<TData, TValue>;
  children: React.ReactNode;
  className?: string;
}

export const SortableHeader = <TData, TValue>({
  header,
  children,
  className,
}: SortableHeaderProps<TData, TValue>) => {
  // Safety check for header and column existence
  if (!header || !header.column || !header.column.getCanSort()) {
    return <div className={cn("font-medium text-neutral-700", className)}>{children}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto p-0 font-medium text-neutral-700 hover:bg-transparent hover:text-neutral-900",
        "enterprise-table-header",
        className
      )}
      onClick={header.column.getToggleSortingHandler()}
    >
      {children}
      <div className="ml-1 flex h-4 w-4 items-center justify-center">
        {header.column.getIsSorted() === "desc" ? (
          <ChevronDown className="h-3 w-3" />
        ) : header.column.getIsSorted() === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );
};

// ============================================
// FILTER COMPONENTS
// ============================================

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const TableSearch: React.FC<TableSearchProps> = ({
  value,
  onChange,
  placeholder = "Search...",
  className,
}) => {
  // Security: Sanitize search input to prevent regex injection
  const handleSearchChange = (newValue: string) => {
    // Remove potentially dangerous regex characters
    // Allow only alphanumeric, spaces, and basic punctuation
    const sanitizedValue = newValue.replace(/[^\w\s@.,-]/g, "");

    // Limit length to prevent DoS attacks
    const maxLength = 100;
    const truncatedValue = sanitizedValue.slice(0, maxLength);

    onChange(truncatedValue);
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="enterprise-form h-9 w-full max-w-sm"
        maxLength={100}
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-0 right-0 h-9 w-9 p-0"
          onClick={() => onChange("")}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

interface FilterPopoverProps {
  children: React.ReactNode;
  content: React.ReactNode;
  isActive?: boolean;
  onApply?: () => void;
  onClear?: () => void;
  showActions?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional label to show the current filter value as a badge */
  badgeLabel?: string;
}

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  children,
  content,
  isActive = false,
  onApply,
  onClear,
  showActions = false,
  open,
  onOpenChange,
  badgeLabel,
}) => {
  // Check if content contains a Calendar component recursively
  const containsCalendar = (element: React.ReactNode): boolean => {
    if (!React.isValidElement(element)) return false;

    // Direct Calendar component
    const props = element.props as Record<string, unknown>;
    if (element.type?.toString().includes("Calendar") || props?.mode) {
      return true;
    }

    // Check children recursively
    if (props?.children) {
      const children = React.Children.toArray(props.children as any);
      return children.some((child) => containsCalendar(child));
    }

    return false;
  };

  const isCalendarContent = containsCalendar(content);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 border-neutral-200", isActive && "border-blue-300 bg-blue-50")}
        >
          <Filter className="mr-1 h-3 w-3" />
          {children}
          {badgeLabel && isActive && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs font-normal">
              {badgeLabel}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-56", isCalendarContent ? "w-[340px] p-0" : "p-3")}
        align="start"
      >
        <div>
          {content}
          {showActions && (
            <div
              className={cn(
                "flex justify-between gap-2 pt-3",
                isCalendarContent ? "px-3 pb-3" : ""
              )}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onClear?.();
                  // Don't close the popover, just clear the selection
                }}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onApply?.();
                  onOpenChange?.(false);
                }}
                className="flex-1"
              >
                Apply
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ============================================
// PAGINATION COMPONENT
// ============================================

interface TablePaginationProps {
  table: TanStackTable<unknown>;
  totalItems?: number;
}

export const TablePagination: React.FC<TablePaginationProps> = ({ table, totalItems }) => {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  // Calculate displayed items range
  const startItem = pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalItems || 0);

  return (
    <div className="flex items-center justify-between border-t border-neutral-200 bg-white px-4 py-3">
      <div className="flex items-center space-x-2">
        <p className="text-sm text-neutral-600">
          Showing {startItem} to {endItem} of {totalItems || 0} results
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!canPreviousPage}
          className="h-8 w-8 p-0"
        >
          <ChevronUp className="h-4 w-4 rotate-[-90deg]" />
        </Button>

        <div className="flex items-center space-x-1">
          {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
            let pageNumber;
            if (pageCount <= 5) {
              pageNumber = i;
            } else if (pageIndex < 3) {
              pageNumber = i;
            } else if (pageIndex > pageCount - 4) {
              pageNumber = pageCount - 5 + i;
            } else {
              pageNumber = pageIndex - 2 + i;
            }

            return (
              <Button
                key={pageNumber}
                variant={pageNumber === pageIndex ? "default" : "outline"}
                size="sm"
                onClick={() => table.setPageIndex(pageNumber)}
                className="h-8 w-8 p-0"
              >
                {pageNumber + 1}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!canNextPage}
          className="h-8 w-8 p-0"
        >
          <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
        </Button>
      </div>
    </div>
  );
};

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Legacy export function - Use the enhanced version from @/utils/reports instead
 * This is kept for backward compatibility but should be replaced
 * @deprecated Use exportToCSV from '@/utils/reports' for production
 */
export const exportToCSV = (
  data: Record<string, unknown>[],
  filename: string,
  headers?: string[]
) => {
  // Import the secure, Philippine-compliant version
  import("@/utils/reports")
    .then(({ exportToCSV: secureExport }) => {
      secureExport(data, filename, headers, {
        philippineFormat: true,
        includeTimestamp: true,
        onError: (error) => {
          console.error("CSV Export Error:", error);
          // Fallback to basic export if enhanced version fails
          basicCSVExport(data, filename, headers);
        },
      });
    })
    .catch(() => {
      // Fallback to basic export if import fails
      basicCSVExport(data, filename, headers);
    });
};

/**
 * Basic CSV export fallback - NOT SECURE FOR PRODUCTION
 * Only use as emergency fallback
 */
const basicCSVExport = (data: Record<string, unknown>[], filename: string, headers?: string[]) => {
  const actualHeaders = headers || (data.length > 0 ? Object.keys(data[0]) : []);

  // Security warning for formula injection
  const sanitizeForCSV = (value: unknown): string => {
    if (value == null) return "";
    let str = String(value);

    // SECURITY: Prevent formula injection
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }

    // Escape quotes and wrap in quotes if contains special characters
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    actualHeaders.map(sanitizeForCSV).join(","),
    ...data.map((row) =>
      actualHeaders
        .map((header) => {
          const key = headers ? header.toLowerCase().replace(/\s+/g, "_") : header;
          return sanitizeForCSV(row[key]);
        })
        .join(",")
    ),
  ].join("\n");

  // Add BOM for Excel UTF-8 compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================
// MOBILE RESPONSIVE UTILITIES
// ============================================

interface MobileCardProps {
  children: React.ReactNode;
  className?: string;
}

export const MobileCard: React.FC<MobileCardProps> = ({ children, className }) => {
  return <Card className={cn("space-y-3 border-neutral-200 p-4", className)}>{children}</Card>;
};

interface MobileCardRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export const MobileCardRow: React.FC<MobileCardRowProps> = ({ label, value, className }) => {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <span className="text-sm font-medium text-neutral-600">{label}</span>
      <div className="text-sm text-neutral-900">{value}</div>
    </div>
  );
};

// ============================================
// ACTION MENU COMPONENT
// ============================================

interface ActionMenuProps {
  actions: Array<{
    label: string;
    onClick: () => void;
    variant?: "default" | "destructive";
    disabled?: boolean;
  }>;
  className?: string;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({ actions, className }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("h-8 w-8 p-0", className)}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-32">
        {actions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(action.variant === "destructive" && "text-red-600 focus:text-red-600")}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ============================================
// TABLE LOADING STATE (LEGACY - USE NEW SKELETON COMPONENTS)
// ============================================

// Legacy component - use TableSkeleton from @/components/ui/skeleton instead
interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, columns = 4 }) => {
  const columnWidths = Array.from({ length: columns }, (_, i) =>
    i === 0 ? 120 : i === 1 ? 200 : i === columns - 1 ? 80 : 100
  );

  return (
    <div className="enterprise-table">
      <div className="rounded-md border border-neutral-200">
        {/* Header skeleton */}
        <div className="border-b border-neutral-200 bg-neutral-50">
          <div className="flex h-10 items-center space-x-4 px-4">
            {columnWidths.map((width, i) => (
              <div
                key={i}
                className="h-4 animate-pulse rounded bg-neutral-200"
                style={{ width: `${width}px` }}
              />
            ))}
          </div>
        </div>

        {/* Rows skeleton */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className={cn(
              "flex h-10 items-center space-x-4 border-b border-neutral-100 px-4",
              rowIndex % 2 === 0 && "bg-neutral-50/30"
            )}
          >
            {columnWidths.map((width, colIndex) => (
              <div
                key={colIndex}
                className="h-3 animate-pulse rounded bg-neutral-200"
                style={{
                  width: `${width}px`,
                  animationDelay: `${(rowIndex * columns + colIndex) * 50}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// EMPTY STATE COMPONENT
// ============================================

interface TableEmptyStateProps {
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Type of empty state for contextual icons */
  variant?: "no-data" | "no-results" | "error";
}

export const TableEmptyState: React.FC<TableEmptyStateProps> = ({
  title,
  description,
  action,
  secondaryAction,
  variant = "no-data",
}) => {
  // Contextual icon based on variant
  const getIcon = () => {
    switch (variant) {
      case "no-results":
        return (
          <svg
            className="h-6 w-6 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        );
      case "error":
        return (
          <svg
            className="h-6 w-6 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      default: // no-data
        return (
          <svg
            className="h-6 w-6 text-neutral-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        );
    }
  };

  const getBgColor = () => {
    return variant === "error" ? "bg-red-50" : "bg-neutral-100";
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center rounded-full",
          getBgColor()
        )}
      >
        {getIcon()}
      </div>
      <h3 className="mt-4 text-sm font-medium text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-600">{description}</p>
      <div className="mt-4 flex items-center gap-2">
        {action && (
          <Button variant="outline" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
        {secondaryAction && (
          <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
};

// ============================================
// RESPONSIVE TABLE WRAPPER
// ============================================

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({ children, className }) => {
  return (
    <div className={cn("enterprise-table", className)}>
      <div className="overflow-hidden rounded-md border border-neutral-200 bg-white">
        <div className="overflow-x-auto">{children}</div>
      </div>
    </div>
  );
};

// ============================================
// CSS CLASS DEFINITIONS
// ============================================

/**
 * Enterprise table CSS classes that should be added to global styles:
 *
 * .enterprise-table {
 *   @apply w-full;
 * }
 *
 * .enterprise-table table {
 *   @apply w-full border-collapse;
 * }
 *
 * .enterprise-table thead {
 *   @apply bg-neutral-50 border-b border-neutral-200;
 * }
 *
 * .enterprise-table thead tr {
 *   @apply h-10;
 * }
 *
 * .enterprise-table thead th {
 *   @apply px-4 text-left text-xs font-medium text-neutral-700 uppercase tracking-wide;
 * }
 *
 * .enterprise-table tbody tr {
 *   @apply h-10 border-b border-neutral-100 hover:bg-neutral-50;
 * }
 *
 * .enterprise-table tbody tr:nth-child(even) {
 *   @apply bg-neutral-50/30;
 * }
 *
 * .enterprise-table tbody td {
 *   @apply px-4 text-sm text-neutral-900 font-mono tabular-nums;
 * }
 *
 * .enterprise-table-header {
 *   @apply flex items-center space-x-1 text-left;
 * }
 *
 * .enterprise-form input {
 *   @apply h-9 border border-neutral-200 rounded-md px-3 text-sm;
 * }
 *
 * .enterprise-form input:focus {
 *   @apply border-blue-300 ring-2 ring-blue-100 outline-none;
 * }
 */
