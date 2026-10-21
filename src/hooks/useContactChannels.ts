import { queryOptions, useQuery } from "@tanstack/react-query";

import { contactChannelKeys } from "@/lib/query-keys";
import { db } from "@/lib/supabase";
import type { Tables } from "@/types/database.types";

export type ContactChannel = Tables<"contact_channels">;

// Contact channels rarely change, so guest pages can cache them for a long time.
const activeContactChannelsQuery = () =>
  queryOptions({
    queryKey: contactChannelKeys.active(),
    queryFn: async (): Promise<ContactChannel[]> => {
      const { data, error } = await db.contactChannels.active();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

/** Active contact channels in display order, for guest-facing pages. */
export function useActiveContactChannels() {
  return useQuery(activeContactChannelsQuery());
}
