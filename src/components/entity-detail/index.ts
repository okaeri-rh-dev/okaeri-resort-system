// src/components/entity-detail/index.ts

/**
 * Entity Detail Component Library - Barrel Export
 *
 * Exports all reusable components for entity detail pages:
 * - Layout components for consistent structure
 * - Field components for data display
 * - Navigation components for entity linking
 * - Formatters
 *
 * @example
 * ```typescript
 * import {
 *   DetailPageLayout,
 *   DetailSection,
 *   DetailField,
 *   RelatedEntityLink,
 *   DetailAuditSection,
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
