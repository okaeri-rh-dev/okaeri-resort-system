/**
 * Access token for /api calls.
 *
 * @module useAuthToken
 */

import { supabase } from "@/lib/supabase";

/** Reads the current access token at call time, so query keys need not include it. */
export async function getAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated. Please sign in again.");
  }
  return session.access_token;
}
