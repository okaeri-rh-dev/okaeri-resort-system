// src/components/entity-detail/index.ts

/**
 * Entity detail product components. The domain-free layout pieces (`DetailPageLayout`,
 * `DetailSection`, `DetailField`) live in the kit: import them from `@/components/patterns`.
 */

export { RelatedEntityLink } from "./RelatedEntityLink";
export { DetailAuditSection } from "./DetailAuditSection";

export {
  formatCurrency,
  formatTableDate,
  formatFullDate,
  formatDateTime,
  formatPhoneNumber,
  formatPercentage,
  truncate,
} from "./utils/formatters";
