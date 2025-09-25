/**
 * Reusable Component Patterns
 *
 * These patterns provide consistent, secure, and performant
 * component structures across the application
 */

// Form patterns for consistent form handling
export { FormWrapper, StepFormWrapper } from "./form-pattern";

// Data fetching patterns with loading/error states
export {
  DataFetchingWrapper,
  ListDataWrapper,
  PaginatedDataWrapper,
} from "./data-fetching-pattern";

// Modal and drawer patterns
export { ModalWrapper, ConfirmModal, DrawerWrapper } from "./modal-pattern";

// Table patterns for data display
export { TableWrapper, TableActionMenu, VirtualizedTable, type Column } from "./table-pattern";

// Export all types
export type { Column as TableColumn } from "./table-pattern";
