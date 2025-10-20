/**
 * Debug Helpers - For Development Only
 *
 * This file exposes helpful debugging utilities to the browser console.
 * Only active in development mode.
 *
 * Usage:
 * 1. Import this file in your main.tsx or App.tsx
 * 2. Open browser console
 * 3. Use: window.debug.supabase, window.debug.checkSession(), etc.
 */

import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Only expose debug helpers in development
if (import.meta.env.DEV) {
  const debug = {
    /**
     * Supabase client instance
     * Usage: await window.debug.supabase.from('units').select('*')
     */
    supabase,

    /**
     * Auth service instance
     * Usage: await window.debug.auth.getSession()
     */
    auth,

    /**
     * Quick session check
     * Usage: await window.debug.checkSession()
     */
    async checkSession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      console.log("=== SESSION CHECK ===");
      console.log("Session exists:", !!session);
      console.log("User ID:", session?.user?.id);
      console.log("User email:", session?.user?.email);
      console.log("Token preview:", session?.access_token?.substring(0, 30) + "...");
      console.log("Expires at:", session?.expires_at ? new Date(session.expires_at * 1000) : "N/A");
      console.log("Error:", error);
      return { session, error };
    },

    /**
     * Test database query
     * Usage: await window.debug.testQuery('units')
     */
    async testQuery(table: string = "units") {
      console.log(`=== TESTING ${table.toUpperCase()} QUERY ===`);
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .limit(5);
      console.log(`Results: ${data?.length || 0} rows`);
      console.log("Data:", data);
      console.log("Error:", error);
      return { data, error };
    },

    /**
     * Test insert (and auto-cleanup)
     * Usage: await window.debug.testInsert()
     */
    async testInsert() {
      console.log("=== TESTING INSERT ===");

      const testData = {
        unit_code: `TEST-${Date.now()}`,
        unit_name: "Debug Test Unit",
        unit_type: "Standard",
        base_rate: 1000,
        base_occupancy: 2,
        max_occupancy: 4,
        extra_person_rate: 500,
        weekend_rate: 1200,
      };

      // Try insert
      const { data, error } = await supabase.from("units").insert(testData).select().single();

      console.log("Insert result:", data);
      console.log("Error:", error);

      // Auto cleanup
      if (data) {
        console.log("Cleaning up test data...");
        await supabase.from("units").delete().eq("unit_id", data.unit_id);
        console.log("✅ Test data cleaned up");
      }

      return { data, error };
    },

    /**
     * Check RLS policies in effect
     * Usage: window.debug.checkRLS()
     */
    async checkRLS() {
      console.log("=== RLS POLICY CHECK ===");
      const session = await this.checkSession();

      if (!session.session) {
        console.error("❌ Not logged in! Cannot test RLS.");
        return;
      }

      const tables = ["units", "bookings", "guests", "payments", "expenses"];

      for (const table of tables) {
        const { count, error } = await supabase
          .from(table as any)
          .select("*", { count: "exact", head: true });
        if (error) {
          console.error(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: Access granted (${count || 0} rows)`);
        }
      }
    },

    /**
     * Refresh session and test
     * Usage: await window.debug.refreshAndTest()
     */
    async refreshAndTest() {
      console.log("=== REFRESH & TEST ===");

      // Refresh session
      console.log("1. Refreshing session...");
      const {
        data: { session },
        error: refreshError,
      } = await supabase.auth.refreshSession();

      if (refreshError) {
        console.error("❌ Refresh failed:", refreshError);
        return;
      }

      console.log("✅ Session refreshed:", session?.user?.id);

      // Test query
      console.log("2. Testing query...");
      await this.testQuery("units");
    },

    /**
     * Check environment variables
     * Usage: window.debug.checkEnv()
     */
    checkEnv() {
      console.log("=== ENVIRONMENT CHECK ===");
      console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
      console.log("Has anon key:", !!import.meta.env.VITE_SUPABASE_ANON_KEY);
      console.log("Key length:", import.meta.env.VITE_SUPABASE_ANON_KEY?.length);
      console.log("Key prefix:", import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + "...");

      // Decode JWT to check role
      try {
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const payload = JSON.parse(atob(key.split(".")[1]));
        console.log("JWT role:", payload.role);
        console.log("JWT issuer:", payload.iss);

        if (payload.role !== "anon") {
          console.warn(
            '⚠️ WARNING: Key role is not "anon"! This should be the anon key, not service role.'
          );
        } else {
          console.log("✅ Correct key type (anon)");
        }
      } catch (e) {
        console.error("❌ Could not decode JWT:", e);
      }
    },

    /**
     * Full diagnostic
     * Usage: await window.debug.diagnose()
     */
    async diagnose() {
      console.log("=== FULL DIAGNOSTIC ===");
      this.checkEnv();
      await this.checkSession();
      await this.checkRLS();
      console.log("=== DIAGNOSTIC COMPLETE ===");
    },

    /**
     * Help text
     */
    help() {
      console.log(`
=== DEBUG HELPERS ===

Available commands:

  await window.debug.checkSession()       - Check if user is logged in
  await window.debug.testQuery('units')   - Test a database query
  await window.debug.testInsert()         - Test insert & auto-cleanup
  await window.debug.checkRLS()           - Check RLS policies
  await window.debug.refreshAndTest()     - Refresh session and test
  window.debug.checkEnv()                 - Check environment variables
  await window.debug.diagnose()           - Run full diagnostic

Direct access:
  window.debug.supabase                   - Supabase client
  window.debug.auth                       - Auth service

Example:
  await window.debug.supabase.from('units').select('*')
      `);
    },
  };

  // Expose to window
  (window as any).debug = debug;

  // Show welcome message
  console.log(
    "%c🛠️ Debug Helpers Loaded",
    "background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;"
  );
  console.log("Type window.debug.help() for available commands");
  console.log("Quick start: await window.debug.diagnose()");
}

// Export for TypeScript type checking
export {};

// Add type definitions for window.debug
declare global {
  interface Window {
    debug: {
      supabase: typeof supabase;
      auth: typeof auth;
      checkSession: () => Promise<any>;
      testQuery: (table?: string) => Promise<any>;
      testInsert: () => Promise<any>;
      checkRLS: () => Promise<void>;
      refreshAndTest: () => Promise<void>;
      checkEnv: () => void;
      diagnose: () => Promise<void>;
      help: () => void;
    };
  }
}
