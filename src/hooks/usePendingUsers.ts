import { queryOptions, useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

export interface PendingUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  email_confirmed_at: string | null;
}

export const pendingUsersKeys = {
  all: ["pending-users"] as const,
};

const pendingUsersQuery = () =>
  queryOptions({
    queryKey: pendingUsersKeys.all,
    queryFn: async (): Promise<PendingUser[]> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/admin/pending-users", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch pending users");
      }

      const data = (await res.json()) as { users: PendingUser[] };
      return data.users;
    },
    staleTime: 30_000,
    retry: 1,
  });

export function usePendingUsers() {
  return useQuery(pendingUsersQuery());
}
