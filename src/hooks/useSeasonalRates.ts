import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { seasonalRateKeys } from "@/lib/query-keys";
import { db, handleSupabaseError } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type SeasonalRateInsert = Database["public"]["Tables"]["seasonal_rates"]["Insert"];

const seasonalRatesQuery = () =>
  queryOptions({
    queryKey: seasonalRateKeys.list(),
    queryFn: async () => {
      const { data, error } = await db.seasonalRates.all();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

/**
 * Hook to fetch all seasonal rates
 */
export function useSeasonalRates() {
  return useQuery(seasonalRatesQuery());
}

/**
 * Hook to save all seasonal rates (bulk upsert)
 */
export function useSaveSeasonalRates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rates: SeasonalRateInsert[]) => {
      // Clean up rates before saving - remove temporary IDs
      const cleanedRates = rates.map((rate) => {
        const { id, ...rest } = rate;
        // Only include id if it's a valid UUID (not temporary)
        if (id && !id.startsWith("temp_")) {
          return rate;
        }
        return rest as SeasonalRateInsert;
      });

      return await db.seasonalRates.bulkUpsert(cleanedRates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: seasonalRateKeys.all });

      toast.success("Seasonal rates saved", {
        description: "All seasonal rate changes have been saved successfully.",
      });
    },
    onError: (error) => {
      toast.error("Error saving seasonal rates", {
        description: handleSupabaseError(error),
      });
    },
  });
}
