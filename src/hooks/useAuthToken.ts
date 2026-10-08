/**
 * Authentication Token Hook
 *
 * Provides a centralized way to access the current user's authentication token.
 * Uses Supabase session management instead of localStorage for consistency.
 *
 * @module useAuthToken
 */

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

/**
 * Hook to get the current user's authentication token
 *
 * Automatically subscribes to auth state changes to keep the token updated.
 * Returns null if user is not authenticated.
 *
 * @returns {Object} Authentication state
 * @property {string | null} token - JWT access token (null if not authenticated)
 * @property {boolean} isLoading - True while fetching initial session
 * @property {Error | null} error - Error if session fetch failed
 *
 * @example
 * // In a component
 * function AdminComponent() {
 *   const { token, isLoading, error } = useAuthToken();
 *
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!token) return <div>Not authenticated</div>;
 *
 *   // Use token for API calls
 *   const response = await fetch('/api/admin/data', {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 * }
 */
export function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        setToken(session?.access_token || null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to get session"));
        setToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    void getInitialSession();

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setToken(session?.access_token || null);
      setError(null);
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { token, isLoading, error };
}
