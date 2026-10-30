import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

import type { ManilaDay } from "@/lib/bookings/stay";
import { unitKeys } from "@/lib/query-keys";
import { throwDetailLoadError } from "@/lib/detail-load-error";
import { db, handleSupabaseError, supabase } from "@/lib/supabase";
import { toManilaDateString } from "@/lib/timezone";
import type { CabinNight, CabinState, Unit, UnitFilters } from "@/types";

// ============================================
// ZUSTAND STORE
// ============================================
interface UnitStore {
  // Local state
  selectedUnit: Unit | null;
  filters: UnitFilters;
  viewMode: "grid" | "list";

  // Actions
  setSelectedUnit: (unit: Unit | null) => void;
  setFilters: (filters: UnitFilters) => void;
  resetFilters: () => void;
  setViewMode: (mode: "grid" | "list") => void;

  // Optimistic updates
  optimisticUnits: Map<string, Unit>;
  addOptimisticUnit: (unit: Unit) => void;
  removeOptimisticUnit: (unitId: string) => void;
  clearOptimisticUnits: () => void;
}

export const useUnitStore = create<UnitStore>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedUnit: null,
        filters: {},
        viewMode: "grid",
        optimisticUnits: new Map(),

        // Actions
        setSelectedUnit: (unit) => set({ selectedUnit: unit }),

        setFilters: (filters) => set({ filters }),

        resetFilters: () => set({ filters: {} }),

        setViewMode: (mode) => set({ viewMode: mode }),

        addOptimisticUnit: (unit) =>
          set((state) => {
            const newMap = new Map(state.optimisticUnits);
            newMap.set(unit.unit_id, unit);
            return { optimisticUnits: newMap };
          }),

        removeOptimisticUnit: (unitId) =>
          set((state) => {
            const newMap = new Map(state.optimisticUnits);
            newMap.delete(unitId);
            return { optimisticUnits: newMap };
          }),

        clearOptimisticUnits: () => set({ optimisticUnits: new Map() }),
      }),
      {
        name: "unit-storage",
        storage: {
          getItem: (name) => {
            const value = sessionStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          },
          setItem: (name, value) => {
            sessionStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => {
            sessionStorage.removeItem(name);
          },
        },
        partialize: (state) =>
          ({
            viewMode: state.viewMode,
            filters: state.filters,
          }) as UnitStore,
      }
    ),
    {
      name: "UnitStore",
    }
  )
);

// ============================================
// TANSTACK QUERY HOOKS
// ============================================

// One unit with amenities typed; the detail and edit routes, useUnit and useEntityEdit share this cache entry
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
const unitListQuery = (filters: UnitStore["filters"]) =>
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

      // Merge with optimistic updates
      const { optimisticUnits } = useUnitStore.getState();
      const mergedData =
        (data as Unit[])?.map((unit) => optimisticUnits.get(unit.unit_id) ?? unit) || [];

      return mergedData;
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

export const useUnits = () => {
  const filters = useUnitStore((state) => state.filters);

  return useQuery(unitListQuery(filters));
};

// Fetch single unit

// Create unit mutation
export const useCreateUnit = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useUnitStore((state) => state.addOptimisticUnit);
  const removeOptimistic = useUnitStore((state) => state.removeOptimisticUnit);

  return useMutation({
    mutationFn: async (unitData: Omit<Unit, "unit_id" | "created_at" | "updated_at">) => {
      const { data, error } = await db.units.create(unitData);
      if (error) throw new Error(handleSupabaseError(error));
      return data;
    },
    onMutate: async (newUnit) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: unitKeys.all });

      // Create optimistic unit
      const optimisticUnit: Unit = {
        ...newUnit,
        unit_id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      addOptimistic(optimisticUnit);

      return { optimisticUnit };
    },
    onError: (_err, _newUnit, context) => {
      // Remove optimistic unit on error
      if (context?.optimisticUnit) {
        removeOptimistic(context.optimisticUnit.unit_id);
      }
    },
    onSuccess: (_data, _variables, context) => {
      // Remove optimistic unit after success
      if (context?.optimisticUnit) {
        removeOptimistic(context.optimisticUnit.unit_id);
      }
    },
    onSettled: () => {
      // Refetch units after mutation
      queryClient.invalidateQueries({ queryKey: unitKeys.all });
    },
  });
};

// Update unit mutation
export const useUpdateUnit = () => {
  const queryClient = useQueryClient();
  const addOptimistic = useUnitStore((state) => state.addOptimisticUnit);
  const removeOptimistic = useUnitStore((state) => state.removeOptimisticUnit);

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

      // Get current unit data
      const previousUnit = queryClient.getQueryData<Unit>(unitKeys.detail(unitId));

      if (previousUnit) {
        const optimisticUnit: Unit = {
          ...previousUnit,
          ...updates,
          updated_at: new Date().toISOString(),
        };

        addOptimistic(optimisticUnit);

        // Update cache
        queryClient.setQueryData(unitKeys.detail(unitId), optimisticUnit);

        return { previousUnit, optimisticUnit };
      }
    },
    onError: (_, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousUnit) {
        removeOptimistic(variables.unitId);
        queryClient.setQueryData(unitKeys.detail(variables.unitId), context.previousUnit);
      }
    },
    onSuccess: (_data2, _variables2, context) => {
      if (context?.optimisticUnit) {
        removeOptimistic(context.optimisticUnit.unit_id);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: unitKeys.all });
    },
  });
};

// Delete unit mutation
export const useDeleteUnit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (unitId: string) => {
      const { error } = await db.units.delete(unitId);
      if (error) throw new Error(handleSupabaseError(error));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: unitKeys.all });
    },
  });
};

// Check availability

// Real-time subscription for unit updates
// NOTE: Disabled for Phase 1 - Real-time features scheduled for Phase 2
// export const useUnitsSubscription = () => {
//   const queryClient = useQueryClient();

//   useQuery({
//     queryKey: ["units-subscription"],
//     queryFn: async () => {
//       const channel = supabase
//         .channel("units-changes")
//         .on(
//           "postgres_changes",
//           {
//             event: "*",
//             schema: "public",
//             table: "units",
//           },
//           (payload) => {
//             // Invalidate and refetch units on any change
//             queryClient.invalidateQueries({ queryKey: unitKeys.all });

//             if (payload.eventType === "UPDATE" && payload.new) {
//               // Update specific unit cache
//               queryClient.setQueryData(unitKeys.detail((payload.new as Unit).unit_id), payload.new);
//             }
//           }
//         )
//         .subscribe();

//       return () => {
//         channel.unsubscribe();
//       };
//     },
//     staleTime: Infinity, // Subscription should never be considered stale
//   });
// };

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
