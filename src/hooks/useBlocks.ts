import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { invalidateAvailability } from "@/lib/query-invalidation";
import { availabilityKeys } from "@/lib/query-keys";
import { db, handleSupabaseError } from "@/lib/supabase";
import type { Tables, TablesUpdate } from "@/types/database.types";

export type Block = Tables<"availability_blackouts">;

export interface NewBlockInput {
  /** null = resort closure */
  unitIds: string[] | null;
  start_date: string;
  end_date: string;
  reason: string;
}

type BlockChanges = Pick<
  TablesUpdate<"availability_blackouts">,
  "start_date" | "end_date" | "reason"
>;

const BOOKINGS_USE_THESE_NIGHTS = "CNFLT";
const BLOCK_LOCKED = "55000";

/** The save guard and the lock trigger raise messages written for the manager; show them as is. */
export function blockErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    (error.code === BOOKINGS_USE_THESE_NIGHTS || error.code === BLOCK_LOCKED)
  ) {
    return String(error.message);
  }
  return handleSupabaseError(error);
}

const blocksQuery = (includePast: boolean) =>
  queryOptions({
    queryKey: availabilityKeys.blackouts.list(includePast),
    queryFn: async (): Promise<Block[]> => {
      const { data, error } = await db.blackouts.list({ includePast });
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    // Keeps the list on screen while "Show past blocks" fetches the longer one
    placeholderData: keepPreviousData,
  });

/** Current and upcoming blocks, with past ones when `includePast` is set. */
export function useBlocks({ includePast = false } = {}) {
  return useQuery(blocksQuery(includePast));
}

function useAfterBlockChange() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: availabilityKeys.blackouts.all });
    invalidateAvailability();
  };
}

export function useCreateBlocks() {
  const afterBlockChange = useAfterBlockChange();

  return useMutation({
    mutationFn: async ({ unitIds, ...block }: NewBlockInput): Promise<Block[]> => {
      const { data, error } = await db.blackouts.create({ unitIds, ...block });
      if (error) throw error;
      return data;
    },
    onSuccess: (blocks) => {
      afterBlockChange();
      toast.success(
        blocks.some((block) => block.unit_id === null) ? "Resort closed" : "Dates blocked"
      );
    },
  });
}

export function useUpdateBlock() {
  const afterBlockChange = useAfterBlockChange();

  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: BlockChanges }): Promise<Block> => {
      const { data, error } = await db.blackouts.update(id, changes);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      afterBlockChange();
      toast.success("Block updated");
    },
  });
}

export function useDeleteBlock() {
  const afterBlockChange = useAfterBlockChange();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await db.blackouts.delete(id);
      if (error) throw error;
    },
    onSuccess: () => {
      afterBlockChange();
      toast.success("Block deleted");
    },
  });
}
