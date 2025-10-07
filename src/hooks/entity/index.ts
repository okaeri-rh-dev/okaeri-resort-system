// src/hooks/entity/index.ts

/**
 * Entity-related hooks barrel export
 *
 * Provides generic, type-safe hooks for:
 * - Fetching entity details (useEntityDetail)
 * - Editing entities (useEntityEdit)
 * - Viewing audit trails (useEntityAudit)
 * - Navigation (useEntityNavigation)
 * - UI state management (useDetailPageState)
 */

export { useEntityDetail } from "./useEntityDetail";
export { useEntityEdit } from "./useEntityEdit";
export { useEntityAudit } from "./useEntityAudit";
export { useEntityNavigation } from "./useEntityNavigation";
export { useDetailPageState } from "./useDetailPageState";
