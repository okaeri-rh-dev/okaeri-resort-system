// src/hooks/entity/index.ts

/**
 * Entity-related hooks barrel export
 *
 * Provides generic, type-safe hooks for:
 * - Editing entities (useEntityEdit)
 * - Viewing audit trails (useEntityAudit)
 * - Navigation (useEntityNavigation)
 * - UI state management (useDetailPageState)
 */

export { useEntityEdit } from "./useEntityEdit";
export { useEntityAudit } from "./useEntityAudit";
export { useEntityNavigation } from "./useEntityNavigation";
export { useDetailPageState } from "./useDetailPageState";
