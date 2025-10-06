/**
 * Type definitions for UnitsTable component
 */

export interface UnitsTableProps {
  /**
   * Callback when Add Unit button is clicked
   */
  onAddUnit?: () => void;

  /**
   * Number of rows per page
   * @default 10
   */
  pageSize?: number;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Enable/disable edit mode by default
   * @default false
   */
  defaultEditMode?: boolean;

  /**
   * Enable/disable export functionality
   * @default true
   */
  allowExport?: boolean;

  /**
   * Enable/disable batch operations
   * @default true
   */
  allowBatchOperations?: boolean;

  /**
   * Custom empty state message
   */
  emptyMessage?: string;

  /**
   * Callback when a unit is selected
   */
  onUnitSelect?: (unitId: string) => void;

  /**
   * Callback when a unit is updated
   */
  onUnitUpdate?: (unitId: string, updates: any) => void;

  /**
   * Callback when a unit is deleted
   */
  onUnitDelete?: (unitId: string) => void;

  /**
   * Callback when viewing unit details
   */
  onViewUnit?: (unit: any) => void;

  /**
   * Callback when editing a unit
   */
  onEditUnit?: (unit: any) => void;
}
