import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { afterWrite } from "@/lib/after-write";
import type { ManilaDay } from "@/lib/bookings/stay";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { patchCachedLists } from "@/lib/optimistic-list-patch";
import { unitKeys } from "@/lib/query-keys";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import { toManilaDateString } from "@/lib/timezone";
import type { CabinNight, CabinState, Unit, UnitFilters } from "@/types";

// One unit with amenities typed; the detail and edit routes share this cache entry
export const unitDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: unitKeys.detail(unitId),
    queryFn: async () => {
      const { data, error } = await db.units.byId(unitId);
      if (error) throwDetailLoadError(error, "cabin");
      return { ...data, amenities: data.amenities as string[] | null };
    },
    staleTime: 30000,
  });

// Every unit, unfiltered, for selectors in edit forms; a failure shows an empty selector
export const allUnitsQuery = () =>
  queryOptions({
    queryKey: unitKeys.unfiltered(),
    queryFn: async () => {
      const { data, error } = await db.units.all();
      if (error) {
        console.error("Failed to fetch units:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 60000,
  });

// Fetch all units with filters
const unitListQuery = (filters: UnitFilters) =>
  queryOptions({
    queryKey: unitKeys.list(filters),
    queryFn: async () => {
      let query = supabase.from("units").select("*");

      // Apply filters
      if (filters.type) {
        query = query.eq("unit_type", filters.type);
      }
      if (filters.min_rate !== undefined) {
        query = query.gte("base_rate", filters.min_rate);
      }
      if (filters.max_rate !== undefined) {
        query = query.lte("base_rate", filters.max_rate);
      }
      if (filters.min_occupancy !== undefined) {
        query = query.gte("max_occupancy", filters.min_occupancy);
      }

      const { data, error } = await query.order("unit_code", { ascending: true });

      if (error) throw new Error(handleSupabaseError(error));

      return (data as Unit[]) || [];
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

// Every cabin, ignoring the Units page filters
export const useAllUnits = () => useQuery(allUnitsQuery());

export const useUnits = () => useQuery(unitListQuery({}));

// Fetch single unit

// Create unit mutation
export const useCreateUnit = () => {
  return useMutation({
    mutationFn: async (unitData: Omit<Unit, "unit_id" | "created_at" | "updated_at">) => {
      const { data, error } = await db.units.create(unitData);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onSettled: () => afterWrite("units"),
  });
};

// Update unit mutation
export const useUpdateUnit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      unitId,
      updates,
    }: {
      unitId: string;
      updates: Partial<Omit<Unit, "unit_id" | "created_at" | "updated_at">>;
    }) => {
      const { data, error } = await db.units.update(unitId, updates);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async ({ unitId, updates }) => {
      await queryClient.cancelQueries({ queryKey: unitKeys.all });

      const previousUnit = queryClient.getQueryData<Unit>(unitKeys.detail(unitId));
      if (previousUnit) {
        queryClient.setQueryData(unitKeys.detail(unitId), {
          ...previousUnit,
          ...updates,
          updated_at: new Date().toISOString(),
        });
      }

      const patchUnit = (unit: Unit) => (unit.unit_id === unitId ? { ...unit, ...updates } : unit);
      const restoreLists = await patchCachedLists(queryClient, unitKeys.lists(), patchUnit);
      const restoreUnfiltered = await patchCachedLists(
        queryClient,
        unitKeys.unfiltered(),
        patchUnit
      );
      return { previousUnit, restoreLists, restoreUnfiltered };
    },
    onError: (_, variables, context) => {
      if (context?.previousUnit) {
        queryClient.setQueryData(unitKeys.detail(variables.unitId), context.previousUnit);
      }
      context?.restoreLists();
      context?.restoreUnfiltered();
    },
    onSettled: () => afterWrite("units"),
  });
};

// Delete unit mutation
export const useDeleteUnit = () => {
  return useMutation({
    mutationFn: async (unitId: string) => {
      const { error } = await db.units.delete(unitId);
      if (error) throw new Error(handleSupabaseError(error));
    },
    onSettled: () => afterWrite("units"),
  });
};

// Check availability

// Each cabin's state on one night, keyed by unit id
const cabinStatesQuery = (date: ManilaDay) =>
  queryOptions({
    queryKey: unitKeys.states(date),
    queryFn: async () => {
      const { data, error } = await db.units.statesOn(date);
      if (error) throw new Error(handleSupabaseError(error));
      return new Map<string, CabinNight>(
        data.map((row) => [
          row.unit_id,
          // The RPC returns only Blocked, Booked or Free; the generated type says string
          { state: row.state as CabinState, blockReason: row.block_reason },
        ])
      );
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

export const useCabinStatesTonight = () =>
  useQuery(cabinStatesQuery(toManilaDateString(new Date())));
