// src/components/entity-detail/index.ts

/**
 * Entity Detail Component Library - Barrel Export
 *
 * Exports all reusable components for entity detail pages:
 * - Layout components for consistent structure
 * - Field components for data display
 * - Navigation components for entity linking
 * - Utility components for loading/error states
 * - Type definitions and formatters
 *
 * @example
 * ```typescript
 * import {
 *   DetailPageLayout,
 *   DetailSection,
 *   DetailField,
 *   RelatedEntityLink,
 *   DetailAuditSection,
 *   DetailPageSkeleton,
 *   DetailErrorBoundary,
 *   formatCurrency,
 *   formatTableDate,
 * } from '@/components/entity-detail';
 * ```
 */

// Layout Components
export { DetailPageLayout } from "./DetailPageLayout";
export { DetailSection } from "./DetailSection";
export { DetailField } from "./DetailField";

// Navigation Components
export { RelatedEntityLink } from "./RelatedEntityLink";

// Specialized Components
export { DetailAuditSection } from "./DetailAuditSection";

// State Components
export { DetailPageSkeleton } from "./DetailPageSkeleton";
export { DetailErrorBoundary } from "./DetailErrorBoundary";

// Utilities
export {
  formatCurrency,
  formatTableDate,
  formatFullDate,
  formatDateTime,
  formatPhoneNumber,
  formatPercentage,
  truncate,
} from "./utils/formatters";

// Type Definitions
export type {
  Breadcrumb,
  DetailPageLayoutProps,
  DetailSectionProps,
  DetailFieldProps,
  RelatedEntityLinkProps,
  DetailAuditSectionProps,
  DetailErrorBoundaryProps,
} from "./utils/types";
