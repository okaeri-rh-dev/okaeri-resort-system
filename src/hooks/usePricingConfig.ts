import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { pricingConfigKeys } from "@/lib/query-keys";
import { db, supabase } from "@/lib/supabase";
import type { PricingConfigInput } from "@/lib/validation/pricing-schema";
import type { Database } from "@/types/database.types";

export type PricingConfig = Database["public"]["Tables"]["pricing_config"]["Row"];

const pricingConfigQuery = queryOptions({
  queryKey: pricingConfigKeys.all,
  queryFn: async () => {
    const { data, error } = await db.pricingConfig.get();

    if (error) {
      console.error("[usePricingConfig] Error fetching pricing config:", error);
      throw new Error(error.message || "Failed to fetch pricing configuration");
    }

    if (!data) {
      throw new Error("Pricing configuration not found");
    }

    return data as PricingConfig;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes - pricing doesn't change often
  gcTime: 30 * 60 * 1000, // 30 minutes cache retention (formerly cacheTime)
  retry: 2, // Retry failed requests twice
  refetchOnWindowFocus: false, // Don't refetch when user returns to tab
});

/**
 * Query Hook: Fetch Current Pricing Configuration
 *
 * Fetches the singleton pricing_config row (id='default') from database.
 * Used by PricingInfoCard and PricingConfigForm components.
 *
 * Features:
 * - Caches data for 5 minutes (staleTime)
 * - Keeps in cache for 30 minutes (cacheTime)
 * - Automatic background refetching
 * - Error handling with toast notifications
 *
 * @example
 * ```typescript
 * const { data: pricing, isLoading, error } = usePricingConfig();
 *
 * if (isLoading) return <Skeleton />;
 * if (error) return <ErrorAlert />;
 * return <div>Base Rate: {pricing.base_rate}</div>;
 * ```
 */
export function usePricingConfig() {
  return useQuery(pricingConfigQuery);
}

/**
 * Mutation Hook: Update Pricing Configuration
 *
 * Updates the singleton pricing_config row via API endpoint.
 * Implements optimistic updates with automatic rollback on error.
 *
 * Features:
 * - Optimistic UI updates for instant feedback
 * - Automatic rollback on error
 * - Success toast notification
 * - Query invalidation to refresh dependent data
 * - Optional navigation on success
 *
 * @param options - Configuration options
 * @param options.onSuccess - Callback after successful update
 * @param options.navigateOnSuccess - Auto-navigate to /units after success
 *
 * @example
 * ```typescript
 * const updatePricing = useUpdatePricingConfig({
 *   navigateOnSuccess: true
 * });
 *
 * const handleSubmit = async (data: PricingConfigInput) => {
 *   await updatePricing.mutateAsync(data);
 * };
 * ```
 */
export function useUpdatePricingConfig(options?: {
  onSuccess?: (data: PricingConfig) => void;
  navigateOnSuccess?: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (data: PricingConfigInput) => {
      // Get current session token for authentication
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("No active session. Please sign in to update pricing configuration.");
      }

      // Call API endpoint to update pricing
      const response = await fetch("/api/pricing/update-config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        throw new Error(
          errorData.error || errorData.message || `Failed to update pricing: ${response.status}`
        );
      }

      const result = (await response.json()) as {
        success?: boolean;
        config?: PricingConfig;
      };

      if (!result.success || !result.config) {
        throw new Error("Invalid response from pricing update endpoint");
      }

      return result.config;
    },

    // Optimistic update: immediately update UI before server confirms
    onMutate: async (newData) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: pricingConfigQuery.queryKey });

      // Snapshot the previous value for rollback
      const previousData = queryClient.getQueryData(pricingConfigQuery.queryKey);

      // Optimistically update the cache
      if (previousData) {
        queryClient.setQueryData(pricingConfigQuery.queryKey, {
          ...previousData,
          ...newData,
          updated_at: new Date().toISOString(),
        });
      }

      // Return context object with the snapshot for rollback
      return { previousData };
    },

    // Rollback on error
    onError: (error, _newData, context) => {
      // Restore previous data on error
      if (context?.previousData) {
        queryClient.setQueryData(pricingConfigQuery.queryKey, context.previousData);
      }

      // Show error toast
      const errorMessage = error instanceof Error ? error.message : "Failed to update pricing";
      toast.error("Update Failed", {
        description: errorMessage,
      });

      console.error("[useUpdatePricingConfig] Mutation error:", error);
    },

    // Always refetch after error or success to ensure cache is in sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pricingConfigQuery.queryKey });
    },

    // Success handling
    onSuccess: (data) => {
      // Show success toast
      toast.success("Pricing Updated", {
        description: "Pricing configuration has been updated successfully.",
      });

      // Call custom success callback if provided
      if (options?.onSuccess) {
        options.onSuccess(data);
      }

      // Navigate back to admin units page if requested
      if (options?.navigateOnSuccess) {
        navigate({ to: "/admin/units" });
      }
    },
  });
}
