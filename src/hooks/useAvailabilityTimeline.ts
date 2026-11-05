import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import type { Block } from "@/hooks/useBlocks";
import { availabilityKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";

export type TimelineStayRow = NonNullable<
  Awaited<ReturnType<typeof db.bookings.unitStaysInNights>>["data"]
>[number];

const staysQuery = (firstNight: string, lastNight: string) =>
  queryOptions({
    queryKey: availabilityKeys.calendar.stays(firstNight, lastNight),
    queryFn: async (): Promise<TimelineStayRow[]> => {
      const { data, error } = await db.bookings.unitStaysInNights(firstNight, lastNight);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    // Keeps the last window on screen while the next one loads
    placeholderData: keepPreviousData,
  });

export const blocksInNightsQuery = (firstNight: string, lastNight: string) =>
  queryOptions({
    queryKey: availabilityKeys.blackouts.inNights(firstNight, lastNight),
    queryFn: async (): Promise<Block[]> => {
      const { data, error } = await db.blackouts.inDateRange(firstNight, lastNight);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

/** The bookings and blocks on the nights from `firstNight` through `lastNight`. */
export function useAvailabilityTimeline(firstNight: string, lastNight: string) {
  const stays = useQuery(staysQuery(firstNight, lastNight));
  const blocks = useQuery(blocksInNightsQuery(firstNight, lastNight));

  return {
    stays: stays.data ?? [],
    blocks: blocks.data ?? [],
    isLoading: stays.isLoading || blocks.isLoading,
    error: stays.error ?? blocks.error,
    refetch: () => Promise.all([stays.refetch(), blocks.refetch()]),
  };
}
