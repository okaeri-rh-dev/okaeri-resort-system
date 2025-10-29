// src/hooks/entity/useDetailPageState.ts

import { useCallback } from "react";

import { useNavigate, useSearch } from "@tanstack/react-router";

/**
 * Valid tab values for detail pages
 */
type TabValue = "details" | "payments" | "audit" | "history";

/**
 * Hook for managing detail page UI state synced with URL search params
 *
 * Manages tab state with URL persistence:
 * - Reads active tab from URL search params
 * - Updates URL on tab change (with replace navigation)
 * - Preserves other search params
 *
 * @example
 * ```typescript
 * const { activeTab, setActiveTab } = useDetailPageState()
 *
 * <Tabs value={activeTab} onValueChange={setActiveTab}>
 *   <TabsList>
 *     <TabsTrigger value="details">Details</TabsTrigger>
 *     <TabsTrigger value="payments">Payments</TabsTrigger>
 *     <TabsTrigger value="audit">Audit</TabsTrigger>
 *   </TabsList>
 * </Tabs>
 * ```
 */
export function useDetailPageState() {
  const search = useSearch({ strict: false }) as { tab?: TabValue };
  const navigate = useNavigate();

  // Get active tab from URL or default to 'details'
  const activeTab = search.tab ?? "details";

  /**
   * Set active tab and update URL search params
   * Uses replace navigation to avoid cluttering history
   */
  const setActiveTab = useCallback(
    (tab: TabValue) => {
      navigate({
        search: (prev: any) => ({ ...prev, tab }),
        replace: true, // Don't add to history
      } as any);
    },
    [navigate]
  );

  return {
    activeTab,
    setActiveTab,
  };
}
