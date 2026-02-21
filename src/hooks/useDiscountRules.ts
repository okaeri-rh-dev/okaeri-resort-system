import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, handleSupabaseError } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type DiscountRuleInsert = Database["public"]["Tables"]["discount_rules"]["Insert"];

/**
 * Hook to fetch all discount rules
 */
export function useDiscountRules() {
  return useQuery({
    queryKey: ["discount-rules"],
    queryFn: async () => {
      const { data, error } = await db.discountRules.all();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to save all discount rules (bulk upsert)
 */
export function useSaveDiscountRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rules: DiscountRuleInsert[]) => {
      // Clean up rules before saving - remove temporary IDs
      const cleanedRules = rules.map((rule) => {
        const { id, ...rest } = rule;
        // Only include id if it's a valid UUID (not temporary)
        if (id && !id.startsWith("temp_")) {
          return rule;
        }
        return rest as DiscountRuleInsert;
      });

      return await db.discountRules.bulkUpsert(cleanedRules);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discount-rules"] });

      toast.success("Discount rules saved", {
        description: "All discount rule changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast.error("Error saving discount rules", {
        description: handleSupabaseError(error),
      });
    },
  });
}
