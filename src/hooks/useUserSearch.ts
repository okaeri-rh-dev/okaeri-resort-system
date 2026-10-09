// src/hooks/useUserSearch.ts

import { useEffect, useState } from "react";

import { queryOptions, useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";

// ============================================
// TYPES
// ============================================

export interface AuthUser {
  id: string;
  email: string;
  raw_user_meta_data?: {
    full_name?: string;
    name?: string;
    // External metadata from Supabase Auth - dynamic structure
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  created_at: string;
}

// ============================================
// QUERY KEYS
// ============================================

export const userSearchKeys = {
  all: ["userSearch"] as const,
  search: (query: string) => [...userSearchKeys.all, "search", query] as const,
  detail: (userId: string | null) => [...userSearchKeys.all, "detail", userId] as const,
};

// ============================================
// HOOK
// ============================================

const userSearchQuery = (debouncedQuery: string) =>
  queryOptions({
    queryKey: userSearchKeys.search(debouncedQuery),
    queryFn: async () => {
      // Don't search if query is too short
      if (!debouncedQuery || debouncedQuery.trim().length < 2) {
        return [];
      }

      const query = debouncedQuery.trim().toLowerCase();

      // Query auth.users table via admin API
      // Note: This requires proper RLS policies or service role access
      // RPC function may not be in generated types - cast entire call
      const rpcCall = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: AuthUser[] | null; error: Error | null }>;
      const { data, error } = await rpcCall("search_users_for_roles", { search_query: query });

      if (error) {
        console.error("[UserSearch] Error searching users:", error);

        // Fallback: Try direct query if RPC fails
        // This may not work depending on RLS policies
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("app_roles")
          .select("user_id, email")
          .ilike("email", `%${query}%`)
          .limit(10);

        if (fallbackError) {
          throw new Error(fallbackError.message);
        }

        return (fallbackData || []).map((role) => ({
          id: role.user_id,
          email: role.email,
          raw_user_meta_data: {},
          created_at: "",
        })) as AuthUser[];
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

/**
 * Search for users in auth.users by email or name
 * Uses debounced search to avoid excessive queries
 *
 * @param searchQuery - The search term (email or name)
 * @param debounceMs - Debounce delay in milliseconds (default: 300ms)
 * @returns Query result with matching users
 *
 * @example
 * const { data: users, isLoading } = useUserSearch(searchQuery);
 */
export function useUserSearch(searchQuery: string, debounceMs: number = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce the search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery, debounceMs]);

  return useQuery({
    ...userSearchQuery(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
  });
}

const userByIdQuery = (userId: string | null) =>
  queryOptions({
    queryKey: userSearchKeys.detail(userId),
    queryFn: async () => {
      if (!userId) return null;

      // RPC function may not be in generated types - cast entire call
      const rpcCall = supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: AuthUser | null; error: Error | null }>;
      const { data, error } = await rpcCall("get_user_by_id", { user_id: userId });

      if (error) {
        console.error("[UserSearch] Error fetching user:", error);
        throw new Error(error.message);
      }

      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

/**
 * Get a specific user by ID
 * Useful for pre-populating forms
 *
 * @param userId - UUID of the user
 * @returns Query result with user details
 */
export function useUserById(userId: string | null) {
  return useQuery({
    ...userByIdQuery(userId),
    enabled: !!userId,
  });
}
