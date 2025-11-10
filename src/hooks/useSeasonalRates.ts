import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { db, handleSupabaseError } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type SeasonalRateInsert = Database["public"]["Tables"]["seasonal_rates"]["Insert"];
type SeasonalRateUpdate = Database["public"]["Tables"]["seasonal_rates"]["Update"];

/**
 * Hook to fetch all seasonal rates
 */
export function useSeasonalRates() {
  return useQuery({
    queryKey: ["seasonal-rates"],
    queryFn: async () => {
      const { data, error } = await db.seasonalRates.all();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch active seasonal rates only
 */
export function useActiveSeasonalRates() {
  return useQuery({
    queryKey: ["seasonal-rates", "active"],
    queryFn: async () => {
      const { data, error } = await db.seasonalRates.active();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch seasonal rate for a specific date
 */
export function useSeasonalRateForDate(date: Date | null) {
  return useQuery({
    queryKey: ["seasonal-rates", "date", date?.toISOString()],
    queryFn: async () => {
      if (!date) return null;
      return await db.seasonalRates.forDate(date);
    },
    enabled: !!date,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
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
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates"] });

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

/**
 * Hook to create a single seasonal rate
 */
export function useCreateSeasonalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rate: SeasonalRateInsert) => {
      const { data, error } = await db.seasonalRates.create(rate);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates"] });

      toast.success("Seasonal rate created", {
        description: `${data.name} has been created successfully.`,
      });
    },
    onError: (error) => {
      toast.error("Error creating seasonal rate", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to update a single seasonal rate
 */
export function useUpdateSeasonalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: SeasonalRateUpdate }) => {
      const { data, error } = await db.seasonalRates.update(id, updates);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates"] });

      toast.success("Seasonal rate updated", {
        description: `${data.name} has been updated successfully.`,
      });
    },
    onError: (error) => {
      toast.error("Error updating seasonal rate", {
        description: handleSupabaseError(error),
      });
    },
  });
}

/**
 * Hook to delete a seasonal rate
 */
export function useDeleteSeasonalRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.seasonalRates.delete(id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasonal-rates"] });

      toast.success("Seasonal rate deleted", {
        description: "The seasonal rate has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast.error("Error deleting seasonal rate", {
        description: handleSupabaseError(error),
      });
    },
  });
}
