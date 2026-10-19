/**
 * The kit: the only UI import point for product code (DESIGN.md, Components).
 *
 * The 21 plain primitives are re-exported unchanged. Table, Badge, Alert, Form and Calendar are
 * reached only through their patterns. Each pattern documents its usage in TSDoc; the authoring
 * rules live in ./CLAUDE.md.
 */

// Primitives, unchanged
export * from "@/components/ui/button";
export * from "@/components/ui/card";
export * from "@/components/ui/input";
export * from "@/components/ui/textarea";
export * from "@/components/ui/label";
export * from "@/components/ui/checkbox";
export * from "@/components/ui/switch";
export * from "@/components/ui/select";
export * from "@/components/ui/separator";
export * from "@/components/ui/dialog";
export * from "@/components/ui/alert-dialog";
export * from "@/components/ui/sheet";
export * from "@/components/ui/popover";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/tabs";
export * from "@/components/ui/collapsible";
export { Skeleton } from "@/components/ui/skeleton";
export * from "@/components/ui/progress";
export * from "@/components/ui/scroll-area";
export * from "@/components/ui/hover-card";
export { Toaster } from "@/components/ui/sonner";
export { toast } from "sonner";

// Patterns
export { StatusBadge, type StatusBadgeProps, type StatusTone } from "./StatusBadge";
export { Callout, type CalloutProps } from "./Callout";
export { Form, FormField, type FormFieldProps } from "./FormField";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export {
  DatePicker,
  DateRangePicker,
  type DatePickerProps,
  type DateRange,
  type DateRangePickerProps,
} from "./DatePicker";
export {
  DetailPageLayout,
  type Breadcrumb,
  type DetailPageLayoutProps,
  type RoutePath,
} from "./DetailPageLayout";
export { DetailSection, type DetailSectionProps } from "./DetailSection";
export { DetailField, type DetailFieldProps } from "./DetailField";
export { TableSkeleton, type TableSkeletonProps } from "./TableSkeleton";
export { FormSkeleton, type FormSkeletonProps } from "./FormSkeleton";
export { SortableHeader, type SortableHeaderProps } from "./SortableHeader";
export { TableSearch, type TableSearchProps } from "./TableSearch";
export { FilterPopover, type FilterPopoverProps } from "./FilterPopover";
export { TablePagination, type TablePaginationProps } from "./TablePagination";
export { MobileCard, type MobileCardProps } from "./MobileCard";
export { MobileCardRow, type MobileCardRowProps } from "./MobileCardRow";
export { ActionMenu, type ActionMenuAction, type ActionMenuProps } from "./ActionMenu";
export { TableEmptyState, type TableEmptyStateProps } from "./TableEmptyState";
export { ResponsiveTable, type ResponsiveTableProps } from "./ResponsiveTable";
